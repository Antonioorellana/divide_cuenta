import { parseReceiptText } from "../domain/receipt-parser";
import {
  reconcileReceiptReadings,
  selectReconciledReading,
} from "../domain/receipt-reconciliation";
import type { ReceiptDraft } from "../domain/receipt-reconciliation";

const MAX_OCR_DIMENSION = 2400;
const MIN_OCR_DIMENSION = 1800;
const WIDE_OCR_DIMENSION = 1792;
const WIDE_CHARACTER_SCALE = 2.3;
const MAX_UPSCALE = 2;
const NORMALIZATION_LOW_PERCENTILE = 0.01;
const NORMALIZATION_HIGH_PERCENTILE = 0.99;
const LOCAL_CONTRAST_RADIUS_RATIO = 22 / 1600;
const LOCAL_CONTRAST_OFFSET = 22;

export type OcrProgress = {
  progress: number;
  status: string;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  const imageUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("El navegador no pudo abrir esta imagen."));
    };
    image.src = imageUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("No fue posible preparar la imagen para lectura."));
        }
      },
      "image/jpeg",
      0.92,
    );
  });
}

/**
 * Dibuja una copia limitada en tamaño para el motor OCR.
 *
 * @param image Imagen original decodificada.
 * @param allowUpscale Si se permite ampliar una foto pequeña.
 * @param horizontalScale Factor para separar caracteres impresos muy estrechos.
 * @returns Canvas listo para lectura o `null` si no hay contexto 2D.
 */
