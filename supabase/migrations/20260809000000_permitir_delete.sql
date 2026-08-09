-- ==============================================================================
-- MIGRACIÓN SUPABASE: PERMITIR ELIMINACIÓN DE FACTURAS EN RLS
-- ==============================================================================

-- Habilitar política de eliminación pública
DROP POLICY IF EXISTS "Permitir eliminacion publica de facturas" ON public.facturas;
CREATE POLICY "Permitir eliminacion publica de facturas" ON public.facturas FOR DELETE USING (true);
