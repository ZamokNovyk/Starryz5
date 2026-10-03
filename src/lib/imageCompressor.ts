/**
 * imageCompressor.ts
 * Motor de compresión y recorte de avatares para Starryz 5.
 * 
 * Reglas de negocio:
 * 1. Límite máximo de subida original: 5 MB (5 * 1024 * 1024 bytes).
 * 2. Peso final comprimido: Máximo 100 KB y Mínimo 90 KB (siempre que el detalle de la imagen lo permita).
 * 3. Formato de salida: WebP de ultra alta fidelidad (compatible con todos los navegadores modernos).
 */

export interface CompressionResult {
  blob: Blob;
  base64: string;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  width: number;
  height: number;
  format: 'image/webp' | 'image/jpeg';
}

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const TARGET_MAX_BYTES = 100 * 1024; // 100 KB (102,400 bytes)
export const TARGET_MIN_BYTES = 90 * 1024;  // 90 KB (92,160 bytes)

/**
 * Valida el archivo seleccionado antes de procesarlo
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo.' };
  }

  if (!file.type.startsWith('image/')) {
    return { 
      valid: false, 
      error: 'Formato no soportado. Por favor selecciona una imagen válida (JPG, PNG, WebP o GIF).' 
    };
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return { 
      valid: false, 
      error: `La foto seleccionada pesa ${sizeMb} MB. El límite máximo de subida permitido es de 5 MB.` 
    };
  }

  return { valid: true };
}

/**
 * Carga un File en un elemento Image
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Renderiza un recorte cuadrado central en un canvas con resolución dada
 */
function renderSquareCropToCanvas(
  img: HTMLImageElement, 
  dimension: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = dimension;
  canvas.height = dimension;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('No se pudo obtener el contexto 2D de Canvas');

  // Suavizado de imagen de alta calidad
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Recorte 1:1 centrado
  const minSide = Math.min(img.width, img.height);
  const sx = (img.width - minSide) / 2;
  const sy = (img.height - minSide) / 2;

  ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, dimension, dimension);
  return canvas;
}

/**
 * Convierte un canvas a Blob WebP con una calidad específica
 */
function canvasToBlob(canvas: HTMLCanvasElement, quality: number, format: 'image/webp' | 'image/jpeg' = 'image/webp'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Error al generar Blob'));
      },
      format,
      quality
    );
  });
}

/**
 * Convierte un Blob a base64 Data URL
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Algoritmo iterativo inteligente para ajustar el peso entre 90 KB y 100 KB
 */
export async function compressAvatarToTarget(file: File): Promise<CompressionResult> {
  const validation = validateAvatarFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const img = await loadImage(file);
  const originalSize = file.size;

  // Soporte de formato: Preferir WebP, fallback a JPEG si el navegador no soporta exportación WebP
  let format: 'image/webp' | 'image/jpeg' = 'image/webp';
  const testCanvas = document.createElement('canvas');
  testCanvas.width = 1;
  testCanvas.height = 1;
  if (!testCanvas.toDataURL('image/webp').startsWith('data:image/webp')) {
    format = 'image/jpeg';
  }

  // Dimensiones iniciales y rangos de búsqueda
  let currentDim = 640;
  let bestBlob: Blob | null = null;
  let bestQuality = 0.90;
  let bestDim = currentDim;

  // Búsqueda en 2 fases:
  // Fase 1: Calibrar resolución óptima (entre 500 y 1000 px) y calidad (entre 0.65 y 0.98)
  const candidateConfigs = [
    { dim: 650, quality: 0.92 },
    { dim: 650, quality: 0.88 },
    { dim: 650, quality: 0.82 },
    { dim: 600, quality: 0.80 },
    { dim: 750, quality: 0.94 },
    { dim: 850, quality: 0.95 },
    { dim: 550, quality: 0.75 },
    { dim: 500, quality: 0.70 },
    { dim: 900, quality: 0.96 },
  ];

  let closestUnder100: { blob: Blob; size: number; dim: number } | null = null;

  for (const cfg of candidateConfigs) {
    const canvas = renderSquareCropToCanvas(img, cfg.dim);
    const blob = await canvasToBlob(canvas, cfg.quality, format);

    // Caso ideal: cae exactamente entre 90 KB y 100 KB
    if (blob.size >= TARGET_MIN_BYTES && blob.size <= TARGET_MAX_BYTES) {
      bestBlob = blob;
      bestDim = cfg.dim;
      break;
    }

    // Registrar el mejor candidato que no supere los 100 KB
    if (blob.size <= TARGET_MAX_BYTES) {
      if (!closestUnder100 || blob.size > closestUnder100.size) {
        closestUnder100 = { blob, size: blob.size, dim: cfg.dim };
      }
    }
  }

  // Si no cayó directamente en el rango 90-100 KB, realizamos ajuste fino
  if (!bestBlob) {
    if (closestUnder100 && closestUnder100.size < TARGET_MIN_BYTES) {
      // El archivo es menor a 90 KB: Aumentamos la resolución y calidad para darle máxima definición
      // y acercarlo lo más posible a 90-100 KB sin pasarse de 100 KB
      let fineDim = Math.min(1200, Math.round(closestUnder100.dim * 1.3));
      let fineQ = 0.96;
      let fineCanvas = renderSquareCropToCanvas(img, fineDim);
      let fineBlob = await canvasToBlob(fineCanvas, fineQ, format);

      if (fineBlob.size <= TARGET_MAX_BYTES) {
        bestBlob = fineBlob;
        bestDim = fineDim;
      } else {
        // Reducir levemente la calidad para no sobrepasar los 100 KB
        for (let q = 0.94; q >= 0.70; q -= 0.04) {
          fineBlob = await canvasToBlob(fineCanvas, q, format);
          if (fineBlob.size <= TARGET_MAX_BYTES) {
            bestBlob = fineBlob;
            bestDim = fineDim;
            break;
          }
        }
      }
    } else {
      // El archivo era mayor a 100 KB: Búsqueda binaria de calidad hacia abajo
      let lowQ = 0.50;
      let highQ = 0.95;
      let safeCanvas = renderSquareCropToCanvas(img, 560);
      bestDim = 560;

      for (let i = 0; i < 6; i++) {
        const midQ = (lowQ + highQ) / 2;
        const b = await canvasToBlob(safeCanvas, midQ, format);
        if (b.size > TARGET_MAX_BYTES) {
          highQ = midQ;
        } else {
          bestBlob = b;
          if (b.size >= TARGET_MIN_BYTES) {
            break;
          }
          lowQ = midQ;
        }
      }
    }
  }

  // Fallback de seguridad estricto: Si por algún motivo aún no hay blob o superó 100KB
  if (!bestBlob || bestBlob.size > TARGET_MAX_BYTES) {
    const fallbackCanvas = renderSquareCropToCanvas(img, 500);
    bestBlob = await canvasToBlob(fallbackCanvas, 0.75, format);
    bestDim = 500;
  }

  const base64 = await blobToBase64(bestBlob);
  const compressedSize = bestBlob.size;
  const savingsPercent = Math.max(0, Number((((originalSize - compressedSize) / originalSize) * 100).toFixed(1)));

  return {
    blob: bestBlob,
    base64,
    originalSize,
    compressedSize,
    savingsPercent,
    width: bestDim,
    height: bestDim,
    format
  };
}
