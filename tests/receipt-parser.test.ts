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
    assert.equal(parseChileanAmount("-$3.000"), null);
    assert.equal(parseChileanAmount("12.50"), null);
    assert.equal(parseChileanAmount("123456789"), null);
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

  it("distingue etiquetas de resumen de palabras dentro del nombre", () => {
    const result = parseReceiptText(`
      ACEITE DE OLIVA 3.000
      PAN INTEGRAL 1.500
      IVA 19% 855
      SUB TOTAL 4.500
      TOTAL CON PROPINA 4.950
    `);

    assert.deepEqual(
      result.items.map(({ name, total }) => ({ name, total })),
      [
        { name: "ACEITE DE OLIVA", total: 3000 },
        { name: "PAN INTEGRAL", total: 1500 },
      ],
    );
    assert.equal(result.declaredSubtotal, 4500);
    assert.equal(result.declaredTotal, 4950);
    assert.deepEqual(result.warnings, []);
  });

  it("evita convertir un ajuste negativo o un monto largo en un consumo", () => {
    const result = parseReceiptText("AJUSTE -$1.500\nCODIGO 123456789");

    assert.deepEqual(result.items, []);
  });

  it("mantiene separados el total y el subtotal cuando la boleta solo muestra el total", () => {
    const result = parseReceiptText("AGUA $1.000\nTOTAL CON PROPINA $1.100");

    assert.equal(result.declaredSubtotal, null);
    assert.equal(result.declaredTotal, 1100);
    assert.deepEqual(result.warnings, []);
  });

  it("informa si la suma se aparta del subtotal explícito", () => {
    const result = parseReceiptText("AGUA $1.000\nSUBTOTAL $1.500");

    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /subtotal de 1[.\s]?500/);
  });

  it("distingue las variantes de platos y los totales de una cuenta con propina", () => {
    const result = parseReceiptText(`
      2 SCHOP AUSTRAL CALAF       $09.380
      C. CAMARONCHELA
      2 SCHOP AUSTRAL CALAF       $9.380
      C. GOMICHELA
      1 PAPAS TRADICIONAL        $4 .990
      1 TROPICAL GIN             $6.490       L
      2 SCHOP AUSTRAL CALAF      $9.380       o
      C. CHELADA                 FS
      2 SCHOP AUSTRAL CALAF      $9.380
      C. MARACUCHELA
      1 CORTO HAVANA ESPECI      $5.490       LY
      Cc. GINGER 220 CC
      2 PISCO SOUR       /       $7.980       h
      1 MO XL RON MITJANS        $5.290
      C. FRUTILLA XL
      2 RON COCO CON BEBIDA      $10.980
      C. GINGER 220 CC
      Total (Impuestos Incl.)    $78.740
      Propina sugerida 10,00 %   $7.874
      Total (Propina Incl.)      $86.614
      Comensales: 3 Total/Comensal: $26.247
      Total/Comensal: $26.247
      OLI Total/Comensal: $26.247
    `);

    assert.deepEqual(
      result.items.map(({ name, quantity, total }) => [name, quantity, total]),
      [
        ["SCHOP AUSTRAL CALAF · CAMARONCHELA", 2, 9380],
        ["SCHOP AUSTRAL CALAF · GOMICHELA", 2, 9380],
        ["PAPAS TRADICIONAL", 1, 4990],
        ["TROPICAL GIN", 1, 6490],
        ["SCHOP AUSTRAL CALAF · CHELADA", 2, 9380],
        ["SCHOP AUSTRAL CALAF · MARACUCHELA", 2, 9380],
        ["CORTO HAVANA ESPECI · GINGER 220 CC", 1, 5490],
        ["PISCO SOUR", 2, 7980],
        ["MO XL RON MITJANS · FRUTILLA XL", 1, 5290],
        ["RON COCO CON BEBIDA · GINGER 220 CC", 2, 10980],
      ],
    );
    assert.equal(result.declaredSubtotal, 78740);
    assert.equal(result.declaredTotal, 86614);
    assert.deepEqual(result.warnings, []);
  });

  it("conserva el cargo de un complemento que trae su propio precio", () => {
    const result = parseReceiptText("1 CAFE $2.000\nC. LECHE VEGETAL $500");

    assert.deepEqual(result.items.map(({ total }) => total), [2000, 500]);
  });

  it("evita asignar una variante al consumo anterior si falta el precio de su línea", () => {
    const result = parseReceiptText("1 BEBIDA $2.000\n1 CAFE\nC. DOBLE");

    assert.deepEqual(result.items.map(({ name }) => name), ["BEBIDA"]);
  });

  it("interpreta una comanda real con cantidades decimales y luz baja", () => {
    const result = parseReceiptText(`
      cant. Detalle                valor
      1.00 JACK DANIELS HONEY       8.000
      1.00 MISTRAL 35           5. 500
      1.00 MOJITO MALIBU            6.000
      1.00 TABLA LATORRE           29.000
      1.00 CUSQUENA                   3.500
      1.00 VASO MICHELADO             1.000
      1.00 JACK DANIELS HONEY
      8.000
      1,00 SQUIRT                   6.500
      TOTAL COMANDA        67.500
      TOTAL A PAGAR     67.500
    `);

    assert.deepEqual(
      result.items.map(({ name, quantity, total }) => ({
        name,
        quantity,
        total,
      })),
      [
        { name: "JACK DANIELS HONEY", quantity: 1, total: 8000 },
        { name: "MISTRAL 35", quantity: 1, total: 5500 },
        { name: "MOJITO MALIBU", quantity: 1, total: 6000 },
        { name: "TABLA LATORRE", quantity: 1, total: 29000 },
        { name: "CUSQUENA", quantity: 1, total: 3500 },
        { name: "VASO MICHELADO", quantity: 1, total: 1000 },
        { name: "JACK DANIELS HONEY", quantity: 1, total: 8000 },
        { name: "SQUIRT", quantity: 1, total: 6500 },
      ],
    );
    assert.equal(result.declaredTotal, 67500);
    assert.equal(result.warnings.length, 0);
  });

  it("informa cuando no encuentra líneas suficientemente confiables", () => {
    const result = parseReceiptText("MESA 12\nGRACIAS POR SU VISITA");

    assert.deepEqual(result.items, []);
    assert.match(result.warnings[0], /No se detectaron/);
  });
});
