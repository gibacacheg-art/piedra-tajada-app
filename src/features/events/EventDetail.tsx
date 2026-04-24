"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Event } from "@/types/database";
import {
  getClosureLabel,
  getEventNextAction,
  getVisibleBalance,
  loadEventDetailSnapshot,
  type ActivityLogEntry,
  type CoordinationSummary,
  type EventRequestSummary
} from "./eventDetailSupport";
import { EventChecklists } from "./EventChecklists";
import { EventComments } from "./EventComments";
import { EventDocuments } from "./EventDocuments";
import { EventPayments } from "./EventPayments";
import { EventResponsibles } from "./EventResponsibles";
import { EventTasks } from "./EventTasks";
import { RequestQuoteItems } from "@/features/requests/RequestQuoteItems";

const editableStatuses = [
  { value: "pre_reserved", label: "Pre-reserva" },
  { value: "confirmed", label: "Confirmada" },
  { value: "executed", label: "Realizada" },
  { value: "cancelled", label: "Cancelada" }
];

type PaymentSummary = {
  totalCount: number;
  pendingCount: number;
  overdueCount: number;
  pendingAmount: number;
};

type EventSection = "resumen" | "coordinacion" | "cobros" | "actividad";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function activityActionLabel(value: string) {
  const labels: Record<string, string> = {
    created: "Creación",
    updated: "Actualización",
    status_changed: "Cambio de estado",
    payment_registered: "Pago registrado",
    quote_saved: "Cotización guardada",
    responsible_assigned: "Responsable asignado"
  };

  return labels[value] ?? value.replace(/_/g, " ");
}

