-- ==============================================================================
-- MIGRACIÓN DE ETAPA 3: BASE DE DATOS Y NORMALIZACIÓN SEGURA DE FACTURAS
-- ==============================================================================

-- 1. Función inmutable estricta para moneda colombiana (COP)
-- Regla: Si el valor es inválido o no reconocido, retorna NULL (NUNCA 0.00)
CREATE OR REPLACE FUNCTION public.parse_colombian_currency_strict(val text) 
RETURNS numeric(14,2) AS $$
DECLARE
    raw text;
    cleaned text;
    parts text[];
    comma_parts text[];
    int_parts text[];
    i int;
BEGIN
    IF val IS NULL THEN
        RETURN NULL;
    END IF;

    raw := TRIM(val);
    IF raw = '' OR raw ILIKE 'N/A' OR raw ILIKE 'NULL' THEN
        RETURN NULL;
    END IF;

    -- Eliminar signos de pesos, espacios y cualquier caracter no numérico excepto punto, coma y menos
    cleaned := REGEXP_REPLACE(raw, '[^0-9.,-]', '', 'g');

    IF cleaned IS NULL OR cleaned = '' OR cleaned = '-' OR cleaned = '.' OR cleaned = ',' THEN
        RETURN NULL;
    END IF;

    -- Caso A: Coma como separador decimal (ej: 296.940,50)
    IF POSITION(',' IN cleaned) > 0 THEN
        comma_parts := STRING_TO_ARRAY(cleaned, ',');
        IF ARRAY_LENGTH(comma_parts, 1) <> 2 OR LENGTH(comma_parts[2]) > 2 THEN
            RETURN NULL;
        END IF;

        int_parts := STRING_TO_ARRAY(comma_parts[1], '.');
        IF ARRAY_LENGTH(int_parts, 1) > 1 THEN
            FOR i IN 2..ARRAY_LENGTH(int_parts, 1) LOOP
                IF LENGTH(int_parts[i]) <> 3 THEN
                    RETURN NULL;
                END IF;
            END LOOP;
        END IF;

        cleaned := REPLACE(comma_parts[1], '.', '') || '.' || comma_parts[2];
        RETURN cleaned::numeric(14,2);
    END IF;

    -- Caso B: Solo Puntos
    parts := STRING_TO_ARRAY(cleaned, '.');

    -- Múltiples puntos: todos son miles y cada grupo tras el primero debe tener 3 dígitos (ej: 1.250.000)
    IF ARRAY_LENGTH(parts, 1) > 2 THEN
        FOR i IN 2..ARRAY_LENGTH(parts, 1) LOOP
            IF LENGTH(parts[i]) <> 3 THEN
                RETURN NULL;
            END IF;
        END LOOP;
        cleaned := ARRAY_TO_STRING(parts, '');
        RETURN cleaned::numeric(14,2);

    -- Un solo punto
    ELSIF ARRAY_LENGTH(parts, 1) = 2 THEN
        IF LENGTH(parts[2]) = 3 THEN
            -- 3 dígitos a la derecha -> separador de miles colombiano (ej: 296.940 -> 296940)
            cleaned := parts[1] || parts[2];
            RETURN cleaned::numeric(14,2);
        ELSIF LENGTH(parts[2]) = 1 OR LENGTH(parts[2]) = 2 THEN
            -- 1 o 2 dígitos -> punto decimal internacional (ej: 296940.50)
            RETURN cleaned::numeric(14,2);
        ELSE
            -- Longitud anómala distinta de 1, 2 o 3 -> formato corrupto
            RETURN NULL;
        END IF;
    END IF;

    -- Caso C: Dígitos puros (ej: 266940) o valor 0
    RETURN cleaned::numeric(14,2);

EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Función inmutable estricta para fechas
-- Regla: Si la fecha es inválida o no reconocida, retorna NULL
CREATE OR REPLACE FUNCTION public.parse_flexible_date_strict(val text)
RETURNS date AS $$
DECLARE
    cleaned text;
BEGIN
    IF val IS NULL THEN
        RETURN NULL;
    END IF;

    cleaned := TRIM(val);
    IF cleaned = '' OR cleaned ILIKE 'N/A' OR cleaned ILIKE 'NULL' THEN
        RETURN NULL;
    END IF;

    -- YYYY-MM-DD (Estándar ISO)
    IF cleaned ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$' THEN
        RETURN TO_DATE(cleaned, 'YYYY-MM-DD');
    -- DD/MM/YYYY
    ELSIF cleaned ~ '^(0[1-9]|[12]\d|3[01])/(0[1-9]|1[0-2])/\d{4}$' THEN
        RETURN TO_DATE(cleaned, 'DD/MM/YYYY');
    -- DD-MM-YYYY
    ELSIF cleaned ~ '^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$' THEN
        RETURN TO_DATE(cleaned, 'DD-MM-YYYY');
    -- YYYY/MM/DD
    ELSIF cleaned ~ '^\d{4}/(0[1-9]|1[0-2])/(0[1-9]|[12]\d|3[01])$' THEN
        RETURN TO_DATE(cleaned, 'YYYY/MM/DD');
    END IF;

    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1.1 Función sobrecargada para valores que ya son de tipo numeric
