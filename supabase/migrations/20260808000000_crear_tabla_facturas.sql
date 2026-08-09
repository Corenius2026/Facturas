-- ==============================================================================
-- MIGRACIÓN AUTOMÁTICA SUPABASE - TABLA FACTURAS MINIMARKET
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.facturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nit VARCHAR(50) NOT NULL DEFAULT 'N/A',
    fecha VARCHAR(50) NOT NULL DEFAULT 'N/A',
    subtotal VARCHAR(50) DEFAULT 'N/A',
    iva VARCHAR(50) DEFAULT 'N/A',
    total VARCHAR(50) DEFAULT 'N/A',
    texto_extraido TEXT,
    xml_content TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_facturas_nit ON public.facturas(nit);
CREATE INDEX IF NOT EXISTS idx_facturas_creado_en ON public.facturas(creado_en DESC);

-- Habilitar Row Level Security
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura e inserción
DROP POLICY IF EXISTS "Permitir lectura publica de facturas" ON public.facturas;
CREATE POLICY "Permitir lectura publica de facturas" ON public.facturas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion publica de facturas" ON public.facturas;
CREATE POLICY "Permitir insercion publica de facturas" ON public.facturas FOR INSERT WITH CHECK (true);
