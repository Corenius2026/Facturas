-- ==============================================================================
-- MIGRACIÓN DE ETAPA 1: ARQUITECTURA BASE DE USUARIOS Y MULTI-TENANCY (FacturaAI)
-- ==============================================================================

-- 1. ENUMS (Creación idempotente segura)
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

-- 2. TABLA DE TENANTS (Organizaciones / Empresas Principales)
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

-- 3. TABLA DE PERFILES (Vinculada 1:1 a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    nombre     TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 4. TABLA DE MEMBRESÍAS / ROLES EN TENANTS
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

-- 5. MODIFICACIÓN NO DESTRUCTIVA: FACTURAS (Columnas tenant_id y user_id NULLABLES)
ALTER TABLE public.facturas
    ADD COLUMN IF NOT EXISTS tenant_id UUID NULL REFERENCES public.tenants(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS user_id   UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_tenant_id ON public.facturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facturas_tenant_creado ON public.facturas(tenant_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_user_id ON public.facturas(user_id);

-- 6. MODIFICACIÓN NO DESTRUCTIVA: EMPRESAS
ALTER TABLE public.empresas
    ADD COLUMN IF NOT EXISTS tenant_id UUID NULL REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_empresas_tenant_id ON public.empresas(tenant_id);

-- 7. FUNCIONES SQL DE SEGURIDAD (Basadas en auth.uid())
-- 7.1 Obtener el tenant_id principal del usuario autenticado
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

-- 7.2 Verificar si el usuario autenticado pertenece a un tenant específico
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

-- 7.3 Verificar si el usuario autenticado tiene uno de los roles requeridos en un tenant
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

-- 8. TRIGGER AUTOMÁTICO EN auth.users
-- Crea Profile, Tenant inicial y Asignación de rol 'owner' al registrarse un nuevo usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_tenant_id UUID;
    user_name     TEXT;
    company_name  TEXT;
    base_slug     TEXT;
BEGIN
    -- 1. Extraer o inferir nombre de usuario y nombre de empresa
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

    -- 2. Crear Profile en public.profiles
    INSERT INTO public.profiles (id, email, nombre, created_at, updated_at)
    VALUES (NEW.id, NEW.email, user_name, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email, nombre = COALESCE(EXCLUDED.nombre, public.profiles.nombre), updated_at = NOW();

    -- 3. Crear Tenant inicial
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

    -- Si por colisión de slug no se insertó, recuperar tenant existente o generar uno con UUID completo
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
        RETURNING id INTO new_tenant_id;
    END IF;

    -- 4. Asignar membresía con rol 'owner'
    IF new_tenant_id IS NOT NULL THEN
        INSERT INTO public.tenant_memberships (tenant_id, user_id, role, created_at)
        VALUES (new_tenant_id, NEW.id, 'owner', NOW())
        ON CONFLICT (tenant_id, user_id) DO NOTHING;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Resiliencia: registrar advertencia pero no abortar la creación del usuario en Auth
    RAISE WARNING 'Error en handle_new_user para user_id %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asociar el trigger a auth.users si no existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
