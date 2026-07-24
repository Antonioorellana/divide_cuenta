import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateAmount,
  calculateBillDistribution,
  isItemFullyAssigned,
} from "../domain/billing.ts";
import type { BillItem, Participant } from "../domain/models.ts";

const participants: Participant[] = [
  { id: "pedro", name: "Pedro", tone: "mint" },
  { id: "ana", name: "Ana", tone: "lavender" },
  { id: "luis", name: "Luis", tone: "blue" },
];

describe("allocateAmount", () => {
  it("reconcilia un monto indivisible sin perder pesos", () => {
    const result = allocateAmount(10000, { pedro: 1, ana: 1, luis: 1 });

    assert.deepEqual(result, { ana: 3334, luis: 3333, pedro: 3333 });
    assert.equal(
      Object.values(result).reduce((sum, amount) => sum + amount, 0),
      10000,
    );
  });

  it("rechaza montos negativos", () => {
    assert.throws(() => allocateAmount(-1, { pedro: 1 }), RangeError);
  });
});

describe("isItemFullyAssigned", () => {
  it("exige todas las unidades en modo individual", () => {
    const item: BillItem = {
      id: "cerveza",
      name: "Cerveza",
      quantity: 2,
      total: 8000,
      shared: false,
      assignments: { pedro: 1 },
    };

    assert.equal(isItemFullyAssigned(item), false);
    item.assignments.ana = 1;
    assert.equal(isItemFullyAssigned(item), true);
  });

  it("exige al menos dos participantes en modo compartido", () => {
    const item: BillItem = {
      id: "tabla",
      name: "Tabla",
      quantity: 1,
      total: 10000,
      shared: true,
      assignments: { pedro: 1 },
    };

    assert.equal(isItemFullyAssigned(item), false);
    item.assignments.ana = 1;
    assert.equal(isItemFullyAssigned(item), true);
  });
});

describe("calculateBillDistribution", () => {
  it("distribuye consumos, compartidos y propina proporcional", () => {
    const items: BillItem[] = [
      {
        id: "cerveza",
        name: "Cerveza",
        quantity: 3,
        total: 12000,
        shared: false,
        assignments: { pedro: 2, ana: 1 },
      },
      {
        id: "tabla",
        name: "Tabla",
        quantity: 1,
        total: 10000,
        shared: true,
        assignments: { pedro: 1, ana: 1, luis: 1 },
      },
    ];

    const result = calculateBillDistribution(participants, items, 10);

    assert.equal(result.subtotal, 22000);
    assert.equal(result.tip, 2200);
    assert.equal(result.grandTotal, 24200);
    assert.equal(
      Object.values(result.totals).reduce((sum, amount) => sum + amount, 0),
      result.grandTotal,
    );
    assert.equal(
      Object.values(result.tipAllocations).reduce(
        (sum, amount) => sum + amount,
        0,
      ),
      result.tip,
    );
  });

  it("rechaza productos incompletos", () => {
    const incompleteItem: BillItem = {
      id: "agua",
      name: "Agua",
      quantity: 2,
      total: 5000,
      shared: false,
      assignments: { ana: 1 },
    };

    assert.throws(
      () => calculateBillDistribution(participants, [incompleteItem], 10),
      /no está completamente asignado/,
    );
  });
});
