import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReceiptText } from "../domain/receipt-parser.ts";
import { reconcileReceiptReadings } from "../domain/receipt-reconciliation.ts";

describe("reconcileReceiptReadings", () => {
  it("corrige dos importes leídos por separado si cuadran con el subtotal", () => {
    const original = parseReceiptText(`
      2 SCHOP AUSTRAL CALAF $49.380
      C. CAMARONCHELA
      1 TROPICAL GIN $65.490
    `);
    const withSubtotal = parseReceiptText(`
      2 SCHOP AUSTRAL CALAF $49.380
      C. CAMARONCHELA
      1 TROPICAL GIN $6.490
      Total (Impuestos Incl.) $15.870
    `);
    const withColumn = parseReceiptText(`
      2 CHOP AUSTRAL CALAF $9.380
      C. CAMARONCHELA
      1 TROPICAL GIN $65.490
    `);

    const result = reconcileReceiptReadings(original, [withSubtotal, withColumn]);

    assert.equal(result.declaredSubtotal, 15870);
    assert.deepEqual(result.items.map(({ total }) => total), [9380, 6490]);
    assert.deepEqual(
      result.items.map(({ id, name, quantity }) => ({ id, name, quantity })),
      original.items.map(({ id, name, quantity }) => ({ id, name, quantity })),
    );
  });

  it("conserva los importes si dos correcciones distintas cuadran", () => {
    const original = parseReceiptText("1 CAFE $3.000\n1 AGUA $3.000");
    const retry = parseReceiptText("1 CAFE $2.000\n1 AGUA $2.000\nSUBTOTAL $5.000");

    const result = reconcileReceiptReadings(original, [retry]);

    assert.equal(result.declaredSubtotal, 5000);
    assert.deepEqual(result.items, original.items);
  });

  it("conserva el borrador cuando las lecturas discrepan sobre el subtotal", () => {
    const original = parseReceiptText("1 CAFE $9.000\nSUBTOTAL $3.000");
    const retry = parseReceiptText("1 CAFE $2.000\nSUBTOTAL $2.000");

    assert.equal(reconcileReceiptReadings(original, [retry]), original);
  });

  it("evita inferir precios si hay líneas repetidas o falta el subtotal", () => {
    const repeated = parseReceiptText("1 CAFE $3.000\n1 CAFE $4.000");
    const retry = parseReceiptText("1 CAFE $2.000\nSUBTOTAL $6.000");
    const withoutSubtotal = parseReceiptText("1 CAFE $3.000");
    const totalOnly = parseReceiptText("1 CAFE $2.000\nTOTAL $2.000");

    assert.deepEqual(reconcileReceiptReadings(repeated, [retry]).items, repeated.items);
    assert.equal(reconcileReceiptReadings(withoutSubtotal, [totalOnly]), withoutSubtotal);
  });
});
