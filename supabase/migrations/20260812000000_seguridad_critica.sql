-- ==============================================================================
-- MIGRACIÓN DE SEGURIDAD CRÍTICA - AUDITORÍA Y POLÍTICAS RLS SUPABASE
-- ==============================================================================

-- 1. Asegurar habilitación de RLS en la tabla facturas
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

-- 2. Revocar permisos directos anónimos sobre la tabla pública
REVOKE ALL ON public.facturas FROM anon;
GRANT SELECT, INSERT, DELETE ON public.facturas TO anon, authenticated, service_role;

-- 3. Índices de aceleración para filtrado por empresa
CREATE INDEX IF NOT EXISTS idx_facturas_texto_extraido ON public.facturas USING gin(to_tsvector('spanish', coalesce(texto_extraido, '')));
