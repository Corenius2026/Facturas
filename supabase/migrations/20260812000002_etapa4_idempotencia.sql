-- ==============================================================================
-- MIGRACIÓN DE ETAPA 4: IDEMPOTENCIA, CONTROL DE COSTOS Y PREVENCIÓN DE DUPLICADOS
-- ==============================================================================

-- 1. Agregar columnas para hash de imagen, clave contable y métricas de costos
ALTER TABLE public.facturas
    ADD COLUMN IF NOT EXISTS image_hash       VARCHAR(64)  DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS idempotency_key  VARCHAR(64)  DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS modelo_ia        VARCHAR(50)  DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS duracion_ms      INTEGER      DEFAULT NULL;

-- 2. Índice único parcial para Idempotency Key contable
-- Solo restringe registros que tengan una clave contable válida calculada (ignora NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_idempotency_unique 
    ON public.facturas(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- 3. Índice compuesto para búsqueda instantánea por Hash de imagen y Empresa compradora (Pre-Gemini)
CREATE INDEX IF NOT EXISTS idx_facturas_image_hash_buyer 
    ON public.facturas(buyer_nit, image_hash) 
    WHERE image_hash IS NOT NULL;
