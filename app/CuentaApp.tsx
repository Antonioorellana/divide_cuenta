"use client";

import {
  ChangeEvent,
  useMemo,
  useRef,
  useState,
} from "react";

type Participant = {
  id: string;
  name: string;
};

type BillItem = {
  id: string;
  name: string;
  quantity: number;
  total: number;
  shared: boolean;
  assignments: Record<string, number>;
};

const INITIAL_PARTICIPANTS: Participant[] = [
  { id: "pedro", name: "Pedro" },
  { id: "ana", name: "Ana" },
  { id: "luis", name: "Luis" },
  { id: "carla", name: "Carla" },
];

const INITIAL_ITEMS: BillItem[] = [
  {
    id: "cerveza",
    name: "Cerveza artesanal",
    quantity: 4,
    total: 16000,
    shared: false,
    assignments: { pedro: 2, ana: 1, luis: 1 },
  },
  {
    id: "hamburguesa",
    name: "Hamburguesa de la casa",
    quantity: 2,
    total: 24000,
    shared: false,
    assignments: { pedro: 1, carla: 1 },
  },
  {
    id: "tabla",
    name: "Tabla para compartir",
    quantity: 1,
    total: 15000,
    shared: true,
    assignments: { pedro: 1, ana: 1, luis: 1, carla: 1 },
  },
  {
    id: "agua",
    name: "Agua mineral",
    quantity: 2,
    total: 5000,
    shared: false,
    assignments: { ana: 1 },
  },
];

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/**
 * Distribuye un monto entero de forma proporcional usando restos mayores.
 * Esto garantiza que los montos individuales sumen exactamente el total.
 */
function allocateAmount(
  total: number,
  weights: Record<string, number>,
): Record<string, number> {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);

  if (totalWeight === 0 || entries.length === 0) {
    return {};
  }

  const allocations = entries.map(([id, weight]) => {
    const exact = (total * weight) / totalWeight;
    const base = Math.floor(exact);
    return { id, value: base, remainder: exact - base };
  });

  let remaining = total - allocations.reduce((sum, item) => sum + item.value, 0);
  allocations.sort(
    (first, second) =>
      second.remainder - first.remainder || first.id.localeCompare(second.id),
  );

  for (let index = 0; index < allocations.length && remaining > 0; index += 1) {
    allocations[index].value += 1;
    remaining -= 1;
  }

  return Object.fromEntries(allocations.map(({ id, value }) => [id, value]));
}

function calculateSubtotals(
  participants: Participant[],
  items: BillItem[],
): Record<string, number> {
  const subtotals = Object.fromEntries(
    participants.map((participant) => [participant.id, 0]),
  );

  for (const item of items) {
    const weights = item.shared
      ? Object.fromEntries(
          Object.entries(item.assignments)
            .filter(([, selected]) => selected > 0)
            .map(([participantId]) => [participantId, 1]),
        )
      : item.assignments;
    const itemAllocations = allocateAmount(item.total, weights);

    for (const [participantId, amount] of Object.entries(itemAllocations)) {
      subtotals[participantId] = (subtotals[participantId] ?? 0) + amount;
    }
  }

  return subtotals;
}

