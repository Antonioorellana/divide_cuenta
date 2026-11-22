import type { BillItem } from "./models.ts";
import type { ReceiptParseResult } from "./receipt-parser.ts";

export type ReceiptDraft = Pick<
  ReceiptParseResult,
  "items" | "ignoredLineCount" | "declaredSubtotal"
>;

type PriceChange = { itemIndex: number; amount: number; difference: number };

/**
 * Acepta una lectura alternativa completa cuando el subtotal impreso se
 * reconoce igual en ambas pasadas y la alternativa cuadra sin perder filas.
 *
 * @param original Lectura que aporta la primera referencia del subtotal.
 * @param alternate Lectura completa obtenida con otro preprocesamiento.
 * @returns Borrador alternativo si coincide con la referencia, o `null`.
 */
export function selectReconciledReading(
  original: ReceiptDraft,
  alternate: ReceiptDraft,
): ReceiptDraft | null {
  if (
    original.declaredSubtotal === null ||
    alternate.declaredSubtotal !== original.declaredSubtotal ||
    alternate.items.length === 0 ||
    alternate.items.length < original.items.length
  ) {
    return null;
  }

  const subtotal = alternate.items.reduce((sum, item) => sum + item.total, 0);
  return subtotal === original.declaredSubtotal ? alternate : null;
}

/**
 * Compara dos filas sin confundir líneas repetidas o variantes de un producto.
 *
 * @param original Fila del borrador inicial.
 * @param alternate Fila de una segunda lectura.
 * @returns Si coinciden la cantidad y el nombre, con tolerancia a una letra
 * inicial perdida cuando también coincide el detalle de la variante.
 */
function sameReceiptItem(original: BillItem, alternate: BillItem): boolean {
  if (original.quantity !== alternate.quantity) {
    return false;
  }

  const firstName = original.name.toLocaleLowerCase("es-CL");
  const secondName = alternate.name.toLocaleLowerCase("es-CL");
  if (firstName === secondName) {
    return true;
  }

  return (
    firstName.includes(" · ") &&
    ((/^\p{L}{2}/u.test(firstName) && firstName.slice(1) === secondName) ||
      (/^\p{L}{2}/u.test(secondName) && secondName.slice(1) === firstName))
  );
}

/**
 * Busca una solución única usando como máximo dos importes alternativos.
 *
 * @param changes Importes realmente leídos en otra pasada y asociados a su fila.
 * @param difference Variación necesaria para cuadrar el subtotal impreso.
 * @returns Cambios únicos, o `null` si no hay solución o hay más de una.
 */
function findUniqueChanges(
  changes: PriceChange[],
  difference: number,
): PriceChange[] | null {
  let solution: PriceChange[] | null = null;
  const byDifference = new Map<number, PriceChange[]>();

  for (const change of changes) {
    if (change.difference === difference) {
      if (solution) {
        return null;
      }
      solution = [change];
    }

    for (const complement of byDifference.get(difference - change.difference) ?? []) {
      if (complement.itemIndex === change.itemIndex) {
        continue;
      }
      if (solution) {
        return null;
      }
      solution = [complement, change];
    }

    const group = byDifference.get(change.difference) ?? [];
    group.push(change);
    byDifference.set(change.difference, group);
  }

  return solution;
}

/**
 * Usa solo importes leídos para la misma fila y respaldados por el subtotal.
 *
 * @param original Borrador inicial, que conserva el orden y los nombres.
 * @param alternateReadings Lecturas independientes de la misma fotografía.
 * @returns Borrador con el subtotal detectado y los precios conciliados cuando
 * existe una única solución. Ante ambigüedad, conserva los importes iniciales.
 */
export function reconcileReceiptReadings(
  original: ReceiptDraft,
  alternateReadings: ReceiptDraft[],
): ReceiptDraft {
  const subtotals = new Set(
    [original, ...alternateReadings]
      .map((reading) => reading.declaredSubtotal)
      .filter((subtotal) => subtotal !== null),
  );
  if (subtotals.size !== 1) {
    return original;
  }

  const [declaredSubtotal] = subtotals;
  const draft = { ...original, declaredSubtotal };
  const currentSubtotal = original.items.reduce((sum, item) => sum + item.total, 0);
  const difference = declaredSubtotal - currentSubtotal;
  if (difference === 0) {
    return draft;
  }

  const changes = original.items.flatMap((item, itemIndex) => {
    const possibleAmounts = new Set<number>();
    for (const reading of alternateReadings) {
      const matches = reading.items.filter((candidate) => sameReceiptItem(item, candidate));
      if (matches.length !== 1) {
        continue;
      }
      const [match] = matches;
      const unambiguous = original.items.filter(
        (candidate) => sameReceiptItem(candidate, match),
      ).length === 1;
      if (unambiguous && match.total !== item.total) {
        possibleAmounts.add(match.total);
      }
    }
    return Array.from(possibleAmounts, (amount) => ({
      itemIndex,
      amount,
      difference: amount - item.total,
    }));
  });

  const solution = findUniqueChanges(changes, difference);
  if (!solution) {
    return draft;
  }

  return {
    ...draft,
    items: draft.items.map((item, index) => {
      const change = solution.find(({ itemIndex }) => itemIndex === index);
      return change ? { ...item, total: change.amount } : item;
    }),
  };
}
