-- ==============================================================================
-- ESQUEMA MAESTRO SUPABASE: ANALIZADOR DE FACTURAS (ETAPA 3)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.facturas (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    texto_extraido   TEXT DEFAULT NULL,
    xml_content      TEXT DEFAULT NULL,
    creado_en        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_facturas_buyer_nit ON public.facturas(buyer_nit);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON public.facturas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_creado_en ON public.facturas(creado_en DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Permitir lectura publica de facturas" ON public.facturas;
CREATE POLICY "Permitir lectura publica de facturas" ON public.facturas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion publica de facturas" ON public.facturas;
CREATE POLICY "Permitir insercion publica de facturas" ON public.facturas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion publica de facturas" ON public.facturas;
CREATE POLICY "Permitir eliminacion publica de facturas" ON public.facturas FOR DELETE USING (true);