export function EventDetail({ id }: { id: string }) {
  const [event, setEvent] = useState<Event | null>(null);
  const [requestSummary, setRequestSummary] = useState<EventRequestSummary | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [message, setMessage] = useState("");
  const [activeSection, setActiveSection] = useState<EventSection>("resumen");
  const [quoteCount, setQuoteCount] = useState(0);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [coordinationSummary, setCoordinationSummary] = useState<CoordinationSummary>({
    openTasks: 0,
    blockedTasks: 0,
    checklistDone: 0,
    checklistTotal: 0
  });
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary>({
    totalCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    pendingAmount: 0
  });
  const [showCoordinationDetails, setShowCoordinationDetails] = useState({
    responsibles: false,
    tasks: false,
    checklists: false,
    requirements: false
  });
  const [showCobrosDetails, setShowCobrosDetails] = useState({
    payments: true,
    quote: false
  });
  const [form, setForm] = useState({
    event_name: "",
    status: "pre_reserved",
    guest_count: "0",
    total_amount: "0",
    deposit_amount: "0",
    contracted_services: "",
    menu_details: "",
    technical_requirements: "",
    logistics_requirements: "",
    internal_notes: "",
    client_notes: ""
  });

  async function loadEvent() {
    try {
      const snapshot = await loadEventDetailSnapshot(id);
      const nextEvent = snapshot.event;

      setEvent(nextEvent);
      setForm({
        event_name: nextEvent.event_name,
        status: nextEvent.status,
        guest_count: String(nextEvent.guest_count),
        total_amount: String(nextEvent.total_amount ?? 0),
        deposit_amount: String(nextEvent.deposit_amount ?? 0),
        contracted_services: nextEvent.contracted_services ?? "",
        menu_details: nextEvent.menu_details ?? "",
        technical_requirements: nextEvent.technical_requirements ?? "",
        logistics_requirements: nextEvent.logistics_requirements ?? "",
        internal_notes: nextEvent.internal_notes ?? "",
        client_notes: nextEvent.client_notes ?? ""
      });
      setRequestSummary(snapshot.requestSummary);
      setQuoteCount(snapshot.quoteCount);
      setActivityLogs(snapshot.activityLogs);
      setProfileNames(snapshot.profileNames);
      setCoordinationSummary(snapshot.coordinationSummary);
      setPaymentSummary(snapshot.paymentSummary);
      setMessage(snapshot.warningMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el evento.");
      return;
    }
  }

  const visibleBalance = getVisibleBalance(paymentSummary, event?.balance_amount);

  const closureLabel = useMemo(() => (event ? getClosureLabel(event, visibleBalance, coordinationSummary.openTasks) : "Cargando..."), [
    coordinationSummary.openTasks,
    event,
    visibleBalance
  ]);

  useEffect(() => {
    loadEvent();
  }, [id]);

  async function updateEvent(updateEvent: React.FormEvent<HTMLFormElement>) {
    updateEvent.preventDefault();
    setMessage("Guardando cambios...");

    const { error } = await supabase
      .from("events")
      .update({
        event_name: form.event_name.trim(),
        status: form.status,
        guest_count: Number(form.guest_count),
        total_amount: Number(form.total_amount || 0),
        deposit_amount: Number(form.deposit_amount || 0),
        contracted_services: form.contracted_services.trim() || null,
        menu_details: form.menu_details.trim() || null,
        technical_requirements: form.technical_requirements.trim() || null,
        logistics_requirements: form.logistics_requirements.trim() || null,
        internal_notes: form.internal_notes.trim() || null,
        client_notes: form.client_notes.trim() || null
      })
      .eq("id", id);

    if (error) {
      setMessage(`No se pudo actualizar el evento: ${error.message}`);
      return;
    }

    if (event?.request_id) {
      const linkedStatus = form.status === "confirmed" ? "confirmed" : form.status === "cancelled" ? "cancelled" : form.status;
      const { error: requestStatusError } = await supabase.from("event_requests").update({ status: linkedStatus }).eq("id", event.request_id);

      if (requestStatusError) {
        setMessage(`Evento actualizado, pero no se pudo sincronizar la solicitud: ${requestStatusError.message}`);
        await loadEvent();
        return;
      }
    }

    setMessage("Evento actualizado correctamente.");
    await loadEvent();
  }

  const nextAction = useMemo(
    () =>
      event
        ? getEventNextAction({
            event,
            visibleBalance,
            coordinationSummary,
            paymentSummary
          })
        : "Cargando próxima acción...",
    [coordinationSummary, event, paymentSummary, visibleBalance]
  );

  const sections = [
    { id: "resumen", label: "Resumen" },
    { id: "coordinacion", label: "Coordinación" },
    { id: "cobros", label: "Cobros" },
    { id: "actividad", label: "Actividad" }
  ] as const;

  if (!event) {
    return <p className="muted">{message || "Cargando ficha del evento..."}</p>;
  }

  return (
    <>
      <PageHeader
        eyebrow="Ficha del evento"
        title={event.event_name}
        description="La ficha principal del caso confirmado: aquí mandan la operación, los cobros y la salida ordenada del flujo activo."
      />

      <div className="button-row" style={{ marginBottom: 14 }}>
        <Link className="secondary-button" href="/reservations">
          Volver a Reservas
        </Link>
        {event.request_id ? (
          <Link className="secondary-button" href={`/requests/${event.request_id}`}>
            Ver origen comercial
          </Link>
        ) : null}
      </div>

      <section className="event-executive-grid">
        <article className="panel event-executive-card">
          <div className="list-item-header">
            <div>
              <p className="eyebrow">Evento</p>
              <h2>{event.event_name}</h2>
              <p className="muted">{event.clients?.company_name || event.clients?.full_name || "Cliente sin nombre"}</p>
            </div>
            <StatusBadge status={event.status} />
          </div>

          <div className="meta-grid" style={{ marginTop: 14 }}>
            <div className="meta-block">
              <span>Fecha</span>
              {formatDate(event.event_date)}
            </div>
            <div className="meta-block">
              <span>Horario</span>
              {event.start_time.slice(0, 5)} - {event.end_time.slice(0, 5)}
            </div>
            <div className="meta-block">
              <span>Total</span>
              {formatCurrency(event.total_amount)}
            </div>
            <div className="meta-block">
              <span>Saldo</span>
              {formatCurrency(visibleBalance)}
            </div>
          </div>

          <div className="event-pill-row">
            <span className="event-info-pill">Responsable principal: {profileNames[event.main_responsible_id ?? ""] ?? "Sin asignar"}</span>
            <span className="event-info-pill">Invitados: {event.guest_count}</span>
            <span className="event-info-pill">Tipo: {event.event_type}</span>
          </div>

          <div className="button-row" style={{ marginTop: 14 }}>
            <button className="secondary-button" type="button" onClick={() => setActiveSection("resumen")}>
              Editar resumen
            </button>
            <button className="secondary-button" type="button" onClick={() => setActiveSection("cobros")}>
              Abrir cobros
            </button>
            <button className="secondary-button" type="button" onClick={() => setActiveSection("actividad")}>
              Ver actividad
            </button>
          </div>
        </article>

        <article className="panel next-action-card">
          <p className="eyebrow">Próxima acción</p>
          <h2>Qué conviene resolver ahora</h2>
          <p>{nextAction}</p>
          <div className="event-pill-row">
            {paymentSummary.overdueCount > 0 ? <span className="event-info-pill warning">{paymentSummary.overdueCount} cobro(s) vencido(s)</span> : null}
            {coordinationSummary.blockedTasks > 0 ? <span className="event-info-pill alert">{coordinationSummary.blockedTasks} tarea(s) bloqueada(s)</span> : null}
            {coordinationSummary.checklistTotal > 0 ? (
              <span className="event-info-pill">
                Checklist {coordinationSummary.checklistDone}/{coordinationSummary.checklistTotal}
              </span>
            ) : null}
          </div>
        </article>
      </section>

      <section className="panel event-context-panel">
        <div className="list-item-header">
          <div>
            <h2>Contexto comercial</h2>
            <p className="muted">El origen comercial sigue visible como contexto, pero el caso ya se gobierna desde esta ficha.</p>
          </div>
        </div>

        <div className="grid-4" style={{ marginTop: 14 }}>
          <article className="stat-card">
            <span>Solicitud origen</span>
            <strong style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>{requestSummary?.event_type ?? "Sin solicitud asociada"}</strong>
          </article>
          <article className="stat-card">
            <span>Cotización vigente</span>
            <strong style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>
              {quoteCount > 0 ? `${quoteCount} línea(s) que respaldan el total pactado` : "Sin cotización"}
            </strong>
          </article>
          <article className="stat-card">
            <span>Confirmación</span>
            <strong style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>
              {["confirmed", "executed", "cancelled"].includes(event.status) ? formatDate(event.updated_at.slice(0, 10)) : "Aún no confirmada"}
            </strong>
          </article>
          <article className="stat-card">
            <span>Cierre del caso</span>
            <strong style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>{closureLabel}</strong>
          </article>
          <article className="stat-card">
            <span>Ejecutivo responsable</span>
            <strong style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>
              {profileNames[event.commercial_responsible_id ?? ""] ?? "Sin asignar"}
            </strong>
          </article>
        </div>
      </section>

      <nav className="section-tabs" aria-label="Secciones del evento">
        {sections.map((section) => (
          <button
            className={activeSection === section.id ? "primary-button" : "secondary-button"}
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {activeSection === "resumen" && (
        <section className="event-section-stack">
          <section className="content-grid" style={{ marginTop: 14 }}>
            <article className="detail-section">
              <div className="list-item-header">
                <div>
                  <h2>Comprensión rápida</h2>
                  <p className="muted">Lo esencial para entender el evento sin entrar todavía a detalle operativo o financiero.</p>
                </div>
                <StatusBadge status={event.status} />
              </div>

              <div className="meta-grid" style={{ marginTop: 14 }}>
                <div className="meta-block">
                  <span>Cliente</span>
                  {event.clients?.full_name ?? "Sin cliente"}
                </div>
                <div className="meta-block">
                  <span>Empresa</span>
                  {event.clients?.company_name ?? "Sin empresa"}
                </div>
                <div className="meta-block">
                  <span>Abono</span>
                  {formatCurrency(event.deposit_amount)}
                </div>
                <div className="meta-block">
                  <span>Solicitud</span>
                  {requestSummary?.status ? statusLabel(requestSummary.status) : "Sin origen"}
                </div>
              </div>

              <div className="detail-copy">
                <h3>Servicios contratados</h3>
                <p>{event.contracted_services || "Sin servicios registrados todavía."}</p>
                <h3>Notas para cliente</h3>
                <p>{event.client_notes || "Sin notas visibles para cliente."}</p>
                <h3>Notas internas destacadas</h3>
                <p>{event.internal_notes || "Sin notas internas destacadas."}</p>
              </div>
            </article>

            <article className="panel">
              <h2>Editar resumen</h2>
              <form className="edit-form" onSubmit={updateEvent}>
                <div className="form-grid-2">
                  <label>
                    Nombre del evento
                    <input
                      required
                      value={form.event_name}
                      onChange={(eventValue) => setForm((current) => ({ ...current, event_name: eventValue.target.value }))}
                    />
                  </label>
                  <label>
                    Estado
                    <select value={form.status} onChange={(eventValue) => setForm((current) => ({ ...current, status: eventValue.target.value }))}>
                      {editableStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="form-grid-2">
                  <label>
                    Invitados
                    <input
                      min={1}
                      required
                      type="number"
                      value={form.guest_count}
                      onChange={(eventValue) => setForm((current) => ({ ...current, guest_count: eventValue.target.value }))}
                    />
                  </label>
                  <label>
                    Notas para cliente
                    <textarea
                      rows={3}
                      value={form.client_notes}
                      onChange={(eventValue) => setForm((current) => ({ ...current, client_notes: eventValue.target.value }))}
                    />
                  </label>
                </div>

                <button className="primary-button" type="submit">
                  Guardar resumen
                </button>
                {message && <p className="form-message">{message}</p>}
              </form>
            </article>
          </section>
        </section>
      )}

      {activeSection === "coordinacion" && (
        <section className="event-section-stack">
          <section className="grid-3" style={{ marginTop: 14 }}>
            <article className="stat-card">
              <span>Responsable principal</span>
              <strong style={{ fontSize: "1.15rem", lineHeight: 1.2 }}>{profileNames[event.main_responsible_id ?? ""] ?? "Sin asignar"}</strong>
            </article>
            <article className={`stat-card${coordinationSummary.openTasks > 0 ? " is-warning" : ""}`}>
              <span>Pendientes operativos</span>
              <strong>{coordinationSummary.openTasks}</strong>
            </article>
            <article className={`stat-card${coordinationSummary.blockedTasks > 0 ? " is-alert" : ""}`}>
              <span>Avance checklist</span>
              <strong>
                {coordinationSummary.checklistDone}/{coordinationSummary.checklistTotal}
              </strong>
            </article>
          </section>

          <section className="panel">
            <div className="list-item-header">
              <div>
                <h2>Coordinación del evento</h2>
                <p className="muted">Esta pestaña abre resumida. Solo se expande el bloque que necesitas trabajar.</p>
              </div>
              <div className="event-pill-row">
                {coordinationSummary.blockedTasks > 0 ? <span className="event-info-pill alert">Bloqueadas: {coordinationSummary.blockedTasks}</span> : null}
                {coordinationSummary.openTasks > 0 ? <span className="event-info-pill warning">Pendientes: {coordinationSummary.openTasks}</span> : null}
              </div>
            </div>

            <div className="button-row" style={{ marginTop: 14 }}>
              <button
                className={showCoordinationDetails.responsibles ? "primary-button" : "secondary-button"}
                type="button"
                onClick={() => setShowCoordinationDetails((current) => ({ ...current, responsibles: !current.responsibles }))}
              >
                {showCoordinationDetails.responsibles ? "Ocultar responsables" : "Ver responsables"}
              </button>
              <button
                className={showCoordinationDetails.tasks ? "primary-button" : "secondary-button"}
                type="button"
                onClick={() => setShowCoordinationDetails((current) => ({ ...current, tasks: !current.tasks }))}
              >
                {showCoordinationDetails.tasks ? "Ocultar tareas" : "Ver tareas"}
              </button>
              <button
                className={showCoordinationDetails.checklists ? "primary-button" : "secondary-button"}
                type="button"
                onClick={() => setShowCoordinationDetails((current) => ({ ...current, checklists: !current.checklists }))}
              >
                {showCoordinationDetails.checklists ? "Ocultar checklist" : "Ver checklist"}
              </button>
              <button
                className={showCoordinationDetails.requirements ? "primary-button" : "secondary-button"}
                type="button"
                onClick={() => setShowCoordinationDetails((current) => ({ ...current, requirements: !current.requirements }))}
              >
                {showCoordinationDetails.requirements ? "Ocultar requerimientos" : "Ver requerimientos"}
              </button>
            </div>
          </section>

          {showCoordinationDetails.responsibles ? (
            <EventResponsibles
              commercialResponsibleId={event.commercial_responsible_id}
              eventId={event.id}
              mainResponsibleId={event.main_responsible_id}
              onUpdated={loadEvent}
              operationsResponsibleId={event.operations_responsible_id}
            />
          ) : null}

          {showCoordinationDetails.tasks ? <EventTasks eventId={event.id} /> : null}

          {showCoordinationDetails.checklists ? <EventChecklists eventId={event.id} /> : null}

          {showCoordinationDetails.requirements ? (
            <section className="panel">
              <h2>Requerimientos y definiciones</h2>
              <form className="edit-form" onSubmit={updateEvent}>
                <label>
                  Servicios contratados
                  <input
                    value={form.contracted_services}
                    onChange={(eventValue) => setForm((current) => ({ ...current, contracted_services: eventValue.target.value }))}
                    placeholder="Catering, DJ, decoración..."
                  />
                </label>
                <label>
                  Menú
                  <textarea
                    rows={3}
                    value={form.menu_details}
                    onChange={(eventValue) => setForm((current) => ({ ...current, menu_details: eventValue.target.value }))}
                  />
                </label>
                <label>
                  Requerimientos técnicos
                  <textarea
                    rows={3}
                    value={form.technical_requirements}
                    onChange={(eventValue) => setForm((current) => ({ ...current, technical_requirements: eventValue.target.value }))}
                  />
                </label>
                <label>
                  Logística
                  <textarea
                    rows={3}
                    value={form.logistics_requirements}
                    onChange={(eventValue) => setForm((current) => ({ ...current, logistics_requirements: eventValue.target.value }))}
                  />
                </label>
                <label>
                  Notas internas
                  <textarea
                    rows={3}
                    value={form.internal_notes}
                    onChange={(eventValue) => setForm((current) => ({ ...current, internal_notes: eventValue.target.value }))}
                  />
                </label>
                <button className="primary-button" type="submit">
                  Guardar coordinación
                </button>
                {message && <p className="form-message">{message}</p>}
              </form>
            </section>
          ) : null}
        </section>
      )}

      {activeSection === "cobros" && (
        <section className="event-section-stack">
          <section className="grid-4" style={{ marginTop: 14 }}>
            <article className={`stat-card${visibleBalance > 0 ? " is-warning" : ""}`}>
              <span>Saldo actual</span>
              <strong>{formatCurrency(visibleBalance)}</strong>
            </article>
            <article className={`stat-card${paymentSummary.overdueCount > 0 ? " is-alert" : ""}`}>
              <span>Cuotas vencidas</span>
              <strong>{paymentSummary.overdueCount}</strong>
            </article>
            <article className={`stat-card${paymentSummary.pendingCount > 0 ? " is-warning" : ""}`}>
              <span>Cuotas pendientes</span>
              <strong>{paymentSummary.pendingCount}</strong>
            </article>
            <article className="stat-card">
              <span>Saldo según cobros</span>
              <strong>{formatCurrency(paymentSummary.pendingAmount)}</strong>
            </article>
          </section>

          <section className="panel">
            <div className="list-item-header">
              <div>
                <h2>Cobros del evento</h2>
                <p className="muted">La prioridad aquí es saldo, riesgo de cobro, cuotas y facturación. El estado financiero se lee desde los cobros registrados.</p>
              </div>
              <div className="button-row">
                <button
                  className={showCobrosDetails.payments ? "primary-button" : "secondary-button"}
                  type="button"
                  onClick={() => setShowCobrosDetails((current) => ({ ...current, payments: !current.payments }))}
                >
                  {showCobrosDetails.payments ? "Ocultar pagos" : "Ver pagos y facturación"}
                </button>
                <button
                  className={showCobrosDetails.quote ? "primary-button" : "secondary-button"}
                  type="button"
                  onClick={() => setShowCobrosDetails((current) => ({ ...current, quote: !current.quote }))}
                >
                  {showCobrosDetails.quote ? "Ocultar cotización" : "Ver cotización vigente"}
                </button>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>Resumen financiero</h2>
            <form className="edit-form" onSubmit={updateEvent}>
              <div className="form-grid-2">
                <label>
                  Total pactado
                  <input
                    inputMode="numeric"
                    min={0}
                    required
                    step={1}
                    type="number"
                    value={form.total_amount}
                    onChange={(eventValue) => setForm((current) => ({ ...current, total_amount: eventValue.target.value }))}
                  />
                </label>
                <label>
                  Abono
                  <input
                    inputMode="numeric"
                    min={0}
                    step={1}
                    type="number"
                    value={form.deposit_amount}
                    onChange={(eventValue) => setForm((current) => ({ ...current, deposit_amount: eventValue.target.value }))}
                  />
                </label>
              </div>

              <button className="primary-button" type="submit">
                Guardar montos
              </button>
              {message && <p className="form-message">{message}</p>}
            </form>
          </section>

          {showCobrosDetails.payments ? <EventPayments eventId={event.id} /> : null}

          {showCobrosDetails.quote ? (
            <section>
              <RequestQuoteItems
                client={{
                  fullName: event.clients?.full_name ?? "Cliente",
                  phone: event.clients?.phone ?? null,
                  email: event.clients?.email ?? null,
                  companyName: event.clients?.company_name ?? null
                }}
                context={{
                  eventName: event.event_name,
                  eventDate: event.event_date,
                  guestCount: event.guest_count,
                  startTime: event.start_time,
                  endTime: event.end_time,
                  quoteReference: event.id
                }}
                eventId={event.id}
                quoteTitle={`Cotización ${event.event_name}`}
                onTotalChange={(total) => {
                  setForm((current) => ({ ...current, total_amount: String(total) }));
                }}
              />
              <div className="panel" style={{ marginTop: 10 }}>
                <p className="muted">
                  Si cambias servicios o valores, revisa el total pactado y luego guarda montos para dejar el evento actualizado.
                </p>
              </div>
            </section>
          ) : null}
        </section>
      )}

      {activeSection === "actividad" && (
        <section className="event-section-stack">
          <section className="panel" style={{ marginTop: 14 }}>
            <div className="list-item-header">
              <div>
                <h2>Actividad del evento</h2>
                <p className="muted">Aquí se separan claramente la bitácora del equipo, la trazabilidad del sistema y los documentos.</p>
              </div>
            </div>
          </section>

          <EventComments eventId={event.id} />

          <section className="panel">
            <div className="list-item-header">
              <div>
                <h2>Cambios del sistema</h2>
                <p className="muted">Movimientos automáticos y trazabilidad técnica del evento.</p>
              </div>
              <strong>{activityLogs.length} registro(s)</strong>
            </div>

            <div className="list" style={{ marginTop: 14 }}>
              {activityLogs.length === 0 && <p className="muted">Todavía no hay registros automáticos para este evento.</p>}
              {activityLogs.map((log) => (
                <article className="list-item" key={log.id}>
                  <div className="list-item-header">
                    <strong>{activityActionLabel(log.action)}</strong>
                    <span className="muted">{formatDateTime(log.created_at)}</span>
                  </div>
                  <p className="muted">{log.description || "Sin descripción adicional."}</p>
                </article>
              ))}
            </div>
          </section>

          <EventDocuments eventId={event.id} />
        </section>
      )}
    </>
  );
}
