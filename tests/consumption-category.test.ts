import assert from "node:assert/strict";
import test from "node:test";
import { getConsumptionCategory } from "../domain/consumption-category.ts";

test("identifica los nombres habituales de cerveza y schop en precuentas", () => {
  assert.equal(getConsumptionCategory("SCHOP AUSTRAL CALAF · CAMARONCHELA"), "beer");
  assert.equal(getConsumptionCategory("Shop Kunstmann"), "beer");
  assert.equal(getConsumptionCategory("MICHELADA"), "beer");
});

test("usa el primer producto aunque la variante incluya una bebida distinta", () => {
  assert.equal(getConsumptionCategory("RON COCO CON BEBIDA · GINGER 220 CC"), "cocktail");
  assert.equal(getConsumptionCategory("Pisco sour"), "cocktail");
  assert.equal(getConsumptionCategory("Cóctel de naranja"), "cocktail");
  assert.equal(getConsumptionCategory("Tabla de papas con cerveza"), "food");
  assert.equal(getConsumptionCategory("Agua tónica"), "soft-drink");
});

test("evita mostrar una categoría si el nombre es desconocido", () => {
  assert.equal(getConsumptionCategory("Cargo especial"), null);
  assert.equal(getConsumptionCategory(""), null);
});
