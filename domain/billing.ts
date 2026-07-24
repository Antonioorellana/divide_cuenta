import type {
  BillDistribution,
  BillItem,
  Participant,
} from "./models.ts";

/**
 * Distribuye pesos enteros por peso relativo y entrega los residuos de forma
 * determinista para que la suma nunca difiera del total original.
 *
 * @param total Monto total en pesos chilenos.
 * @param weights Peso relativo de cada participante.
 * @returns Montos enteros reconciliados por participante.
 * @throws {RangeError} Si el monto o algún peso son negativos.
 */
export function allocateAmount(
  total: number,
  weights: Record<string, number>,
): Record<string, number> {
  if (!Number.isInteger(total) || total < 0) {
    throw new RangeError("El monto debe ser un entero no negativo.");
  }

  if (Object.values(weights).some((weight) => weight < 0)) {
    throw new RangeError("Los pesos de distribución no pueden ser negativos.");
  }

  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);

  if (totalWeight === 0) {
    return {};
  }

  const allocations = entries.map(([id, weight]) => {
    const exactValue = (total * weight) / totalWeight;
    const value = Math.floor(exactValue);
    return { id, value, remainder: exactValue - value };
  });

  let remaining =
    total - allocations.reduce((sum, allocation) => sum + allocation.value, 0);

  allocations.sort(
    (first, second) =>
      second.remainder - first.remainder || first.id.localeCompare(second.id),
  );

  for (let index = 0; index < allocations.length && remaining > 0; index += 1) {
    allocations[index].value += 1;
    remaining -= 1;
  }

  return Object.fromEntries(
    allocations.map(({ id, value }) => [id, value]),
  );
}

/**
 * Valida que un producto se encuentre completamente asignado.
 *
 * @param item Producto de la cuenta.
 * @returns `true` cuando la asignación cumple las reglas del modo activo.
 */
export function isItemFullyAssigned(item: BillItem): boolean {
  const assignments = Object.values(item.assignments);

  if (item.shared) {
    return assignments.filter((selected) => selected > 0).length >= 2;
  }

  return (
    assignments.reduce((sum, quantity) => sum + quantity, 0) === item.quantity
  );
}

/**
 * Calcula la distribución completa del consumo y de la propina.
 *
 * @param participants Participantes temporales de la sesión.
 * @param items Productos de la cuenta.
 * @param tipPercent Porcentaje de propina confirmado.
 * @returns Distribución reconciliada en pesos chilenos.
 * @throws {Error} Si existe un producto incompleto o con datos inválidos.
 */
export function calculateBillDistribution(
  participants: Participant[],
  items: BillItem[],
  tipPercent: number,
): BillDistribution {
  if (participants.length === 0) {
    throw new Error("La cuenta necesita al menos un participante.");
  }

  if (!Number.isFinite(tipPercent) || tipPercent < 0) {
    throw new RangeError("La propina no puede ser negativa.");
  }

  const participantIds = new Set(
    participants.map((participant) => participant.id),
  );
  const subtotals = Object.fromEntries(
    participants.map((participant) => [participant.id, 0]),
  );

  for (const item of items) {
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isInteger(item.total) ||
      item.total < 0
    ) {
      throw new Error(`El producto "${item.name}" tiene montos inválidos.`);
    }

    if (!isItemFullyAssigned(item)) {
      throw new Error(`El producto "${item.name}" no está completamente asignado.`);
    }

    const unknownParticipant = Object.keys(item.assignments).find(
      (participantId) => !participantIds.has(participantId),
    );
    if (unknownParticipant) {
      throw new Error(`La asignación referencia a un participante inexistente.`);
    }

    const weights = item.shared
      ? Object.fromEntries(
          Object.entries(item.assignments)
            .filter(([, selected]) => selected > 0)
            .map(([participantId]) => [participantId, 1]),
        )
      : item.assignments;

    const itemAllocations = allocateAmount(item.total, weights);
    for (const [participantId, amount] of Object.entries(itemAllocations)) {
      subtotals[participantId] += amount;
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tip = Math.round((subtotal * tipPercent) / 100);
  const tipAllocations = allocateAmount(tip, subtotals);
  const totals = Object.fromEntries(
    participants.map((participant) => [
      participant.id,
      subtotals[participant.id] + (tipAllocations[participant.id] ?? 0),
    ]),
  );
  const grandTotal = subtotal + tip;
  const distributedTotal = Object.values(totals).reduce(
    (sum, amount) => sum + amount,
    0,
  );

  if (distributedTotal !== grandTotal) {
    throw new Error("La distribución final no coincide con el total pagado.");
  }

  return {
    subtotals,
    tipAllocations,
    totals,
    subtotal,
    tip,
    grandTotal,
  };
}
