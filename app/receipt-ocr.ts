const MAX_OCR_DIMENSION = 2200;
const MIN_OCR_DIMENSION = 1400;

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
          ? Math.min(2, MIN_OCR_DIMENSION / Math.max(longestSide, 1))
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

    for (let index = 0; index < pixels.length; index += 4) {
      const grey =
        pixels[index] * 0.299 +
        pixels[index + 1] * 0.587 +
        pixels[index + 2] * 0.114;
      const contrasted = Math.max(0, Math.min(255, (grey - 128) * 1.35 + 128));
      pixels[index] = contrasted;
      pixels[index + 1] = contrasted;
      pixels[index + 2] = contrasted;
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
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });

    const result = await worker.recognize(image);
    return result.data.text.trim();
  } finally {
    await worker?.terminate();
  }
}
