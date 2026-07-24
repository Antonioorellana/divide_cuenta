"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  calculateBillDistribution,
  isItemFullyAssigned,
} from "../domain/billing";
import type {
  BillItem,
  Participant,
  ParticipantTone,
} from "../domain/models";

type Step = "capture" | "items" | "people" | "assign" | "summary";

const DEMO_PARTICIPANTS: Participant[] = [
  { id: "pedro", name: "Pedro", tone: "mint" },
  { id: "ana", name: "Ana", tone: "lavender" },
  { id: "luis", name: "Luis", tone: "blue" },
  { id: "carla", name: "Carla", tone: "peach" },
];

const DEMO_ITEMS: BillItem[] = [
  {
    id: "cerveza",
    name: "Cerveza",
    quantity: 4,
    total: 16000,
    shared: false,
    assignments: { pedro: 2, ana: 1, luis: 1 },
  },
  {
    id: "hamburguesa",
    name: "Hamburguesa",
    quantity: 2,
    total: 24000,
    shared: false,
    assignments: { pedro: 1, carla: 1 },
  },
  {
    id: "tabla",
    name: "Tabla",
    quantity: 1,
    total: 15000,
    shared: true,
    assignments: { pedro: 1, ana: 1, luis: 1, carla: 1 },
  },
  {
    id: "agua",
    name: "Agua",
    quantity: 2,
    total: 5000,
    shared: false,
    assignments: { ana: 2 },
  },
];

const TONES: ParticipantTone[] = ["mint", "lavender", "blue", "peach"];
const MAX_PARTICIPANTS = 20;
const MAX_ITEMS = 60;

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function createId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

/**
 * Flujo completo y efímero para dividir una cuenta desde un teléfono.
 *
 * La fotografía y los alias permanecen únicamente en memoria. El componente
 * elimina la sesión después de compartir exitosamente o cuando el usuario lo
 * solicita de forma explícita.
 */
