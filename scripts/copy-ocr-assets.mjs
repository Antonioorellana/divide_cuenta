import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(projectRoot, "public", "ocr");

const assets = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  [
    "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
    "core/tesseract-core-lstm.wasm.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
    "core/tesseract-core-simd-lstm.wasm.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
    "core/tesseract-core-relaxedsimd-lstm.wasm.js",
  ],
  [
    "node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz",
    "lang/spa.traineddata.gz",
  ],
];

for (const [source, destination] of assets) {
  const destinationPath = join(publicRoot, destination);
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(join(projectRoot, source), destinationPath);
}

console.log("OCR assets prepared in public/ocr.");
