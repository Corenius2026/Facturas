// Validador estricto de seguridad para archivos de imágenes subidos
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB máximo

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: string;
}

export function validateImageBuffer(buffer: Buffer, declaredType?: string): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'El archivo está vacío o no contiene datos válidos.' };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `El archivo supera el tamaño máximo permitido de 10 MB (${(buffer.length / (1024 * 1024)).toFixed(2)} MB recibidos).`,
    };
  }

  // Validación de Magic Bytes (Firmas de encabezado binario)
  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMimeType: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMimeType: 'image/png' };
  }

  // WEBP: RIFF (bytes 0-3: 52 49 46 46) ... WEBP (bytes 8-11: 57 45 42 50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, detectedMimeType: 'image/webp' };
  }

  return {
    valid: false,
    error: 'Formato de archivo inválido. Solo se admiten imágenes reales en formato JPEG, PNG o WebP.',
  };
}