export function CuentaApp() {
  const [step, setStep] = useState<Step>("capture");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [items, setItems] = useState<BillItem[]>([]);
  const [payerId, setPayerId] = useState("");
  const [tipPercent, setTipPercent] = useState(10);
  const [newParticipant, setNewParticipant] = useState("");
  const [participantError, setParticipantError] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("1");
  const [newItemTotal, setNewItemTotal] = useState("");
  const [itemError, setItemError] = useState("");
  const [billImage, setBillImage] = useState<File | null>(null);
  const [billImageUrl, setBillImageUrl] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [sessionDeleted, setSessionDeleted] = useState(false);
  const [sessionResult, setSessionResult] = useState<"shared" | "deleted">(
    "deleted",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!billImageUrl) {
      return;
    }

    return () => URL.revokeObjectURL(billImageUrl);
  }, [billImageUrl]);

  const billSubtotal = items.reduce((sum, item) => sum + item.total, 0);
  const allAssigned =
    items.length > 0 &&
    participants.length >= 2 &&
    items.every(isItemFullyAssigned);
  const distribution = useMemo(
    () =>
      allAssigned
        ? calculateBillDistribution(participants, items, tipPercent)
        : null,
    [allAssigned, items, participants, tipPercent],
  );
  const tipAmount =
    distribution?.tip ?? Math.round((billSubtotal * tipPercent) / 100);
  const grandTotal = distribution?.grandTotal ?? billSubtotal + tipAmount;
  const participantTotals = distribution?.totals ?? {};

  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const assignedUnits = items.reduce((sum, item) => {
    if (item.shared) {
      return (
        sum +
        (Object.values(item.assignments).filter(Boolean).length >= 2
          ? item.quantity
          : 0)
      );
    }

    return (
      sum +
      Object.values(item.assignments).reduce(
        (itemSum, quantity) => itemSum + quantity,
        0,
      )
    );
  }, 0);

  const hasReceipt = Boolean(billImage || usingDemo);

  function resetWorkingData() {
    setParticipants([]);
    setItems([]);
    setPayerId("");
    setTipPercent(10);
    setNewParticipant("");
    setParticipantError("");
    setNewItemName("");
    setNewItemQuantity("1");
    setNewItemTotal("");
    setItemError("");
    setShareStatus("");
  }

  function handleBillImage(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    if (!file) {
      return;
    }

    resetWorkingData();
    setBillImage(file);
    setBillImageUrl(URL.createObjectURL(file));
    setUsingDemo(false);
  }

  function loadDemo() {
    setBillImage(null);
    setBillImageUrl(null);
    setParticipants(DEMO_PARTICIPANTS.map((participant) => ({ ...participant })));
    setItems(
      DEMO_ITEMS.map((item) => ({
        ...item,
        assignments: { ...item.assignments },
      })),
    );
    setPayerId("pedro");
    setTipPercent(10);
    setUsingDemo(true);
    setStep("items");
  }

  function addBillItem() {
    const name = newItemName.trim();
    const quantity = Number(newItemQuantity);
    const total = Number(newItemTotal);

    if (!name) {
      setItemError("Escribe el nombre del consumo.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
      setItemError("La cantidad debe ser un número entre 1 y 99.");
      return;
    }
    if (!Number.isInteger(total) || total <= 0) {
      setItemError("Ingresa el total de esa línea en pesos.");
      return;
    }
    if (items.length >= MAX_ITEMS) {
      setItemError(`El piloto admite hasta ${MAX_ITEMS} consumos.`);
      return;
    }

    setItems((current) => [
      ...current,
      {
        id: createId("item"),
        name,
        quantity,
        total,
        shared: false,
        assignments: {},
      },
    ]);
    setNewItemName("");
    setNewItemQuantity("1");
    setNewItemTotal("");
    setItemError("");
  }

  function updateBillItem(
    itemId: string,
    patch: Partial<Pick<BillItem, "name" | "quantity" | "total">>,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, ...patch, assignments: {} }
          : item,
      ),
    );
  }

  function removeBillItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  function addParticipant() {
    const name = newParticipant.trim();
    if (!name) {
      setParticipantError("Escribe un nombre o alias.");
      return;
    }
    if (
      participants.some(
        (participant) =>
          participant.name.localeCompare(name, "es", {
            sensitivity: "base",
          }) === 0,
      )
    ) {
      setParticipantError("Ese alias ya está en la lista.");
      return;
    }
    if (participants.length >= MAX_PARTICIPANTS) {
      setParticipantError(`El piloto admite hasta ${MAX_PARTICIPANTS} personas.`);
      return;
    }

    const participant: Participant = {
      id: createId("persona"),
      name,
      tone: TONES[participants.length % TONES.length],
    };
    setParticipants((current) => [...current, participant]);
    if (!payerId) {
      setPayerId(participant.id);
    }
    setNewParticipant("");
    setParticipantError("");
  }

  function removeParticipant(participantId: string) {
    const remainingParticipants = participants.filter(
      (participant) => participant.id !== participantId,
    );
    setParticipants(remainingParticipants);
    setItems((currentItems) =>
      currentItems.map((item) => {
        const nextAssignments = { ...item.assignments };
        delete nextAssignments[participantId];
        return { ...item, assignments: nextAssignments };
      }),
    );

    if (payerId === participantId) {
      setPayerId(remainingParticipants[0]?.id ?? "");
    }
  }

  function updateAssignment(itemId: string, participantId: string) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextAssignments = { ...item.assignments };
        const currentQuantity = nextAssignments[participantId] ?? 0;

        if (item.shared) {
          if (currentQuantity > 0) {
            delete nextAssignments[participantId];
          } else {
            nextAssignments[participantId] = 1;
          }
          return { ...item, assignments: nextAssignments };
        }

        const totalAssigned = Object.values(nextAssignments).reduce(
          (sum, quantity) => sum + quantity,
          0,
        );

        if (totalAssigned < item.quantity) {
          nextAssignments[participantId] = currentQuantity + 1;
        } else if (currentQuantity > 0) {
          nextAssignments[participantId] = currentQuantity - 1;
          if (nextAssignments[participantId] === 0) {
            delete nextAssignments[participantId];
          }
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

    return `LA JUSTA · Cuenta del grupo

Pagó ${payer?.name ?? "el pagador"}: ${formatCurrency(grandTotal)}
Consumo: ${formatCurrency(billSubtotal)}
Propina (${tipPercent}%): ${formatCurrency(tipAmount)}

Transferencias a ${payer?.name ?? "el pagador"}:
${transfers}

Parte de ${payer?.name ?? "el pagador"}: ${formatCurrency(
      participantTotals[payerId] ?? 0,
    )}
Total distribuido: ${formatCurrency(grandTotal)} ✓`;
  }

  async function shareSummary() {
    const summary = buildSummary();
    setShareStatus("");

    try {
      const canShareReceipt =
        !billImage ||
        (typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [billImage] }));

      if (typeof navigator.share === "function" && canShareReceipt) {
        await navigator.share({
          title: "La Justa · Resumen",
          text: summary,
          files: billImage ? [billImage] : undefined,
        });
        deleteSession("shared");
        return;
      }

      await navigator.clipboard.writeText(summary);
      setShareStatus(
        billImage
          ? "Resumen copiado. Abre esta app desde Safari para adjuntar también la boleta."
          : "Resumen copiado. La sesión permanece abierta hasta que la finalices.",
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setShareStatus("Envío cancelado. La sesión sigue disponible.");
        return;
      }
      setShareStatus("No pudimos compartir. Inténtalo nuevamente desde Safari.");
    }
  }

  function deleteSession(result: "shared" | "deleted" = "deleted") {
    setBillImage(null);
    setBillImageUrl(null);
    setParticipants([]);
    setItems([]);
    setPayerId("");
    setSessionResult(result);
    setSessionDeleted(true);
  }

  if (sessionDeleted) {
    return (
      <main className="app-frame centered-screen">
        <div className="success-orb">✓</div>
        <p className="overline">
          {sessionResult === "shared" ? "Resumen compartido" : "Sesión eliminada"}
        </p>
        <h1>Todo listo.</h1>
        <p className="muted">
          {sessionResult === "shared"
            ? "La boleta, los alias y las asignaciones fueron eliminados de esta sesión después de compartir."
            : "La boleta, los alias y las asignaciones ya no están disponibles en este dispositivo."}
        </p>
        <button
          className="primary-action"
          onClick={() => window.location.reload()}
        >
          Dividir otra cuenta <span>→</span>
        </button>
      </main>
    );
  }

  return (
    <main className="app-frame">
      <AppHeader step={step} onBack={() => setStep(previousStep(step))} />

      {step === "capture" && (
        <section className="screen capture-screen">
          <div className="hero-copy">
            <h1>
              Divide.
              <br />
              Comparte.
              <br />
              <span>Listo.</span>
            </h1>
            <p>
              Divide una cuenta real por consumo y devuelve cada peso a quien
              pagó.
            </p>
          </div>

          <button
            className={`capture-card ${billImageUrl ? "with-image" : ""}`}
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            {billImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={billImageUrl} alt="Cuenta detallada seleccionada" />
            ) : (
              <div className="receipt-placeholder">
                <span className="camera-orb">▣</span>
                <strong>Fotografiar cuenta</strong>
                <small>Precuenta, comanda o preboleta detallada</small>
              </div>
            )}
            <span className="upload-action">
              <b>▣</b>{" "}
              {billImageUrl ? "Reemplazar cuenta" : "Abrir cámara o fototeca"}
            </span>
          </button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleBillImage}
          />

          {billImage && (
            <button
              className="primary-action capture-continue"
              onClick={() => setStep("items")}
            >
              Ingresar consumos <span>→</span>
            </button>
          )}

          <button className="text-action" type="button" onClick={loadDemo}>
            Probar con una cuenta de ejemplo ↗
          </button>

          <div className="iphone-install-note">
            <span>＋</span>
            <p>
              <strong>Instálala en tu iPhone</strong>
              En Safari toca Compartir y luego “Agregar a inicio”.
            </p>
          </div>

          <div className="feature-grid">
            <article>
              <span className="feature-icon mint">⌁</span>
              <strong>Privada por diseño</strong>
              <p>La foto y los alias no se envían a nuestros servidores.</p>
            </article>
            <article>
              <span className="feature-icon lavender">♙</span>
              <strong>Sin cuentas</strong>
              <p>Usa alias temporales y elimina todo al compartir.</p>
            </article>
          </div>
        </section>
      )}

      {step === "items" && (
        <section className="screen items-screen">
          <ScreenTitle
            title="Revisar consumos"
            description={
              usingDemo
                ? "Esta es una cuenta de ejemplo. Puedes editarla antes de continuar."
                : "Transcribe cada línea de la boleta. El escaneo automático llegará en una versión posterior."
            }
          />

          {billImageUrl && (
            <button
              type="button"
              className="receipt-preview"
              onClick={() => fileInputRef.current?.click()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={billImageUrl} alt="Vista previa de la boleta" />
              <span>Ver o reemplazar foto</span>
            </button>
          )}

          <div className="item-editor-list">
            {items.map((item, index) => (
              <article className="item-editor-card" key={item.id}>
                <span className="item-number">{index + 1}</span>
                <label className="item-name-field">
                  <small>Consumo</small>
                  <input
                    aria-label={`Nombre del consumo ${index + 1}`}
                    value={item.name}
                    maxLength={80}
                    onChange={(event) =>
                      updateBillItem(item.id, { name: event.target.value })
                    }
                  />
                </label>
                <label>
                  <small>Cant.</small>
                  <input
                    aria-label={`Cantidad de ${item.name}`}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="99"
                    value={item.quantity}
                    onChange={(event) => {
                      const quantity = Number(event.target.value);
                      if (
                        Number.isInteger(quantity) &&
                        quantity >= 1 &&
                        quantity <= 99
                      ) {
                        updateBillItem(item.id, { quantity });
                      }
                    }}
                  />
                </label>
                <label>
                  <small>Total línea</small>
                  <input
                    aria-label={`Total de ${item.name}`}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={item.total}
                    onChange={(event) => {
                      const total = Number(event.target.value);
                      if (Number.isInteger(total) && total > 0) {
                        updateBillItem(item.id, { total });
                      }
                    }}
                  />
                </label>
                <button
                  className="remove-item"
                  type="button"
                  onClick={() => removeBillItem(item.id)}
                  aria-label={`Eliminar ${item.name}`}
                >
                  ×
                </button>
              </article>
            ))}
          </div>

          <div className="new-item-card">
            <p>Agregar consumo</p>
            <label className="new-item-name">
              <small>Nombre</small>
              <input
                placeholder="Ej. Cerveza"
                maxLength={80}
                value={newItemName}
                onChange={(event) => setNewItemName(event.target.value)}
              />
            </label>
            <label>
              <small>Cantidad</small>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="99"
                value={newItemQuantity}
                onChange={(event) => setNewItemQuantity(event.target.value)}
              />
            </label>
            <label>
              <small>Total línea</small>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="12000"
                value={newItemTotal}
                onChange={(event) => setNewItemTotal(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addBillItem();
                  }
                }}
              />
            </label>
            <button type="button" onClick={addBillItem}>
              + Agregar
            </button>
          </div>
          {itemError && <p className="form-error">{itemError}</p>}

          <div className="bill-subtotal">
            <span>
              {items.length} {items.length === 1 ? "consumo" : "consumos"}
            </span>
            <strong>Subtotal {formatCurrency(billSubtotal)}</strong>
          </div>

          <button
            className="primary-action sticky-action"
            disabled={
              items.length === 0 ||
              items.some(
                (item) =>
                  !item.name.trim() || item.quantity <= 0 || item.total <= 0,
              )
            }
            onClick={() => setStep("people")}
          >
            Continuar a personas <span>→</span>
          </button>
        </section>
      )}

      {step === "people" && (
        <section className="screen">
          <ScreenTitle
            title="Participantes"
            description="Añade al menos dos alias y selecciona quién pagó el total."
          />

          <div className="add-person-field">
            <input
              aria-label="Nombre o alias"
              placeholder="Agregar alias..."
              maxLength={40}
              value={newParticipant}
              onChange={(event) => setNewParticipant(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  addParticipant();
                }
              }}
            />
            <button type="button" onClick={addParticipant} aria-label="Agregar">
              +
            </button>
          </div>
          {participantError && <p className="form-error">{participantError}</p>}

          <div className="participant-list">
            {participants.map((participant) => (
              <article
                className={`participant-row ${
                  payerId === participant.id ? "payer-selected" : ""
                }`}
                key={participant.id}
              >
                <button
                  className="payer-selector"
                  type="button"
                  onClick={() => setPayerId(participant.id)}
                  aria-label={`${participant.name}${
                    payerId === participant.id ? ", pagó la cuenta" : ""
                  }`}
                >
                  <ParticipantAvatar participant={participant} />
                  <span className="participant-info">
                    <strong>{participant.name}</strong>
                    <small>
                      {payerId === participant.id
                        ? "Pagó la cuenta"
                        : "Toca para marcar quién pagó"}
                    </small>
                  </span>
                  <span className="payer-choice">
                    <small>¿Pagó?</small>
                    <b>{payerId === participant.id ? "✓" : ""}</b>
                  </span>
                </button>
                <button
                  className="remove-person"
                  type="button"
                  onClick={() => removeParticipant(participant.id)}
                  aria-label={`Eliminar a ${participant.name}`}
                >
                  ×
                </button>
              </article>
            ))}
          </div>

          {participants.length === 0 && (
            <p className="empty-state">Todavía no agregas participantes.</p>
          )}

          <button
            className="primary-action sticky-action"
            disabled={participants.length < 2 || !payerId}
            onClick={() => setStep("assign")}
          >
            Continuar a consumos <span>→</span>
          </button>
        </section>
      )}

      {step === "assign" && (
        <section className="screen assign-screen">
          <ScreenTitle
            title="Asignar consumo"
            description="Toca un alias por cada unidad. Activa Compartir cuando todos comieron del mismo consumo."
          />

          <div className="consumption-list">
            {items.map((item) => {
              const totalAssigned = Object.values(item.assignments).reduce(
                (sum, quantity) => sum + quantity,
                0,
              );
              const selectedPeople = Object.values(item.assignments).filter(
                Boolean,
              ).length;
              const complete = item.shared
                ? selectedPeople >= 2
                : totalAssigned === item.quantity;

              return (
                <article className="consumption-card" key={item.id}>
                  <div className="consumption-heading">
                    <div>
                      <strong>
                        {item.quantity}× {item.name}
                      </strong>
                      <b>{formatCurrency(item.total)}</b>
                    </div>
                    <span
                      className={
                        complete ? "status-complete" : "status-pending"
                      }
                    >
                      {complete ? "✓ Completo" : "○ Incompleto"}
                    </span>
                  </div>

                  <div className="assignment-pills">
                    {participants.map((participant) => {
                      const quantity = item.assignments[participant.id] ?? 0;
                      return (
                        <button
                          className={`person-assignment ${participant.tone} ${
                            quantity > 0 ? "active" : ""
                          }`}
                          type="button"
                          key={participant.id}
                          onClick={() =>
                            updateAssignment(item.id, participant.id)
                          }
                          aria-label={`${participant.name}: ${
                            item.shared
                              ? quantity
                                ? "seleccionado"
                                : "no seleccionado"
                              : `${quantity} unidades`
                          } de ${item.name}`}
                        >
                          <span>{participant.name}</span>
                          <strong>
                            {item.shared
                              ? quantity
                                ? "✓"
                                : "—"
                              : quantity || "—"}
                          </strong>
                        </button>
                      );
                    })}
                    {!item.shared && !complete && (
                      <span className="pending-unit">
                        <small>Pendiente</small>
                        <b>{item.quantity - totalAssigned}</b>
                      </span>
                    )}
                  </div>

                  <label className="share-control">
                    <span>
                      <strong>Compartir</strong>
                      <small>Divide el valor entre los seleccionados</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={item.shared}
                      onChange={() => toggleShared(item.id)}
                    />
                    <i aria-hidden="true" />
                  </label>
                </article>
              );
            })}
          </div>

          <div className="tip-panel">
            <span>
              <small>Propina proporcional</small>
              <strong>{formatCurrency(tipAmount)}</strong>
            </span>
            <div>
              {[0, 10, 15].map((percent) => (
                <button
                  type="button"
                  className={tipPercent === percent ? "selected" : ""}
                  key={percent}
                  onClick={() => setTipPercent(percent)}
                >
                  {percent}%
                </button>
              ))}
            </div>
          </div>

          <div className="assignment-footer">
            <span className={allAssigned ? "ready" : ""}>
              {allAssigned
                ? "✓ Todo asignado"
                : `⚠ ${totalUnits - assignedUnits} ${
                    totalUnits - assignedUnits === 1
                      ? "unidad pendiente"
                      : "unidades pendientes"
                  }`}
            </span>
            <strong>{formatCurrency(grandTotal)} total</strong>
            <button
              className="primary-action"
              disabled={!allAssigned}
              onClick={() => setStep("summary")}
            >
              Ver resumen <span>→</span>
            </button>
          </div>
        </section>
      )}

      {step === "summary" && (
        <section className="screen summary-screen">
          <ScreenTitle
            title="Resumen de la cuenta"
            description={`Los demás transfieren su monto a ${
              participants.find((participant) => participant.id === payerId)
                ?.name ?? "quien pagó"
            }.`}
          />

          <article className="final-total-card">
            <span>
              <small>Total pagado</small>
              <strong>{formatCurrency(grandTotal)}</strong>
            </span>
            <div>
              <p>
                <small>Consumo</small>
                <b>{formatCurrency(billSubtotal)}</b>
              </p>
              <p>
                <small>Propina ({tipPercent}%)</small>
                <b>{formatCurrency(tipAmount)}</b>
              </p>
            </div>
          </article>

          <p className="section-label">Participantes</p>
          <div className="summary-list">
            {participants.map((participant) => (
              <article
                className={`summary-person ${
                  participant.id === payerId ? "payer-summary" : ""
                }`}
                key={participant.id}
              >
                <ParticipantAvatar participant={participant} />
                <span>
                  <strong>{participant.name}</strong>
                  <small>
                    {participant.id === payerId ? "Parte propia" : "Transfiere"}
                  </small>
                </span>
                <b>{formatCurrency(participantTotals[participant.id] ?? 0)}</b>
              </article>
            ))}
          </div>

          <div className="distributed-check">
            <span>✓</span> Total distribuido: {formatCurrency(grandTotal)}
          </div>

          <div className="privacy-before-share">
            La sesión se elimina después de compartir exitosamente.
          </div>
          <button
            className="primary-action share-action"
            onClick={shareSummary}
          >
            ↗ {billImage ? "Compartir resumen y boleta" : "Compartir resumen"}
          </button>
          {shareStatus && <p className="share-status">{shareStatus}</p>}
          <button
            className="delete-action"
            onClick={() => deleteSession("deleted")}
          >
            ⊗ Finalizar sin compartir
          </button>
        </section>
      )}

      <BottomNavigation
        step={step}
        hasReceipt={hasReceipt}
        hasItems={items.length > 0}
        hasParticipants={participants.length >= 2}
        canSummarize={allAssigned}
        onNavigate={setStep}
      />
      {usingDemo && step !== "capture" && (
        <span className="demo-badge">Cuenta de ejemplo</span>
      )}
    </main>
  );
}

