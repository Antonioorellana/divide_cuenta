import type { BillItem } from "./models.ts";

export type ReceiptParseResult = {
  items: BillItem[];
  ignoredLineCount: number;
  declaredSubtotal: number | null;
  declaredTotal: number | null;
  warnings: string[];
};

const SUMMARY_LABEL =
  /^(?:total|sub\s*total|propina|iva|impuesto|neto|exento|descuento|efectivo|tarjeta|debito|credito|vuelto|cambio|pago|monto|comensal(?:es)?)\b/;
const SUBTOTAL_LABEL =
  /^(?:sub\s*total\b|total\s*\(?\s*(?:impuestos?\s+incl(?:uidos?)?\b|sin\s+propina\b))/;
const TOTAL_LABEL = /^total\b(?!\s*(?:\/|por\b))/;
const PER_PERSON_TOTAL = /\btotal\s*(?:\/\s*|por\s+)(?:comensal|persona)\b/;
const MODIFIER_LINE = /^c{1,2}[.,]\s+(.+)$/i;
const TRAILING_OCR_FRAGMENT = /(?<=\d)[ \t]{2,}[\p{L}]{1,2}\.?\s*$/u;

const MONEY_AT_END =
  /(?<![\d.,])(?:[+-]\s*)?(?:\$\s*)?(\d{1,3}(?:(?:[.,]\s*|\s)\d{3})+|\d{3,8})(?:\s*(?:clp|pesos?))?\s*$/i;
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
  const trimmed = token.trim();
  const match = trimmed.match(MONEY_ONLY);
  if (!match || /^[+-]/.test(trimmed)) {
    return null;
  }

  const digits = match[1].replace(/\D/g, "");
  const value = Number(digits);
  return digits.length <= 8 && value > 0 ? value : null;
}

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL");
}

function isSummaryLine(line: string): boolean {
  const normalized = normalizeForComparison(line);
  return SUMMARY_LABEL.test(normalized) || PER_PERSON_TOTAL.test(normalized);
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
    .replace(/(\d)\s*[.,]\s*(\d{3})(?=\D*$)/, "$1.$2")
    .trim();
}

/**
 * Encuentra el importe de una línea, incluso si el fondo dejó letras aisladas
 * después de la columna de precios en una fila con cantidad explícita.
 *
 * @param line Línea de OCR con la separación entre columnas intacta.
 * @returns Coincidencia del importe o `null`.
 */
function findLineAmount(line: string): RegExpMatchArray | null {
  const amount = line.match(MONEY_AT_END);
  if (amount || !QUANTITY_PREFIX.test(line)) {
    return amount;
  }

  return line.replace(TRAILING_OCR_FRAGMENT, "").match(MONEY_AT_END);
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

/**
 * Extrae el último monto legible para la etiqueta solicitada.
 *
 * @param lines Líneas de OCR normalizadas.
 * @param label Patrón para identificar el tipo de total.
 * @returns Monto leído o `null` si falta la etiqueta o el precio.
 */
function findDeclaredAmount(lines: string[], label: RegExp): number | null {
  const candidates = lines
    .filter((line) => label.test(normalizeForComparison(line)))
    .map((line) => line.match(MONEY_AT_END)?.[0] ?? "")
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

  const declaredTotal = findDeclaredAmount(lines, TOTAL_LABEL);
  const declaredSubtotal = findDeclaredAmount(lines, SUBTOTAL_LABEL);
  const items: BillItem[] = [];
  let ignoredLineCount = 0;
  let previousItem: BillItem | null = null;

  for (const line of lines) {
    const moneyMatch = findLineAmount(line);
    const modifier = line.match(MODIFIER_LINE);
    const hasModifierPrice = moneyMatch && /\$|[.,]\d{3}/.test(moneyMatch[0]);
    if (modifier && !hasModifierPrice) {
      if (previousItem) {
        const detail = modifier[1].replace(/[ \t]{3,}.*$/, "");
        previousItem.name += ` · ${detail}`;
      } else {
        ignoredLineCount += 1;
      }
      continue;
    }

    previousItem = null;
    if (!moneyMatch || isSummaryLine(line)) {
      ignoredLineCount += 1;
      continue;
    }

    const total = parseChileanAmount(moneyMatch[0]);
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

    const name = cleanItemName(itemText.replace(/\s+\/\s*$/, ""));
    if (name.length < 2 || !/\p{L}/u.test(name)) {
      ignoredLineCount += 1;
      continue;
    }

    previousItem = {
      id: `ocr-${items.length + 1}`,
      name,
      quantity,
      total,
      shared: false,
      assignments: {},
    };
    items.push(previousItem);
  }

  const warnings: string[] = [];
  const detectedSubtotal = items.reduce((sum, item) => sum + item.total, 0);
  if (
    declaredSubtotal !== null &&
    items.length > 0 &&
    detectedSubtotal !== declaredSubtotal
  ) {
    warnings.push(
      `La suma detectada es ${detectedSubtotal.toLocaleString("es-CL")} y la boleta muestra un subtotal de ${declaredSubtotal.toLocaleString("es-CL")}. Revisa precios o líneas faltantes.`,
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
