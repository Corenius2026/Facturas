-- ==============================================================================
-- ESQUEMA MAESTRO SUPABASE: ANALIZADOR DE FACTURAS (FacturaAI B2B SaaS)
-- ==============================================================================

-- 1. ENUMS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'accountant', 'viewer');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status') THEN
        CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended', 'deleted');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE public.subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');
    END IF;
END $$;

-- 2. TABLA DE TENANTS
CREATE TABLE IF NOT EXISTS public.tenants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre     TEXT NOT NULL,
    nit        TEXT UNIQUE,
    slug       TEXT UNIQUE NOT NULL,
    status     public.tenant_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_nit ON public.tenants(nit);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status) WHERE deleted_at IS NULL;

-- 3. TABLA DE PERFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    nombre     TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 4. TABLA DE MEMBRESÍAS
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role       public.user_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_user UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user ON public.tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant ON public.tenant_memberships(tenant_id);

-- 5. TABLA DE FACTURAS (Con soporte para multi-tenancy e idempotencia)
CREATE TABLE IF NOT EXISTS public.facturas (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NULL REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id          UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    proveedor_nit    VARCHAR(50) NOT NULL DEFAULT 'N/A',
    proveedor_nombre VARCHAR(200) DEFAULT NULL,
    buyer_nit        VARCHAR(50) NOT NULL DEFAULT 'N/A',
    buyer_name       VARCHAR(200) DEFAULT NULL,
    numero_factura   VARCHAR(50) DEFAULT NULL,
    fecha            DATE DEFAULT NULL,
    subtotal         NUMERIC(14,2) DEFAULT NULL,
    iva              NUMERIC(14,2) DEFAULT NULL,
    total            NUMERIC(14,2) DEFAULT NULL,
    productos        JSONB DEFAULT '[]'::jsonb,
    estado           VARCHAR(20) NOT NULL DEFAULT 'procesada',
    image_hash       VARCHAR(64) DEFAULT NULL,
    idempotency_key  VARCHAR(64) DEFAULT NULL,
    modelo_ia        VARCHAR(50) DEFAULT NULL,
    duracion_ms      INTEGER DEFAULT NULL,
    texto_extraido   TEXT DEFAULT NULL,
    xml_content      TEXT DEFAULT NULL,
    creado_en        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de facturas
CREATE INDEX IF NOT EXISTS idx_facturas_tenant_id ON public.facturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facturas_tenant_creado ON public.facturas(tenant_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_user_id ON public.facturas(user_id);
CREATE INDEX IF NOT EXISTS idx_facturas_buyer_nit ON public.facturas(buyer_nit);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON public.facturas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_creado_en ON public.facturas(creado_en DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_idempotency_unique 
    ON public.facturas(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facturas_image_hash_buyer 
    ON public.facturas(buyer_nit, image_hash) 
    WHERE image_hash IS NOT NULL;

-- 6. TABLA DE EMPRESAS
CREATE TABLE IF NOT EXISTS public.empresas (
    nit          VARCHAR(50) PRIMARY KEY,
    tenant_id    UUID NULL REFERENCES public.tenants(id) ON DELETE SET NULL,
    nombre       VARCHAR(200) NOT NULL,
    creado_en    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresas_tenant_id ON public.empresas(tenant_id);

-- 7. FUNCIONES SQL DE SEGURIDAD (Basadas en auth.uid())
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tm.tenant_id INTO v_tenant_id
    FROM public.tenant_memberships tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = auth.uid()
      AND t.deleted_at IS NULL
      AND t.status = 'active'
    ORDER BY (CASE tm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'accountant' THEN 3 ELSE 4 END), tm.created_at ASC
    LIMIT 1;

    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_tenant_member(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF check_tenant_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 
        FROM public.tenant_memberships tm
        JOIN public.tenants t ON t.id = tm.tenant_id
        WHERE tm.user_id = auth.uid()
          AND tm.tenant_id = check_tenant_id
          AND t.deleted_at IS NULL
          AND t.status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_tenant_role(check_tenant_id UUID, required_roles public.user_role[])
RETURNS BOOLEAN AS $$
BEGIN
    IF check_tenant_id IS NULL OR required_roles IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 
        FROM public.tenant_memberships tm
        JOIN public.tenants t ON t.id = tm.tenant_id
        WHERE tm.user_id = auth.uid()
          AND tm.tenant_id = check_tenant_id
          AND tm.role = ANY(required_roles)
          AND t.deleted_at IS NULL
          AND t.status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 8. TRIGGER EN auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_tenant_id UUID;
    user_name     TEXT;
    company_name  TEXT;
    base_slug     TEXT;
BEGIN
    user_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'nombre'), ''),
        SPLIT_PART(NEW.email, '@', 1)
    );

    company_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
        'Organización de ' || user_name
    );

    base_slug := 'org-' || LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9]', '', 'g')) || '-' || SUBSTRING(NEW.id::text, 1, 6);

    INSERT INTO public.profiles (id, email, nombre, created_at, updated_at)
    VALUES (NEW.id, NEW.email, user_name, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email, nombre = COALESCE(EXCLUDED.nombre, public.profiles.nombre), updated_at = NOW();

    INSERT INTO public.tenants (id, nombre, nit, slug, status, created_at)
    VALUES (
        gen_random_uuid(),
        company_name,
        NULLIF(TRIM(NEW.raw_user_meta_data->>'nit'), ''),
        base_slug,
        'active',
        NOW()
    )
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO new_tenant_id;

    IF new_tenant_id IS NULL THEN
        SELECT id INTO new_tenant_id FROM public.tenants WHERE slug = base_slug LIMIT 1;
    END IF;

    IF new_tenant_id IS NULL THEN
        INSERT INTO public.tenants (id, nombre, nit, slug, status, created_at)
        VALUES (
            gen_random_uuid(),
            company_name,
            NULL,
            'org-' || NEW.id::text,
            'active',
            NOW()
        )
        ON CONFLICT (slug) DO NOTHING
        RETURNING id INTO new_tenant_id;

        IF new_tenant_id IS NULL THEN
            SELECT id INTO new_tenant_id FROM public.tenants WHERE slug = ('org-' || NEW.id::text) LIMIT 1;
        END IF;
    END IF;

    IF new_tenant_id IS NOT NULL THEN
        INSERT INTO public.tenant_memberships (tenant_id, user_id, role, created_at)
        VALUES (new_tenant_id, NEW.id, 'owner', NOW())
        ON CONFLICT (tenant_id, user_id) DO NOTHING;

        -- Auto-asignar suscripción en plan Free
        INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, current_period_invoices)
        SELECT new_tenant_id, p.id, 'active', DATE_TRUNC('month', NOW()), DATE_TRUNC('month', NOW() + INTERVAL '1 month'), 0
        FROM public.plans p WHERE p.slug = 'free' LIMIT 1
        ON CONFLICT (tenant_id) DO NOTHING;

        -- Crear período de uso inicial
        INSERT INTO public.usage_periods (tenant_id, period_start, period_end, invoices_processed)
        VALUES (new_tenant_id, DATE_TRUNC('month', NOW()), DATE_TRUNC('month', NOW() + INTERVAL '1 month'), 0)
        ON CONFLICT (tenant_id, period_start, period_end) DO NOTHING;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error en handle_new_user para user_id %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 9. TABLAS DE PLANES, SUSCRIPCIONES Y CONSUMO ATÓMICO (Etapa 4A)
-- ==============================================================================

-- 9.1 TABLA DE PLANES
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

-- Seed de los 4 Planes
INSERT INTO public.plans (slug, name, monthly_invoice_limit, price_cop, allow_2fa, allow_batch_export, features, active)
VALUES 
  ('free', 'Plan Free', 30, 0, false, false, '{"description": "Ideal para pruebas", "support": "comunidad"}'::jsonb, true),
  ('starter', 'Plan Starter', 200, 49000, false, true, '{"description": "Volumen moderado", "support": "email"}'::jsonb, true),
  ('pro', 'Plan Pro', 1000, 149000, true, true, '{"description": "Empresas y contadores", "support": "prioritario"}'::jsonb, true),
  ('enterprise', 'Plan Enterprise', 50000, 490000, true, true, '{"description": "Corporativo ilimitado", "support": "dedicado 24/7"}'::jsonb, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_invoice_limit = EXCLUDED.monthly_invoice_limit,
  price_cop = EXCLUDED.price_cop,
  allow_2fa = EXCLUDED.allow_2fa,
  allow_batch_export = EXCLUDED.allow_batch_export,
  features = EXCLUDED.features,
  active = EXCLUDED.active,
  updated_at = NOW();

-- 9.2 TABLA DE SUSCRIPCIONES
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

-- 9.3 TABLA DE PERIODOS DE CONSUMO
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

-- 9.4 FUNCIONES DE CUOTAS
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

    SELECT p.slug, p.name, p.monthly_invoice_limit, s.status::text
    INTO v_plan_slug, v_plan_name, v_monthly_limit, v_status
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.tenant_id = p_tenant_id
    LIMIT 1;

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

    SELECT p.slug, p.name, p.monthly_invoice_limit, s.status::text
    INTO v_plan_slug, v_plan_name, v_monthly_limit, v_status
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.tenant_id = p_tenant_id
    LIMIT 1;

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

    INSERT INTO public.usage_periods (tenant_id, period_start, period_end, invoices_processed)
    VALUES (p_tenant_id, v_period_start, v_period_end, 0)
    ON CONFLICT (tenant_id, period_start, period_end) DO NOTHING;

    -- INCREMENTO ATÓMICO CONDICIONAL
    UPDATE public.usage_periods
    SET invoices_processed = invoices_processed + 1,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND period_start = v_period_start
      AND period_end = v_period_end
      AND invoices_processed < v_monthly_limit
    RETURNING invoices_processed INTO v_new_used;

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

-- 9. POLÍTICAS RLS TRANSICIONALES (Compatibilidad Etapa 1)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Políticas de transición para perfiles y memberships
DROP POLICY IF EXISTS "Usuarios leen su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios leen su propio perfil" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuarios editan su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios editan su propio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Miembros leen sus tenants" ON public.tenants;
CREATE POLICY "Miembros leen sus tenants" ON public.tenants FOR SELECT USING (public.is_tenant_member(id) OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Miembros leen sus memberships" ON public.tenant_memberships;
CREATE POLICY "Miembros leen sus memberships" ON public.tenant_memberships FOR SELECT USING (user_id = auth.uid());

-- Políticas transicionales para facturas y empresas (preservan funcionalidad mientras se avanza a Etapa 6)
DROP POLICY IF EXISTS "Permitir lectura publica de facturas" ON public.facturas;
CREATE POLICY "Permitir lectura publica de facturas" ON public.facturas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion publica de facturas" ON public.facturas;
CREATE POLICY "Permitir insercion publica de facturas" ON public.facturas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion publica de facturas" ON public.facturas;
CREATE POLICY "Permitir eliminacion publica de facturas" ON public.facturas FOR DELETE USING (true);

DROP POLICY IF EXISTS "Permitir lectura publica de empresas" ON public.empresas;
CREATE POLICY "Permitir lectura publica de empresas" ON public.empresas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion y actualizacion publica de empresas" ON public.empresas;
CREATE POLICY "Permitir insercion y actualizacion publica de empresas" ON public.empresas FOR ALL USING (true);
