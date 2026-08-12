// Optimizador de imágenes en el cliente (Browser-side Canvas & EXIF aware)
// Reduce fotografías de facturas de 4-12 MB a ~200-500 KB preservando nitidez OCR para Gemini AI

export interface ImageOptimizationStats {
  originalSize: number;
  optimizedSize: number;
  originalWidth: number;
  originalHeight: number;
  finalWidth: number;
  finalHeight: number;
  reductionPercentage: number;
  durationMs: number;
}

export interface ImageOptimizationResult {
  file: File;
  stats: ImageOptimizationStats;
}

export async function optimizeInvoiceImage(
  file: File,
  maxDimension: number = 1800,
  quality: number = 0.84
): Promise<ImageOptimizationResult> {
  const startTime = performance.now();
  const originalSize = file.size;

  // Si no estamos en entorno de navegador, devolver el archivo original
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      file,
      stats: {
        originalSize,
        optimizedSize: originalSize,
        originalWidth: 0,
        originalHeight: 0,
        finalWidth: 0,
        finalHeight: 0,
        reductionPercentage: 0,
        durationMs: 0,
      },
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;

      // Si la imagen ya es pequeña en dimensiones y en peso (< 500 KB), mantenerla para no degradar
      if (
        originalWidth <= maxDimension &&
        originalHeight <= maxDimension &&
        originalSize <= 500 * 1024
      ) {
        const durationMs = Math.round(performance.now() - startTime);
        resolve({
          file,
          stats: {
            originalSize,
            optimizedSize: originalSize,
            originalWidth,
            originalHeight,
            finalWidth: originalWidth,
            finalHeight: originalHeight,
            reductionPercentage: 0,
            durationMs,
          },
        });
        return;
      }

      // Calcular nuevas dimensiones conservando la relación de aspecto
      let targetWidth = originalWidth;
      let targetHeight = originalHeight;

      if (originalWidth > originalHeight) {
        if (originalWidth > maxDimension) {
          targetHeight = Math.round((originalHeight * maxDimension) / originalWidth);
          targetWidth = maxDimension;
        }
      } else {
        if (originalHeight > maxDimension) {
          targetWidth = Math.round((originalWidth * maxDimension) / originalHeight);
          targetHeight = maxDimension;
        }
      }

      // Renderizar en Canvas con alta calidad de interpolación
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (!ctx) {
        resolve({
          file,
          stats: {
            originalSize,
            optimizedSize: originalSize,
            originalWidth,
            originalHeight,
            finalWidth: originalWidth,
            finalHeight: originalHeight,
            reductionPercentage: 0,
            durationMs: Math.round(performance.now() - startTime),
          },
        });
        return;
      }

      // Fondo blanco para prevenir transparencias negras en facturas PNG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Comprimir a JPEG con calidad calibrada para OCR
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              file,
              stats: {
                originalSize,
                optimizedSize: originalSize,
                originalWidth,
                originalHeight,
                finalWidth: targetWidth,
                finalHeight: targetHeight,
                reductionPercentage: 0,
                durationMs: Math.round(performance.now() - startTime),
              },
            });
            return;
          }

          const optimizedSize = blob.size;
          // Si por alguna razón el blob resultó más pesado, conservar original
          if (optimizedSize >= originalSize && originalSize <= 1024 * 1024) {
            resolve({
              file,
              stats: {
                originalSize,
                optimizedSize: originalSize,
                originalWidth,
                originalHeight,
                finalWidth: originalWidth,
                finalHeight: originalHeight,
                reductionPercentage: 0,
                durationMs: Math.round(performance.now() - startTime),
              },
            });
            return;
          }

          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const optimizedFile = new File([blob], `${baseName}_opt.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          const durationMs = Math.round(performance.now() - startTime);
          const reductionPercentage = Math.round(
            ((originalSize - optimizedSize) / originalSize) * 100
          );

          console.log(
            `[ImageOptimizer] ${file.name}: ${(originalSize / 1024).toFixed(1)} KB (${originalWidth}x${originalHeight}) -> ${(optimizedSize / 1024).toFixed(1)} KB (${targetWidth}x${targetHeight}) [-${reductionPercentage}%] en ${durationMs}ms`
          );

          resolve({
            file: optimizedFile,
            stats: {
              originalSize,
              optimizedSize,
              originalWidth,
              originalHeight,
              finalWidth: targetWidth,
              finalHeight: targetHeight,
              reductionPercentage: Math.max(0, reductionPercentage),
              durationMs,
            },
          });
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo cargar la imagen para optimización.'));
    };

    img.src = objectUrl;
  });
}
