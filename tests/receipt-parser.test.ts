import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseChileanAmount,
  parseReceiptText,
} from "../domain/receipt-parser.ts";

describe("parseChileanAmount", () => {
  it("interpreta separadores habituales en pesos chilenos", () => {
    assert.equal(parseChileanAmount("$12.000"), 12000);
    assert.equal(parseChileanAmount("8 500"), 8500);
    assert.equal(parseChileanAmount("4500"), 4500);
  });

  it("rechaza fragmentos demasiado cortos o inválidos", () => {
    assert.equal(parseChileanAmount("10"), null);
    assert.equal(parseChileanAmount("sin precio"), null);
  });
});

describe("parseReceiptText", () => {
  it("extrae cantidades, nombres y totales sin convertir resúmenes en consumos", () => {
    const result = parseReceiptText(`
      RESTAURANT LA ESQUINA
      2 CERVEZA ARTESANAL       $8.000
      1X HAMBURGUESA ITALIANA   12.500
      TABLA PARA COMPARTIR      15.000
      SUBTOTAL                  35.500
      PROPINA SUGERIDA 10%       3.550
      TOTAL                     39.050
    `);

    assert.deepEqual(
      result.items.map(({ name, quantity, total }) => ({
        name,
        quantity,
        total,
      })),
      [
        { name: "CERVEZA ARTESANAL", quantity: 2, total: 8000 },
        { name: "HAMBURGUESA ITALIANA", quantity: 1, total: 12500 },
        { name: "TABLA PARA COMPARTIR", quantity: 1, total: 15000 },
      ],
    );
    assert.equal(result.declaredSubtotal, 35500);
    assert.equal(result.declaredTotal, 39050);
    assert.equal(result.warnings.length, 0);
  });

  it("preserva líneas repetidas como consumos independientes", () => {
    const result = parseReceiptText(`
      CERVEZA 4.000
      CERVEZA 4.000
      TOTAL 8.000
    `);

    assert.equal(result.items.length, 2);
    assert.notEqual(result.items[0].id, result.items[1].id);
    assert.equal(result.warnings.length, 0);
  });

  it("informa cuando no encuentra líneas suficientemente confiables", () => {
    const result = parseReceiptText("MESA 12\nGRACIAS POR SU VISITA");

    assert.deepEqual(result.items, []);
    assert.match(result.warnings[0], /No se detectaron/);
  });
});