export function CuentaApp() {
  const [participants, setParticipants] =
    useState<Participant[]>(INITIAL_PARTICIPANTS);
  const [items, setItems] = useState<BillItem[]>(INITIAL_ITEMS);
  const [payerId, setPayerId] = useState("pedro");
  const [tipPercent, setTipPercent] = useState(10);
  const [newParticipant, setNewParticipant] = useState("");
  const [billImage, setBillImage] = useState<File | null>(null);
  const [billImageUrl, setBillImageUrl] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const billSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.total, 0),
    [items],
  );
  const tipAmount = Math.round((billSubtotal * tipPercent) / 100);
  const grandTotal = billSubtotal + tipAmount;
  const subtotals = useMemo(
    () => calculateSubtotals(participants, items),
    [participants, items],
  );
  const tipAllocations = useMemo(
    () => allocateAmount(tipAmount, subtotals),
    [tipAmount, subtotals],
  );
  const participantTotals = Object.fromEntries(
    participants.map((participant) => [
      participant.id,
      (subtotals[participant.id] ?? 0) +
        (tipAllocations[participant.id] ?? 0),
    ]),
  );
  const assignedUnits = items.reduce(
    (sum, item) =>
      sum +
      (item.shared
        ? item.quantity
        : Object.values(item.assignments).reduce(
            (itemSum, quantity) => itemSum + quantity,
            0,
          )),
    0,
  );
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const allAssigned = items.every((item) =>
    item.shared
      ? Object.values(item.assignments).filter(Boolean).length >= 2
      : Object.values(item.assignments).reduce(
          (sum, quantity) => sum + quantity,
          0,
        ) === item.quantity,
  );

  function handleBillImage(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    if (file) {
      if (billImageUrl) {
        URL.revokeObjectURL(billImageUrl);
      }
      setBillImage(file);
      setBillImageUrl(URL.createObjectURL(file));
      setShareStatus("");
    }
  }

  function addParticipant() {
    const trimmedName = newParticipant.trim();
    if (!trimmedName) {
      return;
    }

    setParticipants((current) => [
      ...current,
      {
        id: `${trimmedName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
        name: trimmedName,
      },
    ]);
    setNewParticipant("");
  }

  function updateAssignment(itemId: string, participantId: string) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        if (item.shared) {
          const nextAssignments = { ...item.assignments };
          if (nextAssignments[participantId]) {
            delete nextAssignments[participantId];
          } else {
            nextAssignments[participantId] = 1;
          }
          return { ...item, assignments: nextAssignments };
        }

        const assigned = Object.values(item.assignments).reduce(
          (sum, quantity) => sum + quantity,
          0,
        );
        const currentQuantity = item.assignments[participantId] ?? 0;
        const nextAssignments = { ...item.assignments };

        if (currentQuantity > 0 && assigned >= item.quantity) {
          nextAssignments[participantId] = currentQuantity - 1;
        } else if (assigned < item.quantity) {
          nextAssignments[participantId] = currentQuantity + 1;
        } else {
          return item;
        }

        if (nextAssignments[participantId] === 0) {
          delete nextAssignments[participantId];
        }

        return { ...item, assignments: nextAssignments };
      }),
    );
  }

  function toggleShared(itemId: string) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? { ...item, shared: !item.shared, assignments: {} }
          : item,
      ),
    );
  }

  function buildSummary(): string {
    const payer = participants.find(
      (participant) => participant.id === payerId,
    );
    const transfers = participants
      .filter((participant) => participant.id !== payerId)
      .map(
        (participant) =>
          `• ${participant.name}: ${formatCurrency(
            participantTotals[participant.id] ?? 0,
          )}`,
      )
      .join("\n");

    return `Cuenta del grupo 🍻

Total pagado por ${payer?.name ?? "el pagador"}: ${formatCurrency(grandTotal)}
Consumo: ${formatCurrency(billSubtotal)}
Propina (${tipPercent}%): ${formatCurrency(tipAmount)}

Transferencias:
${transfers}

Parte de ${payer?.name ?? "el pagador"}: ${formatCurrency(
      participantTotals[payerId] ?? 0,
    )}
Total distribuido: ${formatCurrency(grandTotal)} ✅`;
  }

  async function shareSummary() {
    const summary = buildSummary();
    const shareData: ShareData = {
      title: "División de la cuenta",
      text: summary,
      files: billImage ? [billImage] : undefined,
    };

    try {
      const canShareFiles =
        !billImage ||
        (typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [billImage] }));

      if (typeof navigator.share === "function" && canShareFiles) {
        await navigator.share(shareData);
        setShareStatus("El resumen se entregó al menú de compartir.");
        return;
      }

      await navigator.clipboard.writeText(summary);
      setShareStatus(
        "Tu dispositivo no permite adjuntar la imagen desde aquí. El resumen quedó copiado.",
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setShareStatus("El envío fue cancelado. La cuenta sigue disponible.");
        return;
      }
      setShareStatus("No pudimos compartir. Intenta copiar el resumen.");
    }
  }

  function clearSession() {
    if (billImageUrl) {
      URL.revokeObjectURL(billImageUrl);
    }
    setParticipants([]);
    setItems([]);
    setBillImage(null);
    setBillImageUrl(null);
    setPayerId("");
    setShowSummary(false);
    setShareStatus("");
  }

  if (participants.length === 0 && items.length === 0) {
    return (
      <main className="empty-state">
        <div className="brand-mark">LJ</div>
        <p className="eyebrow">Sesión eliminada</p>
        <h1>La cuenta ya no está en este dispositivo.</h1>
        <p>
          Recarga la página para iniciar una nueva división desde cero.
        </p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">LJ</span>
          <div>
            <strong>La Justa</strong>
            <small>Divide. Comparte. Listo.</small>
          </div>
        </div>
        <span className="privacy-pill">
          <span aria-hidden="true">●</span> Sesión temporal
        </span>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Cuenta activa · Mesa 12</p>
          <h1>¿Quién consumió qué?</h1>
          <p className="hero-copy">
            Marca las cantidades o activa “Compartir” cuando el consumo fue
            grupal.
          </p>
        </div>

        <button
          className={`bill-preview ${billImageUrl ? "has-image" : ""}`}
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          {billImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={billImageUrl} alt="Vista previa de la cuenta fotografiada" />
          ) : (
            <>
              <span className="receipt-icon" aria-hidden="true">
                ▤
              </span>
              <span>
                <strong>Adjuntar cuenta</strong>
                <small>Foto de la precuenta</small>
              </span>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleBillImage}
        />
      </section>

      <section className="people-panel" aria-labelledby="people-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Paso 1</p>
            <h2 id="people-title">Asistentes</h2>
          </div>
          <span>{participants.length} personas</span>
        </div>

        <div className="people-list">
          {participants.map((participant) => (
            <label
              className={`person-chip ${
                payerId === participant.id ? "is-payer" : ""
              }`}
              key={participant.id}
            >
              <input
                type="radio"
                name="payer"
                value={participant.id}
                checked={payerId === participant.id}
                onChange={() => setPayerId(participant.id)}
              />
              <span className="avatar">{participant.name.slice(0, 1)}</span>
              <span>
                <strong>{participant.name}</strong>
                <small>
                  {payerId === participant.id ? "Pagó la cuenta" : "Asistente"}
                </small>
              </span>
            </label>
          ))}
          <div className="add-person">
            <input
              aria-label="Nombre o alias del nuevo asistente"
              placeholder="Agregar alias"
              value={newParticipant}
              onChange={(event) => setNewParticipant(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  addParticipant();
                }
              }}
            />
            <button type="button" onClick={addParticipant}>
              +
            </button>
          </div>
        </div>
      </section>

      <section className="items-section" aria-labelledby="items-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Paso 2</p>
            <h2 id="items-title">Detalle del consumo</h2>
          </div>
          <div className={`progress-badge ${allAssigned ? "complete" : ""}`}>
            {assignedUnits}/{totalUnits} asignados
          </div>
        </div>

        <div className="items-list">
          {items.map((item) => {
            const itemAssigned = Object.values(item.assignments).reduce(
              (sum, quantity) => sum + quantity,
              0,
            );
            const complete = item.shared
              ? Object.values(item.assignments).filter(Boolean).length >= 2
              : itemAssigned === item.quantity;

            return (
              <article
                className={`item-card ${complete ? "is-complete" : ""}`}
                key={item.id}
              >
                <div className="item-topline">
                  <div className="item-description">
                    <span className="quantity">{item.quantity}×</span>
                    <div>
                      <h3>{item.name}</h3>
                      <small>
                        {formatCurrency(Math.round(item.total / item.quantity))}{" "}
                        c/u
                      </small>
                    </div>
                  </div>
                  <div className="item-price">
                    <strong>{formatCurrency(item.total)}</strong>
                    <span>{complete ? "Completo" : "Pendiente"}</span>
                  </div>
                </div>

                <div className="assignment-row">
                  {participants.map((participant) => {
                    const selectedQuantity =
                      item.assignments[participant.id] ?? 0;
                    return (
                      <button
                        className={`assignment-cell ${
                          selectedQuantity > 0 ? "selected" : ""
                        }`}
                        type="button"
                        key={participant.id}
                        onClick={() =>
                          updateAssignment(item.id, participant.id)
                        }
                        aria-label={`${participant.name}: ${
                          item.shared
                            ? selectedQuantity
                              ? "incluido"
                              : "no incluido"
                            : `${selectedQuantity} unidades`
                        }`}
                      >
                        <span className="mini-avatar">
                          {participant.name.slice(0, 1)}
                        </span>
                        <span className="assignment-name">
                          {participant.name}
                        </span>
                        <span className="assignment-value">
                          {item.shared
                            ? selectedQuantity
                              ? "✓"
                              : "—"
                            : selectedQuantity || "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="item-footer">
                  <label className="share-toggle">
                    <input
                      type="checkbox"
                      checked={item.shared}
                      onChange={() => toggleShared(item.id)}
                    />
                    <span className="toggle-track" aria-hidden="true">
                      <span />
                    </span>
                    Compartir este consumo
                  </label>
                  <small>
                    {item.shared
                      ? "El monto se divide entre las personas marcadas"
                      : `Quedan ${Math.max(
                          item.quantity - itemAssigned,
                          0,
                        )} unidades`}
                  </small>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="totals-card">
        <div>
          <p className="eyebrow">Paso 3</p>
          <h2>Propina y total</h2>
        </div>
        <div className="tip-options" aria-label="Porcentaje de propina">
          {[0, 10, 15].map((percent) => (
            <button
              type="button"
              className={tipPercent === percent ? "active" : ""}
              key={percent}
              onClick={() => setTipPercent(percent)}
            >
              {percent}%
            </button>
          ))}
          <label>
            Otro
            <input
              type="number"
              min="0"
              max="100"
              value={tipPercent}
              onChange={(event) =>
                setTipPercent(Math.max(0, Number(event.target.value)))
              }
            />
            %
          </label>
        </div>
        <div className="totals-lines">
          <span>Consumo <strong>{formatCurrency(billSubtotal)}</strong></span>
          <span>Propina proporcional <strong>{formatCurrency(tipAmount)}</strong></span>
          <span className="grand-total">
            Total pagado <strong>{formatCurrency(grandTotal)}</strong>
          </span>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={!allAssigned}
          onClick={() => setShowSummary(true)}
        >
          {allAssigned ? "Revisar división" : "Completa los consumos pendientes"}
          <span aria-hidden="true">→</span>
        </button>
      </section>

      {showSummary && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowSummary(false);
            }
          }}
        >
          <section
            className="summary-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="summary-title"
          >
            <div className="summary-handle" />
            <div className="summary-header">
              <div>
                <p className="eyebrow">Todo cuadra</p>
                <h2 id="summary-title">Resumen para el grupo</h2>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowSummary(false)}
                aria-label="Cerrar resumen"
              >
                ×
              </button>
            </div>

            <div className="payer-summary">
              <span>Pagó la cuenta</span>
              <strong>
                {participants.find((person) => person.id === payerId)?.name}
              </strong>
              <b>{formatCurrency(grandTotal)}</b>
            </div>

            <div className="transfer-list">
              {participants.map((participant) => (
                <div
                  className={`transfer-row ${
                    participant.id === payerId ? "payer-row" : ""
                  }`}
                  key={participant.id}
                >
                  <span className="avatar">{participant.name.slice(0, 1)}</span>
                  <div>
                    <strong>{participant.name}</strong>
                    <small>
                      Consumo {formatCurrency(subtotals[participant.id] ?? 0)} ·
                      Propina{" "}
                      {formatCurrency(tipAllocations[participant.id] ?? 0)}
                    </small>
                  </div>
                  <span className="transfer-amount">
                    {participant.id === payerId
                      ? "Parte propia"
                      : "Transfiere"}
                    <strong>
                      {formatCurrency(participantTotals[participant.id] ?? 0)}
                    </strong>
                  </span>
                </div>
              ))}
            </div>

            <div className="summary-check">
              <span aria-hidden="true">✓</span>
              <p>
                <strong>{formatCurrency(grandTotal)} distribuidos</strong>
                <small>La suma coincide con el total pagado.</small>
              </p>
            </div>

            <button
              className="primary-button whatsapp-button"
              type="button"
              onClick={shareSummary}
            >
              Compartir cuenta y resumen
              <span aria-hidden="true">↗</span>
            </button>
            {shareStatus && <p className="share-status">{shareStatus}</p>}
            <button className="delete-button" type="button" onClick={clearSession}>
              Finalizar y eliminar sesión
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
