"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { EventRequest, Profile } from "@/types/database";
import { convertRequestToEvent } from "./requestConversion";
import { RequestQuoteItems } from "./RequestQuoteItems";

export function RequestDetail({ id, initialSection = "resumen" }: { id: string; initialSection?: string }) {
  const router = useRouter();
  const { hasRole } = useAuth();
  const [request, setRequest] = useState<EventRequest | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeSection, setActiveSection] = useState(initialSection);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null);
  const [linkedEventStatus, setLinkedEventStatus] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    event_name: "",
    event_status: "pre_reserved",
    total_amount: "",
    deposit_amount: "",
    installment_count: "1",
    first_due_date: ""
  });
  const [commercialForm, setCommercialForm] = useState({
    status: "request_received",
    created_by: "",
    lead_source: "",
    notes: ""
  });

  async function loadRequest() {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    setCurrentUserId(userId);

    const [requestResponse, profilesResponse, linkedEventResponse] = await Promise.all([
      supabase
        .from("event_requests")
        .select("*, clients(full_name, phone, email, company_name), venues_spaces(name)")
        .eq("id", id)
        .single(),
      supabase.from("profiles").select("*").eq("is_active", true).order("full_name"),
      supabase.from("events").select("id, status").eq("request_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle()
    ]);

    const { data, error } = requestResponse;

    if (error) {
      setMessage(`No se pudo cargar la solicitud: ${error.message}`);
      setLoading(false);
      return;
    }

    if (profilesResponse.data) {
      setProfiles(profilesResponse.data as Profile[]);
    }

    setLinkedEventId(linkedEventResponse.data?.id ?? null);
    setLinkedEventStatus(linkedEventResponse.data?.status ?? null);

    const nextRequest = data as EventRequest;
    setRequest(nextRequest);
    setForm((current) => ({
      event_name: current.event_name || `${nextRequest.event_type} - ${nextRequest.clients?.full_name ?? "Cliente"}`,
      event_status:
        current.event_status ||
        (linkedEventResponse.data?.status ?? (nextRequest.status === "confirmed" ? "confirmed" : "pre_reserved")),
      total_amount: current.total_amount || String(nextRequest.estimated_budget ?? ""),
      deposit_amount: current.deposit_amount,
      installment_count: current.installment_count,
      first_due_date: current.first_due_date || nextRequest.tentative_date
    }));
    setCommercialForm({
      status: nextRequest.status,
      created_by: nextRequest.created_by ?? userId ?? "",
      lead_source: nextRequest.lead_source ?? "",
      notes: nextRequest.notes ?? ""
    });
    setLoading(false);
  }

  useEffect(() => {
    loadRequest();
  }, [id]);

  const canSubmitEvent = useMemo(() => {
    return Boolean(request) && !["executed", "cancelled", "lost"].includes(request?.status ?? "");
  }, [request]);

  const targetEventStatus = form.event_status;
  const isReadOnlyViewer = hasRole("consulta_disponibilidad");

  const commercialSummary = useMemo(() => {
    if (!request) return null;

    const now = Date.now();
    const eventDate = new Date(`${request.tentative_date}T00:00:00`).getTime();
    const createdAt = new Date(request.created_at).getTime();
    const daysOpen = Math.max(Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)), 0);

    let nextAction = "Mantener seguimiento comercial del caso.";
    if (request.status === "request_received") nextAction = "Preparar cotización y dejar claro el total esperado del caso.";
    if (request.status === "quoted") nextAction = "Resolver observaciones del cliente o avanzar a confirmación.";
    if (request.status === "pre_reserved") nextAction = "La reserva está apartada. Falta confirmarla para que el evento pase a operación.";
    if (request.status === "confirmed" && !linkedEventId) nextAction = "La reserva ya está confirmada. Falta abrir su evento principal.";
    if (request.status === "confirmed" && linkedEventId) nextAction = "El caso ya pasó a operación. Desde ahora manda la ficha del evento.";
    if (eventDate - now <= 1000 * 60 * 60 * 24 * 7 && ["request_received", "quoted", "pre_reserved"].includes(request.status)) {
      nextAction = "La fecha está cerca. Conviene contactar al cliente hoy.";
    }
    if (request.status === "lost") nextAction = "Solicitud cerrada como perdida.";

    return {
      daysOpen,
      nextAction,
      isNearDate: eventDate >= now && eventDate - now <= 1000 * 60 * 60 * 24 * 7
    };
  }, [linkedEventId, request]);

  function profileName(profileId: string | null | undefined) {
    return profiles.find((profile) => profile.id === profileId)?.full_name ?? "Sin asignar";
  }

  async function saveCommercialData(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request) return;

    setMessage("Guardando seguimiento comercial...");

    const { error } = await supabase
      .from("event_requests")
      .update({
        status: commercialForm.status,
        created_by: commercialForm.created_by || null,
        lead_source: commercialForm.lead_source || null,
        notes: commercialForm.notes || null
      })
      .eq("id", request.id);

    if (error) {
      setMessage(`No se pudo guardar seguimiento comercial: ${error.message}`);
      return;
    }

    setMessage("Seguimiento comercial actualizado.");
    await loadRequest();
  }

  async function assignToMe() {
    if (!request || !currentUserId) return;

    setCommercialForm((current) => ({ ...current, created_by: currentUserId }));

    const { error } = await supabase.from("event_requests").update({ created_by: currentUserId }).eq("id", request.id);

    if (error) {
      setMessage(`No se pudo asignar el seguimiento: ${error.message}`);
      return;
    }

    setMessage("La solicitud quedó asignada a tu usuario.");
    await loadRequest();
  }

  async function markAsLost() {
    if (!request) return;
    const reason = window.prompt("Motivo de pérdida de la oportunidad:");
    if (!reason) return;

    const nextNotes = [commercialForm.notes, `Motivo de pérdida: ${reason}`].filter(Boolean).join("\n");

    const { error } = await supabase
      .from("event_requests")
      .update({
        status: "lost",
        notes: nextNotes
      })
      .eq("id", request.id);

    if (error) {
      setMessage(`No se pudo marcar como perdida: ${error.message}`);
      return;
    }

    setCommercialForm((current) => ({ ...current, status: "lost", notes: nextNotes }));
    setMessage("La solicitud fue marcada como perdida.");
    await loadRequest();
  }

  async function markAsQuoted() {
    if (!request) return;
    const { error } = await supabase.from("event_requests").update({ status: "quoted" }).eq("id", request.id);

    if (error) {
      setMessage(`No se pudo marcar como cotizada: ${error.message}`);
      return;
    }

    setCommercialForm((current) => ({ ...current, status: "quoted" }));
    setMessage("La solicitud quedó marcada como cotizada.");
    await loadRequest();
  }

  async function convertToEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!request) return;

    const { data: userData } = await supabase.auth.getUser();
    const createdBy = userData.user?.id ?? null;
    setMessage(linkedEventId ? "Actualizando evento..." : "Creando evento...");

    const result = await convertRequestToEvent({
      request,
      form,
      linkedEventId,
      createdBy
    });

    if (!result.success) {
      if (result.eventId) {
        setCreatedEventId(result.eventId);
      }
      setMessage(result.message);
      return;
    }

    setCreatedEventId(result.eventId);
    setLinkedEventId(result.eventId);
    setLinkedEventStatus(result.eventStatus);
    setMessage(result.message);

    if (result.shouldRedirect) {
      router.push(`/events/${result.eventId}`);
      return;
    }

    await loadRequest();
  }

  if (loading) {
    return <p className="muted">Cargando solicitud...</p>;
  }

  if (!request) {
    return (
      <section className="panel">
        <p className="muted">{message || "No se encontró la solicitud."}</p>
      </section>
    );
  }

  const sections = [
    { id: "resumen", label: "Resumen" },
    { id: "cotizacion", label: "Cotización" },
    { id: "seguimiento", label: "Seguimiento" },
    { id: "conversion", label: "Confirmar reserva" }
  ].filter((section) => !isReadOnlyViewer || ["resumen", "cotizacion", "seguimiento"].includes(section.id));
  const currentSection = sections.some((section) => section.id === activeSection) ? activeSection : "resumen";
  const caseOwnerLabel = linkedEventId && request.status === "confirmed" ? "Ahora manda el evento" : "Todavía manda la reserva";

  return (
    <>
      <PageHeader
        eyebrow="Reserva"
        title={request.event_type}
        description="Aquí vive el caso antes de confirmarse. Cuando confirmas la reserva, la ficha principal pasa al evento."
      />

      <div className="button-row" style={{ marginBottom: 14 }}>
        <Link className="secondary-button" href="/reservations">
          Volver a Reservas
        </Link>
        {linkedEventId ? (
          <Link className="secondary-button" href={`/events/${linkedEventId}`}>
            Ir al evento principal
          </Link>
        ) : null}
      </div>

      <section className="grid-4" style={{ marginBottom: 14 }}>
        <article className={`stat-card${commercialSummary?.isNearDate ? " is-warning" : ""}`}>
          <span>Fecha tentativa</span>
          <strong style={{ fontSize: "1.35rem", lineHeight: 1.2 }}>{formatDate(request.tentative_date)}</strong>
        </article>
        <article className={`stat-card${request.status === "request_received" ? " is-warning" : ""}`}>
          <span>Presupuesto estimado</span>
          <strong style={{ fontSize: "1.35rem", lineHeight: 1.2 }}>{formatCurrency(request.estimated_budget)}</strong>
        </article>
        <article className={`stat-card${request.status === "request_received" ? " is-warning" : ""}`}>
          <span>Responsable comercial</span>
          <strong style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>{profileName(commercialForm.created_by)}</strong>
        </article>
        <article className={`stat-card${request.status === "lost" ? " is-alert" : commercialSummary?.isNearDate ? " is-warning" : ""}`}>
          <span>Próxima acción</span>
          <strong style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>{commercialSummary?.nextAction ?? "Sin acción sugerida"}</strong>
        </article>
      </section>

      <section className="content-grid">
        <div className="detail-section">
          <div className="list-item-header">
            <div>
              <h2>{request.clients?.full_name ?? "Cliente sin nombre"}</h2>
              <p className="muted">
                {[request.clients?.company_name, request.clients?.phone, request.clients?.email].filter(Boolean).join(" · ")}
              </p>
            </div>
            <StatusBadge status={request.status} />
          </div>

          <div className="meta-grid">
            <div className="meta-block">
              <span>Fecha tentativa</span>
              {formatDate(request.tentative_date)}
            </div>
            <div className="meta-block">
              <span>Horario</span>
              {request.start_time.slice(0, 5)} - {request.end_time.slice(0, 5)}
            </div>
            <div className="meta-block">
              <span>Invitados</span>
              {request.guest_count}
            </div>
            <div className="meta-block">
              <span>Bloqueo calendario</span>
              {request.venues_spaces?.name ?? "Sin bloqueo"}
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Lectura rápida</h2>
          <p className="muted">La reserva concentra lo comercial. Cuando confirmas, el evento pasa a ser la fuente principal para coordinación y cobros.</p>
          <div className="detail-copy">
            <h3>Quién manda ahora</h3>
            <p>{caseOwnerLabel}</p>
            <h3>Origen</h3>
            <p>{request.lead_source || "Sin origen registrado."}</p>
            <h3>Servicios solicitados y requerimientos</h3>
            <p>{request.special_requirements || "Sin requerimientos registrados."}</p>
            <h3>Notas internas</h3>
            <p>{request.notes || "Sin notas internas."}</p>
          </div>
        </div>
      </section>

      <nav className="section-tabs" aria-label="Secciones de la solicitud">
        {sections.map((section) => (
          <button
            className={currentSection === section.id ? "primary-button" : "secondary-button"}
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {currentSection === "resumen" && (
        <section className="content-grid" style={{ marginTop: 14 }}>
          <div className="detail-section">
            <h2>Datos del cliente y del evento</h2>
            <div className="meta-grid">
              <div className="meta-block">
                <span>Cliente</span>
                {request.clients?.full_name ?? "Sin nombre"}
              </div>
              <div className="meta-block">
                <span>Empresa</span>
                {request.clients?.company_name ?? "Sin empresa"}
              </div>
              <div className="meta-block">
                <span>Teléfono</span>
                {request.clients?.phone ?? "Sin teléfono"}
              </div>
              <div className="meta-block">
                <span>Email</span>
                {request.clients?.email ?? "Sin email"}
              </div>
            </div>
            <div className="detail-copy">
              <h3>Servicios solicitados y requerimientos</h3>
              <p>{request.special_requirements || "Sin requerimientos registrados."}</p>
              <h3>Notas internas</h3>
              <p>{request.notes || "Sin notas internas."}</p>
            </div>
          </div>

          <div className="panel" style={{ display: "grid", gap: 14 }}>
            <h2>Resumen comercial</h2>
            <div className="grid-3">
              <article className={`stat-card${commercialSummary?.isNearDate ? " is-warning" : ""}`}>
                <span>Días abierta</span>
                <strong>{commercialSummary?.daysOpen ?? 0}</strong>
              </article>
              <article className={`stat-card${linkedEventId ? "" : " is-warning"}`}>
                <span>Tramo del caso</span>
                <strong style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>{caseOwnerLabel}</strong>
              </article>
              <article className={`stat-card${request.status === "request_received" ? " is-warning" : ""}`}>
                <span>Responsable comercial</span>
                <strong style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>{profileName(commercialForm.created_by)}</strong>
              </article>
              <article className={`stat-card${request.status === "lost" ? " is-alert" : commercialSummary?.isNearDate ? " is-warning" : ""}`}>
                <span>Próxima acción</span>
                <strong style={{ fontSize: "1.1rem", lineHeight: 1.2 }}>{commercialSummary?.nextAction ?? "Sin acción sugerida"}</strong>
              </article>
            </div>
            {message && <p className="form-message">{message}</p>}
          </div>
        </section>
      )}

      {currentSection === "cotizacion" && (
        <div style={{ marginTop: 14 }}>
          <RequestQuoteItems
            client={{
              fullName: request.clients?.full_name ?? "Cliente",
              phone: request.clients?.phone ?? null,
              email: request.clients?.email ?? null,
              companyName: request.clients?.company_name ?? null
            }}
            context={{
              eventName: request.event_type,
              eventDate: request.tentative_date,
              guestCount: request.guest_count,
              startTime: request.start_time,
              endTime: request.end_time,
              quoteReference: request.id
            }}
            quoteTitle={`Cotización ${request.event_type}`}
            requestId={request.id}
            readOnly={isReadOnlyViewer}
            onTotalChange={(total) => {
              setForm((current) => (current.total_amount ? current : { ...current, total_amount: String(total) }));
            }}
          />
        </div>
      )}

      {currentSection === "seguimiento" && (
        <section className="panel" style={{ marginTop: 14 }}>
          {isReadOnlyViewer ? (
            <div className="detail-copy">
              <h2>Seguimiento comercial</h2>
              <p className="muted">Esta ficha está en modo solo lectura para consulta rápida del caso.</p>
              <h3>Estado comercial</h3>
              <p>{commercialForm.status === "request_received" ? "Nueva solicitud" : commercialForm.status === "quoted" ? "Cotización enviada" : "Perdida"}</p>
              <h3>Responsable comercial</h3>
              <p>{profileName(commercialForm.created_by)}</p>
              <h3>Origen comercial</h3>
              <p>{commercialForm.lead_source || "Sin origen registrado."}</p>
              <h3>Notas de seguimiento</h3>
              <p>{commercialForm.notes || "Sin notas de seguimiento."}</p>
            </div>
          ) : (
            <form className="edit-form" onSubmit={saveCommercialData}>
              <div className="list-item-header">
                <div>
                  <h2>Gestión comercial</h2>
                  <p className="muted">Define responsable, estado comercial y observaciones de seguimiento.</p>
                </div>
                <div className="button-row">
                  {currentUserId && (
                    <button className="secondary-button" type="button" onClick={assignToMe}>
                      Asignarme seguimiento
                    </button>
                  )}
                  {request.status === "request_received" && (
                    <button className="secondary-button" type="button" onClick={markAsQuoted}>
                      Marcar cotización enviada
                    </button>
                  )}
                  {request.status !== "lost" && (
                    <button className="secondary-button" type="button" onClick={markAsLost}>
                      Marcar perdida
                    </button>
                  )}
                </div>
              </div>

              <label>
                Estado comercial
                <select value={commercialForm.status} onChange={(event) => setCommercialForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="request_received">Nueva solicitud</option>
                  <option value="quoted">Cotización enviada</option>
                  <option value="lost">Perdida</option>
                </select>
              </label>
              <label>
                Responsable comercial
                <select value={commercialForm.created_by} onChange={(event) => setCommercialForm((current) => ({ ...current, created_by: event.target.value }))}>
                  <option value="">Sin asignar</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Origen comercial
                <input value={commercialForm.lead_source} onChange={(event) => setCommercialForm((current) => ({ ...current, lead_source: event.target.value }))} />
              </label>
              <label>
                Notas de seguimiento
                <textarea rows={6} value={commercialForm.notes} onChange={(event) => setCommercialForm((current) => ({ ...current, notes: event.target.value }))} />
              </label>
              <button className="primary-button" type="submit">
                Guardar seguimiento comercial
              </button>
              {message && <p className="form-message">{message}</p>}
            </form>
          )}
        </section>
      )}

      {currentSection === "conversion" && !isReadOnlyViewer && (
        <section className="panel" style={{ marginTop: 14 }}>
          <form className="edit-form" onSubmit={convertToEvent}>
            <h2>Confirmar reserva</h2>
            <p className="muted">
              Esta es la transición clave del caso. Antes de confirmar manda la reserva; después de confirmar, manda la ficha del evento.
            </p>
            <div className={`detail-section${form.event_status === "confirmed" ? "" : " is-warning"}`}>
              <h3>Qué cambia al confirmar</h3>
              <p className="muted">
                La cotización sigue proponiendo valores, pero desde este punto el total pactado, los cobros y la coordinación quedan gobernados por el evento.
              </p>
            </div>
            <label>
              Cómo quieres dejar el caso
              <select value={form.event_status} onChange={(event) => setForm((current) => ({ ...current, event_status: event.target.value }))}>
                <option value="pre_reserved">Pre-reserva</option>
                <option value="confirmed">Confirmada</option>
              </select>
            </label>
            <div className={`detail-section${form.event_status === "confirmed" ? "" : " is-warning"}`}>
              <h3>{form.event_status === "confirmed" ? "Qué pasará al confirmar" : "Qué pasará al dejarla en pre-reserva"}</h3>
              <p className="muted">
                {form.event_status === "confirmed"
                  ? "El caso saldrá del tramo comercial y quedará listo para operar desde la ficha del evento."
                  : "La fecha quedará apartada, pero la reserva seguirá viva en el tramo comercial hasta su confirmación final."}
              </p>
            </div>
            {linkedEventId ? (
              <p className="muted">
                Este caso ya tiene un evento asociado. Desde aquí solo ajustas la transición; la operación principal se sigue desde la ficha del evento.
              </p>
            ) : null}
            <label>
              Nombre del evento
              <input
                required
                value={form.event_name}
                onChange={(event) => setForm((current) => ({ ...current, event_name: event.target.value }))}
              />
            </label>
            <label>
              Total pactado
              <input
                inputMode="numeric"
                min={0}
                required
                step={1}
                type="number"
                value={form.total_amount}
                onChange={(event) => setForm((current) => ({ ...current, total_amount: event.target.value }))}
              />
            </label>
            <p className="muted" style={{ marginTop: -6 }}>
              La cotización propone el valor. Aquí dejas registrado el total que pasará a mandar cuando la reserva quede confirmada.
            </p>
            <label>
              Abono
              <input
                inputMode="numeric"
                min={0}
                step={1}
                type="number"
                value={form.deposit_amount}
                onChange={(event) => setForm((current) => ({ ...current, deposit_amount: event.target.value }))}
              />
            </label>
            <div className="form-grid-2">
              <label>
                Pago en cuántas cuotas
                <input
                  min={1}
                  required
                  step={1}
                  type="number"
                  value={form.installment_count}
                  onChange={(event) => setForm((current) => ({ ...current, installment_count: event.target.value }))}
                />
              </label>
              <label>
                Primera fecha de vencimiento
                <input
                  required
                  type="date"
                  value={form.first_due_date}
                  onChange={(event) => setForm((current) => ({ ...current, first_due_date: event.target.value }))}
                />
              </label>
            </div>
            <button className="primary-button" disabled={!canSubmitEvent} type="submit">
              {linkedEventId
                ? form.event_status === "confirmed"
                  ? "Confirmar reserva y abrir evento"
                  : "Actualizar pre-reserva"
                : form.event_status === "confirmed"
                  ? "Confirmar reserva"
                  : "Guardar como pre-reserva"}
            </button>
            {(createdEventId || linkedEventId) && (
              <Link className="secondary-button" href={`/events/${createdEventId ?? linkedEventId}`}>
                Abrir caso en operación
              </Link>
            )}
            {message && <p className="form-message">{message}</p>}
          </form>
        </section>
      )}
    </>
  );
}