function drawReceiptImage(
  image: HTMLImageElement,
  allowUpscale: boolean,
  horizontalScale = 1,
) {
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const targetDimension = horizontalScale > 1 ? WIDE_OCR_DIMENSION : MIN_OCR_DIMENSION;
  const baseScale =
    longestSide > MAX_OCR_DIMENSION
      ? MAX_OCR_DIMENSION / longestSide
      : allowUpscale && longestSide < targetDimension
        ? Math.min(MAX_UPSCALE, targetDimension / longestSide)
        : 1;
  const width = image.naturalWidth * horizontalScale;
  // Limita ambos ejes incluso al ensanchar la foto para la lectura alternativa.
  const scale = Math.min(baseScale, MAX_OCR_DIMENSION / width);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

/**
 * Reduce imágenes grandes y aumenta el contraste antes del OCR.
 *
 * Esta transformación disminuye el uso de memoria en iPhone sin modificar el
 * archivo original que luego se adjunta al resumen.
 *
 * @param image Fotografía decodificada, si el navegador reconoce su formato.
 * @param file Archivo original para el intento de lectura directo.
 * @returns Copia optimizada para reconocimiento.
 */
async function prepareReceiptImage(
  image: HTMLImageElement | null,
  file: File,
): Promise<Blob> {
  if (!image) {
    return file;
  }

  try {
    const surface = drawReceiptImage(image, true);
    if (!surface) {
      return file;
    }

    const { canvas, context } = surface;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const histogram = new Uint32Array(256);
    const pixelCount = pixels.length / 4;

    for (let index = 0; index < pixels.length; index += 4) {
      const grey = Math.round(
        pixels[index] * 0.299 +
          pixels[index + 1] * 0.587 +
          pixels[index + 2] * 0.114,
      );
      histogram[grey] += 1;
      pixels[index] = grey;
      pixels[index + 1] = grey;
      pixels[index + 2] = grey;
    }

    const lowTarget = pixelCount * NORMALIZATION_LOW_PERCENTILE;
    const highTarget = pixelCount * NORMALIZATION_HIGH_PERCENTILE;
    let cumulative = 0;
    let low = 0;
    let high = 255;

    for (let value = 0; value < histogram.length; value += 1) {
      cumulative += histogram[value];
      if (cumulative >= lowTarget) {
        low = value;
        break;
      }
    }

    cumulative = 0;
    for (let value = 0; value < histogram.length; value += 1) {
      cumulative += histogram[value];
      if (cumulative >= highTarget) {
        high = value;
        break;
      }
    }

    const range = Math.max(1, high - low);
    for (let index = 0; index < pixels.length; index += 4) {
      const normalized = Math.max(
        0,
        Math.min(255, ((pixels[index] - low) * 255) / range),
      );
      pixels[index] = normalized;
      pixels[index + 1] = normalized;
      pixels[index + 2] = normalized;
    }

    context.putImageData(imageData, 0, 0);
    return await canvasToBlob(canvas);
  } catch {
    // El motor OCR todavía puede intentar procesar directamente el archivo.
    return file;
  }
}

/**
 * Aumenta el contraste por vecindad para compensar sombras sin corregir
 * dígitos por heurísticas. La tabla de sumas evita promediar cada región a mano.
 *
 * @param surface Canvas y contexto donde se dibujó la foto original.
 */
function applyLocalContrast(
  surface: NonNullable<ReturnType<typeof drawReceiptImage>>,
): void {
  const { canvas: { width, height }, context } = surface;
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const stride = width + 1;
  const integral = new Uint32Array(stride * (height + 1));
  const radius = Math.max(
    1,
    Math.round(Math.max(width, height) * LOCAL_CONTRAST_RADIUS_RATIO),
  );

  for (let row = 0; row < height; row += 1) {
    let rowSum = 0;
    for (let column = 0; column < width; column += 1) {
      const pixel = (row * width + column) * 4;
      const gray = Math.trunc(
        pixels[pixel] * 0.299 + pixels[pixel + 1] * 0.587 + pixels[pixel + 2] * 0.114,
      );
      pixels[pixel] = gray;
      rowSum += gray;
      integral[(row + 1) * stride + column + 1] =
        rowSum + integral[row * stride + column + 1];
    }
  }

  for (let row = 0; row < height; row += 1) {
    const top = Math.max(0, row - radius) * stride;
    const bottom = Math.min(height, row + radius + 1) * stride;
    const windowHeight = (bottom - top) / stride;
    for (let column = 0; column < width; column += 1) {
      const left = Math.max(0, column - radius);
      const right = Math.min(width, column + radius + 1);
      const sum =
        integral[bottom + right] - integral[bottom + left] -
        integral[top + right] + integral[top + left];
      const average = sum / (windowHeight * (right - left));
      const pixel = (row * width + column) * 4;
      const color = pixels[pixel] < average - LOCAL_CONTRAST_OFFSET ? 0 : 255;
      pixels[pixel] = color;
      pixels[pixel + 1] = color;
      pixels[pixel + 2] = color;
    }
  }

  context.putImageData(imageData, 0, 0);
}

/**
 * Reconoce una boleta dentro del navegador con recursos alojados por la app.
 *
 * @param file Imagen de la boleta.
 * @param onProgress Notificación de avance para la interfaz.
 * @returns Borrador para que la persona revise y confirme los consumos.
 */
export async function recognizeReceipt(
  file: File,
  onProgress: (progress: OcrProgress) => void,
): Promise<ReceiptDraft> {
  const photo = await loadImage(file).catch(() => null);
  const image = await prepareReceiptImage(photo, file);
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  let retryProgress: number | null = null;

  try {
    worker = await createWorker("spa", OEM.LSTM_ONLY, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      logger: (message) =>
        onProgress({
          progress: retryProgress ?? Math.max(0, Math.min(0.8, message.progress * 0.8)),
          status: retryProgress === null ? message.status : "checking prices",
        }),
    });
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });

    const result = await worker.recognize(image);
    const original = parseReceiptText(result.data.text);
    const itemsSubtotal = original.items.reduce((sum, item) => sum + item.total, 0);
    if (
      !photo ||
      original.items.length === 0 ||
      itemsSubtotal === (original.declaredSubtotal ?? original.declaredTotal)
    ) {
      return original;
    }

    try {
      const alternateReadings: ReceiptDraft[] = [];
      retryProgress = 0.85;
      onProgress({ progress: retryProgress, status: "checking prices" });

      if (original.declaredSubtotal !== null) {
        const wide = drawReceiptImage(photo, true, WIDE_CHARACTER_SCALE);
        if (wide) {
          const detail = await worker.recognize(wide.canvas).catch(() => null);
          wide.canvas.width = 1;
          wide.canvas.height = 1;
          if (detail) {
            const alternative = parseReceiptText(detail.data.text);
            const reconciled = selectReconciledReading(original, alternative);
            if (reconciled) {
              return reconciled;
            }
          }
        }
      }

      const contrast = drawReceiptImage(photo, false);
      if (contrast) {
        applyLocalContrast(contrast);
        const detail = await worker.recognize(contrast.canvas);
        alternateReadings.push(parseReceiptText(detail.data.text));
        // Suelta la superficie grande antes de que el motor procese la siguiente.
        contrast.canvas.width = 1;
        contrast.canvas.height = 1;
      }

      retryProgress = 0.95;
      const column = drawReceiptImage(photo, true);
      if (column) {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
          thresholding_method: "2", // Sauvola, adaptativo a la iluminación.
        });
        const detail = await worker.recognize(column.canvas);
        alternateReadings.push(parseReceiptText(detail.data.text));
      }

      return reconcileReceiptReadings(original, alternateReadings);
    } catch {
      // Un fallo en la relectura conserva el borrador que ya puede revisarse.
      return original;
    }
  } finally {
    await worker?.terminate();
  }
}
