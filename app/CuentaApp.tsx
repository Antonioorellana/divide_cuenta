"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import {
  calculateBillDistribution,
  isItemFullyAssigned,
} from "../domain/billing";
import type {
  BillItem,
  Participant,
  ParticipantTone,
} from "../domain/models";

type Step = "capture" | "people" | "assign" | "summary";

const INITIAL_PARTICIPANTS: Participant[] = [
  { id: "pedro", name: "Pedro", tone: "mint" },
  { id: "ana", name: "Ana", tone: "lavender" },
  { id: "luis", name: "Luis", tone: "blue" },
  { id: "carla", name: "Carla", tone: "peach" },
];

const INITIAL_ITEMS: BillItem[] = [
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
    assignments: { ana: 1 },
  },
];

const TONES: ParticipantTone[] = ["mint", "lavender", "blue", "peach"];

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function CuentaApp() {
  const [step, setStep] = useState<Step>("capture");
  const [participants, setParticipants] =
    useState<Participant[]>(INITIAL_PARTICIPANTS);
  const [items, setItems] = useState<BillItem[]>(INITIAL_ITEMS);
  const [payerId, setPayerId] = useState("pedro");
  const [tipPercent, setTipPercent] = useState(10);
  const [newParticipant, setNewParticipant] = useState("");
  const [billImage, setBillImage] = useState<File | null>(null);
  const [billImageUrl, setBillImageUrl] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [sessionDeleted, setSessionDeleted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const billSubtotal = items.reduce((sum, item) => sum + item.total, 0);
  const allAssigned = items.every(isItemFullyAssigned);
  const distribution = useMemo(
    () =>
      allAssigned && participants.length > 0
        ? calculateBillDistribution(participants, items, tipPercent)
        : null,
    [allAssigned, items, participants, tipPercent],
  );
  const tipAmount = distribution?.tip ?? Math.round((billSubtotal * tipPercent) / 100);
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

  function handleBillImage(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    if (!file) {
      return;
    }
    if (billImageUrl) {
      URL.revokeObjectURL(billImageUrl);
    }
    setBillImage(file);
    setBillImageUrl(URL.createObjectURL(file));
    setUsingDemo(false);
  }

  function addParticipant() {
    const name = newParticipant.trim();
    if (!name) {
      return;
    }
    setParticipants((current) => [
      ...current,
      {
        id: `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
        name,
        tone: TONES[current.length % TONES.length],
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
    try {
      const canShareFile =
        !billImage ||
        (typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [billImage] }));

      if (typeof navigator.share === "function" && canShareFile) {
        await navigator.share({
          title: "La Justa · Resumen",
          text: summary,
          files: billImage ? [billImage] : undefined,
        });
        setShareStatus("Resumen entregado al menú de compartir.");
        return;
      }

      await navigator.clipboard.writeText(summary);
      setShareStatus("Resumen copiado. Tu navegador no admite adjuntar archivos.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setShareStatus("Envío cancelado. La sesión sigue disponible.");
        return;
      }
      setShareStatus("No pudimos compartir el resumen.");
    }
  }

  function deleteSession() {
    if (billImageUrl) {
      URL.revokeObjectURL(billImageUrl);
    }
    setBillImage(null);
    setBillImageUrl(null);
    setParticipants([]);
    setItems([]);
    setSessionDeleted(true);
  }

  if (sessionDeleted) {
    return (
      <main className="app-frame centered-screen">
        <div className="success-orb">✓</div>
        <p className="overline">Sesión eliminada</p>
        <h1>Todo listo.</h1>
        <p className="muted">
          La cuenta, los alias y las asignaciones ya no están en este
          dispositivo.
        </p>
        <button className="primary-action" onClick={() => window.location.reload()}>
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
              La forma más rápida y ordenada de gestionar cuentas compartidas
              entre amigos.
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
                <strong>Cuenta detallada</strong>
                <small>Precuenta, comanda o preboleta</small>
              </div>
            )}
            <span className="upload-action">
              <b>▣</b> {billImageUrl ? "Reemplazar cuenta" : "Subir cuenta detallada"}
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

          <button
            className="text-action"
            type="button"
            onClick={() => {
              setUsingDemo(true);
              setStep("people");
            }}
          >
            Usar cuenta de ejemplo ↗
          </button>

          {billImage && (
            <button className="primary-action" onClick={() => setStep("people")}>
              Continuar con esta cuenta <span>→</span>
            </button>
          )}

          <div className="feature-grid">
            <article>
              <span className="feature-icon mint">⌁</span>
              <strong>Escaneo IA</strong>
              <p>Próxima etapa: detección y revisión automática de productos.</p>
            </article>
            <article>
              <span className="feature-icon lavender">♙</span>
              <strong>Sin fricción</strong>
              <p>Alias temporales, sin cuentas ni datos personales.</p>
            </article>
          </div>
        </section>
      )}

      {step === "people" && (
        <section className="screen">
          <ScreenTitle
            title="Participantes"
            description="Añade a quienes compartieron la cuenta y selecciona quién pagó el total."
          />

          <div className="add-person-field">
            <input
              aria-label="Nombre o alias"
              placeholder="Agregar nombre..."
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

          <div className="participant-list">
            {participants.map((participant) => (
              <button
                className={`participant-row ${
                  payerId === participant.id ? "payer-selected" : ""
                }`}
                type="button"
                key={participant.id}
                onClick={() => setPayerId(participant.id)}
              >
                <ParticipantAvatar participant={participant} />
                <span className="participant-info">
                  <strong>{participant.name}</strong>
                  <small>
                    {payerId === participant.id
                      ? "Realizó el pago"
                      : "Participante"}
                  </small>
                </span>
                <span className="payer-choice">
                  <small>¿Pagó?</small>
                  <b>{payerId === participant.id ? "✓" : ""}</b>
                </span>
              </button>
            ))}
          </div>

          <button className="primary-action sticky-action" onClick={() => setStep("assign")}>
            Continuar a consumos <span>→</span>
          </button>
        </section>
      )}

      {step === "assign" && (
        <section className="screen assign-screen">
          <ScreenTitle
            title="Asignar consumo"
            description="Reparte los productos entre los participantes."
          />

          <div className="consumption-list">
            {items.map((item) => {
              const totalAssigned = Object.values(item.assignments).reduce(
                (sum, quantity) => sum + quantity,
                0,
              );
              const selectedPeople = Object.values(item.assignments).filter(Boolean)
                .length;
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
                    <span className={complete ? "status-complete" : "status-pending"}>
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
                        >
                          <span>{participant.name}</span>
                          <strong>
                            {item.shared ? (quantity ? "✓" : "—") : quantity || "—"}
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
              <small>Propina</small>
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
              {allAssigned ? "✓ Todo asignado" : `⚠ ${totalUnits - assignedUnits} unidad pendiente`}
            </span>
            <strong>{formatCurrency(grandTotal)} total</strong>
            <button
              className="primary-action"
              disabled={!allAssigned}
              onClick={() => setStep("summary")}
            >
              Continuar <span>→</span>
            </button>
          </div>
        </section>
      )}

      {step === "summary" && (
        <section className="screen summary-screen">
          <ScreenTitle
            title="Resumen de la cuenta"
            description="Todo listo. Aquí tienes el desglose final."
          />

          <article className="final-total-card">
            <span>
              <small>Total final</small>
              <strong>{formatCurrency(grandTotal)}</strong>
            </span>
            <div>
              <p>
                <small>Subtotal</small>
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

          <button className="primary-action share-action" onClick={shareSummary}>
            ↗ Compartir resumen
          </button>
          {shareStatus && <p className="share-status">{shareStatus}</p>}
          <button className="delete-action" onClick={deleteSession}>
            ⊗ Finalizar y eliminar sesión
          </button>
        </section>
      )}

      <BottomNavigation
        step={step}
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
      <button type="button" className="menu-button" aria-label="Más opciones">
        ⋮
      </button>
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
  canSummarize,
  onNavigate,
}: {
  step: Step;
  canSummarize: boolean;
  onNavigate: (step: Step) => void;
}) {
  const items: Array<{ step: Step; icon: string; label: string }> = [
    { step: "capture", icon: "▣", label: "Cuenta" },
    { step: "people", icon: "♙", label: "Personas" },
    { step: "assign", icon: "▤", label: "Consumos" },
    { step: "summary", icon: "▧", label: "Resumen" },
  ];

  return (
    <nav className="bottom-navigation" aria-label="Pasos">
      {items.map((item) => (
        <button
          type="button"
          key={item.step}
          className={step === item.step ? "active" : ""}
          disabled={item.step === "summary" && !canSummarize}
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
  return "capture";
}
