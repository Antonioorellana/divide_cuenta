export type ConsumptionCategory = "cocktail" | "beer" | "food" | "soft-drink";

const CATEGORY_TERMS: ReadonlyArray<readonly [ConsumptionCategory, RegExp]> = [
  [
    "food",
    /\b(?:papas?|fritas?|chorrillanas?|tablas?|hamburguesas?|sandwich(?:es)?|pizzas?|nachos?|empanadas?|alitas?|completos?|tacos?|ceviche|ensalada|churrasco|postre)\b/,
  ],
  [
    "beer",
    /\b(?:cervezas?|schops?|shops?|chops?|cheladas?|chelitas?|micheladas?|lager|pils(?:ner|en)|stout|ipa|escudo|cusquena|kunstmann)\b/,
  ],
  [
    "cocktail",
    /\b(?:coctel(?:es)?|cocktails?|gins?|piscos?|sour|ron|mojitos?|spritz|margaritas?|caipirinhas?|daiquiris?|sangrias?|negroni|ramazzotti|tequila|vodka|havana|whisk(?:y|ey)|jack daniels|mistral|aperol|campari|fernet)\b/,
  ],
  [
    "soft-drink",
    /\b(?:aguas?|bebidas?|jugos?|cafes?|sprite|coca(?: cola)?|limonadas?|gaseosas?|soda|tonica|ginger ale)\b/,
  ],
];

/**
 * Elige una imagen de referencia usando el nombre principal del consumo.
 *
 * @param name Nombre detectado por OCR o editado por la persona.
 * @returns Categoría ilustrativa o `null` cuando el nombre es ambiguo.
 */
export function getConsumptionCategory(name: string): ConsumptionCategory | null {
  const [product] = name.split(" · ", 1);
  const normalized = product
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  let category: ConsumptionCategory | null = null;
  let firstTerm = Infinity;

  for (const [candidate, terms] of CATEGORY_TERMS) {
    const position = normalized.search(terms);
    if (position >= 0 && position < firstTerm) {
      category = candidate;
      firstTerm = position;
    }
  }

  return category;
}
