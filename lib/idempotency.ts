import crypto from 'crypto';

/**
 * Calcula el hash SHA-256 del buffer de imagen optimizado recibido en el servidor.
 */
export function calculateImageHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Normaliza el número de factura para evitar discrepancias por espacios o caracteres irrelevantes
 * pero conservando prefijos alfanuméricos esenciales (ej: "BC10 - 146694" -> "BC10146694").
 */
export function normalizeInvoiceNumber(rawNumber: string | null | undefined): string | null {
  if (!rawNumber) return null;
  const trimmed = rawNumber.trim().toUpperCase();
  if (
    trimmed === '' ||
    trimmed === 'N/A' ||
    trimmed === 'NULL' ||
    trimmed === 'S/N' ||
    trimmed === 'SIN NUMERO' ||
    trimmed === 'SIN NÚMERO' ||
    trimmed.startsWith('FE-') // Si es un ID temporal generado por fallback
  ) {
    return null;
  }

  // Eliminar espacios, guiones y símbolos de puntuación no alfanuméricos
  const clean = trimmed.replace(/[^A-Z0-9]/g, '');
  return clean.length >= 2 ? clean : null;
}

/**
 * Genera la Idempotency Key contable determinista:
 * SHA-256(buyer_nit + ":" + proveedor_nit + ":" + numero_factura_normalizado)
 * Retorna null si no hay un número de factura válido para evitar falsos positivos.
 */
export function generateAccountingIdempotencyKey(
  buyerNit: string,
  proveedorNit: string,
  rawInvoiceNumber: string | null | undefined
): string | null {
  const cleanNum = normalizeInvoiceNumber(rawInvoiceNumber);
  if (!cleanNum) {
    return null;
  }

  const cleanBuyer = (buyerNit || '').replace(/[^0-9]/g, '');
  const cleanProv = (proveedorNit || '').replace(/[^0-9]/g, '');

  if (!cleanBuyer || !cleanProv) {
    return null;
  }

  const payload = `${cleanBuyer}:${cleanProv}:${cleanNum}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
