const MAX_OCR_DIMENSION = 2400;
const MIN_OCR_DIMENSION = 1800;
const MAX_UPSCALE = 2;
const NORMALIZATION_LOW_PERCENTILE = 0.01;
const NORMALIZATION_HIGH_PERCENTILE = 0.99;

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
 * Reduce imágenes grandes y aumenta el contraste antes del OCR.
 *
 * Esta transformación disminuye el uso de memoria en iPhone sin modificar el
 * archivo original que luego se adjunta al resumen.
 *
 * @param file Fotografía elegida por la persona.
 * @returns Copia optimizada para reconocimiento.
 */
async function prepareReceiptImage(file: File): Promise<Blob> {
  try {
    const image = await loadImage(file);
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale =
      longestSide > MAX_OCR_DIMENSION
        ? MAX_OCR_DIMENSION / longestSide
        : longestSide < MIN_OCR_DIMENSION
          ? Math.min(
              MAX_UPSCALE,
              MIN_OCR_DIMENSION / Math.max(longestSide, 1),
            )
          : 1;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
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
    // Algunos formatos de Fotos, como HEIC, pueden no abrirse en Canvas. El
    // motor OCR todavía puede intentar procesar directamente el archivo.
    return file;
  }
}

/**
 * Reconoce una boleta dentro del navegador con recursos alojados por la app.
 *
 * @param file Imagen de la boleta.
 * @param onProgress Notificación de avance para la interfaz.
 * @returns Texto reconocido en español.
 */
export async function recognizeReceipt(
  file: File,
  onProgress: (progress: OcrProgress) => void,
): Promise<string> {
  const image = await prepareReceiptImage(file);
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  try {
    worker = await createWorker("spa", OEM.LSTM_ONLY, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      logger: (message) =>
        onProgress({
          progress: Math.max(0, Math.min(1, message.progress)),
          status: message.status,
        }),
    });
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });

    const result = await worker.recognize(image);
    return result.data.text.trim();
  } finally {
    await worker?.terminate();
  }
}