function AppHeader({
  step,
  onBack,
}: {
  step: Step;
  onBack: () => void;
}) {
  return (
    <header className="app-header">
      <button
        type="button"
        className={step === "capture" ? "brand-button" : "back-button"}
        onClick={step === "capture" ? undefined : onBack}
        aria-label={step === "capture" ? "La Justa" : "Volver"}
      >
        {step === "capture" ? "◴" : "←"}
      </button>
      <strong>La Justa</strong>
      <span className="pilot-badge">Piloto</span>
    </header>
  );
}

function ScreenTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="screen-title">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function ParticipantAvatar({ participant }: { participant: Participant }) {
  return (
    <span className={`participant-avatar ${participant.tone}`}>
      {participant.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function BottomNavigation({
  step,
  hasReceipt,
  hasItems,
  hasParticipants,
  canSummarize,
  onNavigate,
}: {
  step: Step;
  hasReceipt: boolean;
  hasItems: boolean;
  hasParticipants: boolean;
  canSummarize: boolean;
  onNavigate: (step: Step) => void;
}) {
  const navigationItems: Array<{
    step: Step;
    icon: string;
    label: string;
    enabled: boolean;
  }> = [
    { step: "capture", icon: "▣", label: "Cuenta", enabled: true },
    { step: "items", icon: "≡", label: "Ítems", enabled: hasReceipt },
    { step: "people", icon: "♙", label: "Personas", enabled: hasItems },
    {
      step: "assign",
      icon: "▤",
      label: "Consumos",
      enabled: hasItems && hasParticipants,
    },
    {
      step: "summary",
      icon: "▧",
      label: "Resumen",
      enabled: canSummarize,
    },
  ];

  return (
    <nav className="bottom-navigation" aria-label="Pasos">
      {navigationItems.map((item) => (
        <button
          type="button"
          key={item.step}
          className={step === item.step ? "active" : ""}
          disabled={!item.enabled}
          onClick={() => onNavigate(item.step)}
          aria-label={item.label}
        >
          <span>{item.icon}</span>
          <small>{item.label}</small>
        </button>
      ))}
    </nav>
  );
}

function previousStep(step: Step): Step {
  if (step === "summary") return "assign";
  if (step === "assign") return "people";
  if (step === "people") return "items";
  return "capture";
}
