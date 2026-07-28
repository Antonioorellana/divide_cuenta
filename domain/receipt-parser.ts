import type { BillItem } from "./models.ts";

export type ReceiptParseResult = {
  items: BillItem[];
  ignoredLineCount: number;
  declaredSubtotal: number | null;
  declaredTotal: number | null;
  warnings: string[];
};

const SUMMARY_WORDS = [
  "total",
  "subtotal",
  "sub total",
  "propina",
  "iva",
  "impuesto",
  "neto",
  "exento",
  "descuento",
  "efectivo",
  "tarjeta",
  "debito",
  "credito",
  "vuelto",
  "cambio",
  "pago",
  "monto",
];

const MONEY_AT_END =
  /(?:\$\s*)?(\d{1,3}(?:(?:[.,]\s*|\s)\d{3})+|\d{3,8})(?:\s*(?:clp|pesos?))?\s*$/i;
const MONEY_ONLY = new RegExp(`^${MONEY_AT_END.source}`, "i");
const QUANTITY_PREFIX =
  /^[^\p{L}\d]{0,3}([1-9]\d?)(?:[.,]0{1,2})?\s*(?:[xX*]\s*)?(.+)$/u;

/**
 * Convierte un monto chileno reconocido por OCR a pesos enteros.
 *
 * @param token Texto que contiene el monto.
 * @returns Monto en CLP o `null` cuando el texto no representa un monto válido.
 */
export function parseChileanAmount(token: string): number | null {
  const digits = token.replace(/\D/g, "");
  if (digits.length < 3 || digits.length > 8) {
    return null;
  }

  const value = Number(digits);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL");
}

function containsSummaryWord(line: string): boolean {
  const normalized = normalizeForComparison(line);
  return SUMMARY_WORDS.some((word) => normalized.includes(word));
}

function cleanItemName(value: string): string {
  return value
    .replace(/\b(?:cant(?:idad)?|precio|valor|unit(?:ario)?)\b/gi, " ")
    .replace(
      /(?:\$\s*)?\d{1,3}(?:(?:[.,]\s*|\s)\d{3})+(?=\s|$)/g,
      " ",
    )
    .replace(/^[#.:;,\-\s]+|[#.:;,\-\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeOcrLine(value: string): string {
  return value
    .replace(/[|¦]/g, "I")
    .replace(/^[^\p{L}\d]{1,3}(?=\s*[1Il][.,]0{2}\s)/u, "")
    .replace(/^[Il](?=[.,]0{2}\s)/, "1")
    .replace(/(\d)[.,]\s+(\d{3})(?=\D*$)/, "$1.$2")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeDetachedPrices(lines: string[]): string[] {
  const mergedLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1];

    if (
      QUANTITY_PREFIX.test(line) &&
      !MONEY_AT_END.test(line) &&
      nextLine &&
      MONEY_ONLY.test(nextLine)
    ) {
      mergedLines.push(`${line} ${nextLine}`);
      index += 1;
      continue;
    }

    mergedLines.push(line);
  }

  return mergedLines;
}

function findDeclaredTotal(lines: string[]): number | null {
  const candidates = lines
    .filter((line) => {
      const normalized = normalizeForComparison(line);
      return (
        /\btotal\b/.test(normalized) &&
        !normalized.includes("subtotal") &&
        !normalized.includes("propina")
      );
    })
    .map((line) => line.match(MONEY_AT_END)?.[1] ?? "")
    .map(parseChileanAmount)
    .filter((amount): amount is number => amount !== null);

  return candidates.at(-1) ?? null;
}

function findDeclaredSubtotal(lines: string[]): number | null {
  const candidates = lines
    .filter((line) =>
      /\bsub\s*total\b/.test(normalizeForComparison(line)),
    )
    .map((line) => line.match(MONEY_AT_END)?.[1] ?? "")
    .map(parseChileanAmount)
    .filter((amount): amount is number => amount !== null);

  return candidates.at(-1) ?? null;
}

/**
 * Interpreta texto OCR de una comanda o preboleta chilena.
 *
 * El analizador es deliberadamente conservador: solo crea consumos cuando una
 * línea contiene un nombre legible y un monto al final. El resultado siempre
 * debe ser revisado por la persona antes de continuar.
 *
 * @param rawText Texto completo entregado por el motor OCR.
 * @returns Borrador de consumos, líneas omitidas y advertencias de conciliación.
 */
export function parseReceiptText(rawText: string): ReceiptParseResult {
  const lines = mergeDetachedPrices(
    rawText
      .replace(/\r/g, "")
      .split("\n")
      .map(normalizeOcrLine)
      .filter(Boolean),
  );

  const declaredTotal = findDeclaredTotal(lines);
  const declaredSubtotal = findDeclaredSubtotal(lines);
  const items: BillItem[] = [];
  let ignoredLineCount = 0;

  for (const line of lines) {
    const moneyMatch = line.match(MONEY_AT_END);
    if (!moneyMatch || containsSummaryWord(line)) {
      ignoredLineCount += 1;
      continue;
    }

    const total = parseChileanAmount(moneyMatch[1]);
    if (total === null) {
      ignoredLineCount += 1;
      continue;
    }

    let itemText = line.slice(0, moneyMatch.index).trim();
    let quantity = 1;
    const quantityMatch = itemText.match(QUANTITY_PREFIX);

    if (quantityMatch) {
      const parsedQuantity = Number(quantityMatch[1]);
      const possibleName = quantityMatch[2].trim();
      if (
        Number.isInteger(parsedQuantity) &&
        parsedQuantity >= 1 &&
        parsedQuantity <= 99 &&
        /\p{L}/u.test(possibleName)
      ) {
        quantity = parsedQuantity;
        itemText = possibleName;
      }
    }

    const name = cleanItemName(itemText);
    if (name.length < 2 || !/\p{L}/u.test(name)) {
      ignoredLineCount += 1;
      continue;
    }

    items.push({
      id: `ocr-${items.length + 1}`,
      name,
      quantity,
      total,
      shared: false,
      assignments: {},
    });
  }

  const warnings: string[] = [];
  const detectedSubtotal = items.reduce((sum, item) => sum + item.total, 0);
  const reconciliationTarget = declaredSubtotal ?? declaredTotal;

  if (
    reconciliationTarget !== null &&
    items.length > 0 &&
    detectedSubtotal !== reconciliationTarget
  ) {
    warnings.push(
      `La suma detectada es ${detectedSubtotal.toLocaleString("es-CL")} y la boleta muestra ${reconciliationTarget.toLocaleString("es-CL")} antes de propina. Revisa precios o líneas faltantes.`,
    );
  }

  if (items.length === 0) {
    warnings.push(
      "No se detectaron consumos confiables. Prueba con una foto más recta y luminosa, o agrégalos manualmente.",
    );
  }

  return {
    items,
    ignoredLineCount,
    declaredSubtotal,
    declaredTotal,
    warnings,
  };
}
