-- ==============================================================================
-- ESQUEMA MAESTRO SUPABASE: ANALIZADOR DE FACTURAS (ETAPA 4 - IDEMPOTENCIA Y CONTROL DE COSTOS)
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
    image_hash       VARCHAR(64) DEFAULT NULL,
    idempotency_key  VARCHAR(64) DEFAULT NULL,
    modelo_ia        VARCHAR(50) DEFAULT NULL,
    duracion_ms      INTEGER DEFAULT NULL,
    texto_extraido   TEXT DEFAULT NULL,
    xml_content      TEXT DEFAULT NULL,
    creado_en        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de consulta rápida y control de duplicados
CREATE INDEX IF NOT EXISTS idx_facturas_buyer_nit ON public.facturas(buyer_nit);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON public.facturas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_creado_en ON public.facturas(creado_en DESC);

-- Índice único parcial para prevención de facturas duplicadas
CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_idempotency_unique 
    ON public.facturas(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- Índice para búsqueda de imágenes ya procesadas (Pre-IA bypass)
CREATE INDEX IF NOT EXISTS idx_facturas_image_hash_buyer 
    ON public.facturas(buyer_nit, image_hash) 
    WHERE image_hash IS NOT NULL;

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Permitir lectura publica de facturas" ON public.facturas;
CREATE POLICY "Permitir lectura publica de facturas" ON public.facturas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion publica de facturas" ON public.facturas;
CREATE POLICY "Permitir insercion publica de facturas" ON public.facturas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion publica de facturas" ON public.facturas;
CREATE POLICY "Permitir eliminacion publica de facturas" ON public.facturas FOR DELETE USING (true);

-- ==============================================================================
-- TABLA DE EMPRESAS (PERSISTENCIA MULTI-DISPOSITIVO)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.empresas (
    nit          VARCHAR(50) PRIMARY KEY,
    nombre       VARCHAR(200) NOT NULL,
    creado_en    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para empresas
DROP POLICY IF EXISTS "Permitir lectura publica de empresas" ON public.empresas;
CREATE POLICY "Permitir lectura publica de empresas" ON public.empresas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion y actualizacion publica de empresas" ON public.empresas;
CREATE POLICY "Permitir insercion y actualizacion publica de empresas" ON public.empresas FOR ALL USING (true);
