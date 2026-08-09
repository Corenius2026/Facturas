-- ==============================================================================
-- MINIMARKET POS & INVOICE MANAGEMENT - TABLAS SUPABASE
-- ==============================================================================

-- 1. Tabla de Facturas de Proveedores (Historial de Compras)
CREATE TABLE IF NOT EXISTS facturas (
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

-- 2. Índices para consultas ultra rápidas por NIT o Fecha
CREATE INDEX IF NOT EXISTS idx_facturas_nit ON facturas(nit);
CREATE INDEX IF NOT EXISTS idx_facturas_creado_en ON facturas(creado_en DESC);

-- 3. Habilitar seguridad a nivel de filas (RLS - Row Level Security)
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

-- Política de acceso abierto para lectura e inserción con la API Key pública (Anon Key)
CREATE POLICY "Permitir lectura publica de facturas" ON facturas FOR SELECT USING (true);
CREATE POLICY "Permitir insercion publica de facturas" ON facturas FOR INSERT WITH CHECK (true);
