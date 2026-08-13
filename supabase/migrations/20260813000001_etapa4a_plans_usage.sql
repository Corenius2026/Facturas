-- ==============================================================================
-- ETAPA 4A: MODELO DE LICENCIAS, PLANES, SUSCRIPCIONES Y CONSUMO ATÓMICO
-- ==============================================================================

-- 1. ENUM DE ESTADO DE SUSCRIPCIÓN
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE public.subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');
    END IF;
END $$;

-- 2. TABLA DE PLANES (public.plans)
CREATE TABLE IF NOT EXISTS public.plans (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                  TEXT UNIQUE NOT NULL,
    name                  TEXT NOT NULL,
    monthly_invoice_limit INTEGER NOT NULL,
    price_cop             INTEGER NOT NULL DEFAULT 0,
    allow_2fa             BOOLEAN NOT NULL DEFAULT false,
    allow_batch_export    BOOLEAN NOT NULL DEFAULT false,
    features              JSONB NOT NULL DEFAULT '{}'::jsonb,
    active                BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_slug ON public.plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_active ON public.plans(active);

-- Seed de los 4 Planes Oficiales FacturaAI
INSERT INTO public.plans (slug, name, monthly_invoice_limit, price_cop, allow_2fa, allow_batch_export, features, active)
VALUES 
  ('free', 'Plan Free', 30, 0, false, false, '{"description": "Ideal para pequeños comercios y pruebas", "support": "comunidad"}'::jsonb, true),
  ('starter', 'Plan Starter', 200, 49000, false, true, '{"description": "Para negocios con volumen moderado", "support": "email"}'::jsonb, true),
  ('pro', 'Plan Pro', 1000, 149000, true, true, '{"description": "Para empresas y estudios contables", "support": "prioritario"}'::jsonb, true),
  ('enterprise', 'Plan Enterprise', 50000, 490000, true, true, '{"description": "Volumen corporativo ilimitado", "support": "dedicado 24/7"}'::jsonb, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_invoice_limit = EXCLUDED.monthly_invoice_limit,
  price_cop = EXCLUDED.price_cop,
  allow_2fa = EXCLUDED.allow_2fa,
  allow_batch_export = EXCLUDED.allow_batch_export,
  features = EXCLUDED.features,
  active = EXCLUDED.active,
  updated_at = NOW();

-- 3. TABLA DE SUSCRIPCIONES (public.subscriptions)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id                 UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
    status                  public.subscription_status NOT NULL DEFAULT 'active',
    current_period_start    TIMESTAMPTZ NOT NULL DEFAULT DATE_TRUNC('month', NOW()),
    current_period_end      TIMESTAMPTZ NOT NULL DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month'),
    current_period_invoices  INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON public.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- 4. TABLA DE PERIODOS DE CONSUMO (public.usage_periods)
CREATE TABLE IF NOT EXISTS public.usage_periods (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_start       TIMESTAMPTZ NOT NULL,
    period_end         TIMESTAMPTZ NOT NULL,
    invoices_processed INTEGER NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_usage_period UNIQUE(tenant_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_usage_periods_tenant_lookup 
    ON public.usage_periods(tenant_id, period_start, period_end);

-- 5. ASIGNACIÓN INICIAL DE PLAN FREE PARA TENANTS EXISTENTES
DO $$ 
DECLARE
    v_free_plan_id UUID;
    r_tenant RECORD;
    v_period_start TIMESTAMPTZ := DATE_TRUNC('month', NOW());
    v_period_end   TIMESTAMPTZ := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
BEGIN
    SELECT id INTO v_free_plan_id FROM public.plans WHERE slug = 'free' LIMIT 1;

    IF v_free_plan_id IS NOT NULL THEN
        FOR r_tenant IN SELECT id FROM public.tenants WHERE deleted_at IS NULL LOOP
            INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, current_period_invoices)
            VALUES (r_tenant.id, v_free_plan_id, 'active', v_period_start, v_period_end, 0)
            ON CONFLICT (tenant_id) DO NOTHING;

            INSERT INTO public.usage_periods (tenant_id, period_start, period_end, invoices_processed)
            VALUES (r_tenant.id, v_period_start, v_period_end, 0)
            ON CONFLICT (tenant_id, period_start, period_end) DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- 6. FUNCIÓN DE CONSULTA DE CUOTA Y USO (get_tenant_usage)
CREATE OR REPLACE FUNCTION public.get_tenant_usage(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_plan_slug       TEXT;
    v_plan_name       TEXT;
    v_monthly_limit   INTEGER;
    v_period_start    TIMESTAMPTZ := DATE_TRUNC('month', NOW());
    v_period_end      TIMESTAMPTZ := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    v_used            INTEGER := 0;
    v_status          TEXT := 'active';
    v_free_plan_id    UUID;
BEGIN
    IF p_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tenant ID es requerido', 'allowed', false);
    END IF;

    -- Obtener suscripción y plan
    SELECT p.slug, p.name, p.monthly_invoice_limit, s.status::text
    INTO v_plan_slug, v_plan_name, v_monthly_limit, v_status
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.tenant_id = p_tenant_id
    LIMIT 1;

    -- Si el tenant no tiene suscripción aún, crearle el plan free
    IF v_plan_slug IS NULL THEN
        SELECT id, slug, name, monthly_invoice_limit 
        INTO v_free_plan_id, v_plan_slug, v_plan_name, v_monthly_limit
        FROM public.plans WHERE slug = 'free' LIMIT 1;

        IF v_free_plan_id IS NOT NULL THEN
            INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, current_period_invoices)
            VALUES (p_tenant_id, v_free_plan_id, 'active', v_period_start, v_period_end, 0)
            ON CONFLICT (tenant_id) DO NOTHING;
        END IF;
    END IF;

    -- Consultar uso en el período actual
    SELECT invoices_processed INTO v_used
    FROM public.usage_periods
    WHERE tenant_id = p_tenant_id
      AND period_start = v_period_start
      AND period_end = v_period_end;

    IF v_used IS NULL THEN
        v_used := 0;
        INSERT INTO public.usage_periods (tenant_id, period_start, period_end, invoices_processed)
        VALUES (p_tenant_id, v_period_start, v_period_end, 0)
        ON CONFLICT (tenant_id, period_start, period_end) DO NOTHING;
    END IF;

    IF v_monthly_limit IS NULL THEN
        v_monthly_limit := 30;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'allowed', (v_used < v_monthly_limit AND v_status = 'active'),
        'tenant_id', p_tenant_id,
        'plan', COALESCE(v_plan_slug, 'free'),
        'plan_name', COALESCE(v_plan_name, 'Plan Free'),
        'used', v_used,
        'limit', v_monthly_limit,
        'remaining', GREATEST(0, v_monthly_limit - v_used),
        'period_start', v_period_start,
        'period_end', v_period_end,
        'status', v_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 7. FUNCIÓN DE CONSUMO ATÓMICO (consume_invoice_quota)
CREATE OR REPLACE FUNCTION public.consume_invoice_quota(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_plan_slug       TEXT;
    v_plan_name       TEXT;
    v_monthly_limit   INTEGER;
    v_period_start    TIMESTAMPTZ := DATE_TRUNC('month', NOW());
    v_period_end      TIMESTAMPTZ := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    v_new_used        INTEGER;
    v_current_used    INTEGER;
    v_status          TEXT := 'active';
    v_free_plan_id    UUID;
BEGIN
    IF p_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'allowed', false, 'error', 'Tenant ID es requerido');
    END IF;

    -- Obtener suscripción y plan activo
    SELECT p.slug, p.name, p.monthly_invoice_limit, s.status::text
    INTO v_plan_slug, v_plan_name, v_monthly_limit, v_status
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.tenant_id = p_tenant_id
    LIMIT 1;

    -- Auto-aprovisionar Free si no existe
    IF v_plan_slug IS NULL THEN
        SELECT id, slug, name, monthly_invoice_limit 
        INTO v_free_plan_id, v_plan_slug, v_plan_name, v_monthly_limit
        FROM public.plans WHERE slug = 'free' LIMIT 1;

        IF v_free_plan_id IS NOT NULL THEN
            INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, current_period_invoices)
            VALUES (p_tenant_id, v_free_plan_id, 'active', v_period_start, v_period_end, 0)
            ON CONFLICT (tenant_id) DO NOTHING;
        END IF;
    END IF;

    IF v_monthly_limit IS NULL THEN
        v_monthly_limit := 30;
    END IF;

    IF v_status != 'active' THEN
        RETURN jsonb_build_object(
            'success', false,
            'allowed', false,
            'code', 'SUBSCRIPTION_INACTIVE',
            'error', 'La suscripción de la organización no está activa (' || v_status || ').'
        );
    END IF;

    -- Asegurar que el registro del período de uso exista
    INSERT INTO public.usage_periods (tenant_id, period_start, period_end, invoices_processed)
    VALUES (p_tenant_id, v_period_start, v_period_end, 0)
    ON CONFLICT (tenant_id, period_start, period_end) DO NOTHING;

    -- INCREMENTO ATÓMICO CONDICIONAL (Evita race conditions)
    UPDATE public.usage_periods
    SET invoices_processed = invoices_processed + 1,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND period_start = v_period_start
      AND period_end = v_period_end
      AND invoices_processed < v_monthly_limit
    RETURNING invoices_processed INTO v_new_used;

    -- Si no se actualizó ninguna fila, es porque invoices_processed ya alcanzó v_monthly_limit
    IF v_new_used IS NULL THEN
        SELECT invoices_processed INTO v_current_used
        FROM public.usage_periods
        WHERE tenant_id = p_tenant_id
          AND period_start = v_period_start
          AND period_end = v_period_end;

        RETURN jsonb_build_object(
            'success', false,
            'allowed', false,
            'code', 'QUOTA_EXCEEDED',
            'message', 'Has alcanzado el límite mensual de facturas de tu plan (' || v_monthly_limit || ').',
            'plan', v_plan_slug,
            'plan_name', v_plan_name,
            'used', COALESCE(v_current_used, v_monthly_limit),
            'limit', v_monthly_limit,
            'remaining', 0,
            'period_start', v_period_start,
            'period_end', v_period_end
        );
    END IF;

    -- Sincronizar contador de periodo en la tabla de suscripciones
    UPDATE public.subscriptions
    SET current_period_invoices = v_new_used,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
        'success', true,
        'allowed', true,
        'tenant_id', p_tenant_id,
        'plan', v_plan_slug,
        'plan_name', v_plan_name,
        'used', v_new_used,
        'limit', v_monthly_limit,
        'remaining', GREATEST(0, v_monthly_limit - v_new_used),
        'period_start', v_period_start,
        'period_end', v_period_end
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. POLÍTICAS ROW LEVEL SECURITY (RLS)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura de planes activos" ON public.plans;
CREATE POLICY "Permitir lectura de planes activos" ON public.plans FOR SELECT USING (active = true);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros leen suscripcion de su tenant" ON public.subscriptions;
CREATE POLICY "Miembros leen suscripcion de su tenant" ON public.subscriptions FOR SELECT USING (public.is_tenant_member(tenant_id) OR auth.uid() IS NULL);

ALTER TABLE public.usage_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros leen uso de su tenant" ON public.usage_periods;
CREATE POLICY "Miembros leen uso de su tenant" ON public.usage_periods FOR SELECT USING (public.is_tenant_member(tenant_id) OR auth.uid() IS NULL);