CREATE OR REPLACE FUNCTION public.parse_colombian_currency_strict(val numeric)
RETURNS numeric(14,2) AS $$
BEGIN
    RETURN val::numeric(14,2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2.1 Función sobrecargada para valores que ya son de tipo date
CREATE OR REPLACE FUNCTION public.parse_flexible_date_strict(val date)
RETURNS date AS $$
BEGIN
    RETURN val;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Renombrar nit -> proveedor_nit y agregar nuevas columnas requeridas
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'facturas' AND column_name = 'nit'
    ) THEN
        ALTER TABLE public.facturas RENAME COLUMN nit TO proveedor_nit;
    END IF;
END $$;

ALTER TABLE public.facturas
    ADD COLUMN IF NOT EXISTS proveedor_nombre VARCHAR(200) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS buyer_nit        VARCHAR(20)  NOT NULL DEFAULT 'N/A',
    ADD COLUMN IF NOT EXISTS buyer_name       VARCHAR(200) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS numero_factura   VARCHAR(50)  DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS estado           VARCHAR(20)  NOT NULL DEFAULT 'procesada',
    ADD COLUMN IF NOT EXISTS productos        JSONB        DEFAULT '[]'::jsonb;

-- 4. Eliminar restricciones DEFAULT y NOT NULL antiguas de tipo VARCHAR ('N/A') para permitir conversión de tipo
ALTER TABLE public.facturas
    ALTER COLUMN fecha DROP DEFAULT,
    ALTER COLUMN fecha DROP NOT NULL,
    ALTER COLUMN subtotal DROP DEFAULT,
    ALTER COLUMN iva DROP DEFAULT,
    ALTER COLUMN total DROP DEFAULT;

-- 5. Conversión segura de tipos de datos a DATE y NUMERIC(14,2) con casteo explícito ::text
ALTER TABLE public.facturas
    ALTER COLUMN fecha TYPE DATE USING public.parse_flexible_date_strict(fecha::text),
    ALTER COLUMN subtotal TYPE NUMERIC(14,2) USING public.parse_colombian_currency_strict(subtotal::text),
    ALTER COLUMN iva TYPE NUMERIC(14,2) USING public.parse_colombian_currency_strict(iva::text),
    ALTER COLUMN total TYPE NUMERIC(14,2) USING public.parse_colombian_currency_strict(total::text);

-- 6. Establecer los nuevos valores DEFAULT apropiados para tipos numéricos y fecha
ALTER TABLE public.facturas
    ALTER COLUMN fecha SET DEFAULT NULL,
    ALTER COLUMN subtotal SET DEFAULT NULL,
    ALTER COLUMN iva SET DEFAULT NULL,
    ALTER COLUMN total SET DEFAULT NULL;

-- 7. Backfill seguro de metadatos históricos desde XML UBL 2.1 y texto extraído
UPDATE public.facturas
SET 
    buyer_nit = COALESCE(
        NULLIF(SUBSTRING(texto_extraido FROM '\[NIT_COMPRADOR:([0-9]+)\]'), ''),
        NULLIF(SUBSTRING(xml_content FROM '<cac:ReceiverParty>[\s\S]*?<cbc:CompanyID[^>]*>([0-9]+)</cbc:CompanyID>'), ''),
        buyer_nit
    ),
    buyer_name = COALESCE(
        NULLIF(SUBSTRING(xml_content FROM '<cac:ReceiverParty>[\s\S]*?<cbc:RegistrationName>([^<]+)</cbc:RegistrationName>'), ''),
        buyer_name
    ),
    proveedor_nombre = COALESCE(
        NULLIF(SUBSTRING(xml_content FROM '<cac:AccountingSupplierParty>[\s\S]*?<cbc:RegistrationName>([^<]+)</cbc:RegistrationName>'), ''),
        proveedor_nombre
    ),
    numero_factura = COALESCE(
        NULLIF(SUBSTRING(xml_content FROM '<cbc:ID>([^<]+)</cbc:ID>'), ''),
        numero_factura
    )
WHERE xml_content IS NOT NULL;

-- 8. Creación de índices optimizados requeridos
CREATE INDEX IF NOT EXISTS idx_facturas_buyer_nit ON public.facturas(buyer_nit);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON public.facturas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_creado_en ON public.facturas(creado_en DESC);
