"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Event, EventRequest } from "@/types/database";
import { RequestForm } from "@/features/requests/RequestForm";

type ReservationRequest = EventRequest & {
  clients?: {
    full_name: string | null;
    company_name: string | null;
  } | null;
  venues_spaces?: {
    name: string;
  } | null;
};

type ReservationEvent = Event & {
  clients?: {
    full_name: string | null;
    company_name: string | null;
  } | null;
};

type ReservationTab = "course" | "events" | "archived";
type ReservationQuickView = "commercial" | "pre-reserved" | "confirmed" | "executed" | "cancelled" | "archived";

function requestNextStep(status: string) {
  if (status === "request_received") return "Preparar cotización";
  if (status === "quoted") return "Resolver cierre y confirmar";
  if (status === "pre_reserved") return "Confirmar reserva";
  if (status === "confirmed") return "Abrir evento principal";
  return "Revisar caso";
}

function eventClosureLabel(status: string, balance: number) {
  if (status === "cancelled") return "Cancelada";
  if (status === "executed" && balance > 0) return "Realizada con cierre pendiente";
  if (status === "executed" && balance <= 0) return "Cerrada";
  return "En coordinación";
}

export function ReservationsOverview() {
  const { canAccess, hasRole } = useAuth();
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<ReservationRequest[]>([]);
  const [events, setEvents] = useState<ReservationEvent[]>([]);
  const [eventBalances, setEventBalances] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<ReservationTab>(canAccess("/requests") ? "course" : "events");
  const [message, setMessage] = useState("");
  const [showNewReservationForm, setShowNewReservationForm] = useState(false);

  const canSeeRequests = canAccess("/requests");
  const isReadOnlyViewer = hasRole("consulta_disponibilidad");

  async function loadReservations() {
    const [requestsResponse, eventsResponse, paymentsResponse] = await Promise.all([
      canSeeRequests
        ? supabase
            .from("event_requests")
            .select("*, clients(full_name, company_name), venues_spaces(name)")
            .order("tentative_date", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("events")
        .select("*, clients(full_name, company_name)")
        .order("event_date", { ascending: true }),
      supabase.from("payments").select("event_id, amount, status")
    ]);

    if (requestsResponse.error || eventsResponse.error || paymentsResponse.error) {
      setMessage(
        `No se pudo cargar reservas: ${
          requestsResponse.error?.message || eventsResponse.error?.message || paymentsResponse.error?.message || "Error desconocido"
        }`
      );
      return;
    }

    setRequests((requestsResponse.data ?? []) as ReservationRequest[]);
    setEvents((eventsResponse.data ?? []) as ReservationEvent[]);
    const nextBalances = (paymentsResponse.data ?? []).reduce<Record<string, number>>((accumulator, payment) => {
      if (!payment.event_id) return accumulator;
      if (payment.status !== "pending" && payment.status !== "overdue") return accumulator;
      accumulator[payment.event_id] = (accumulator[payment.event_id] ?? 0) + Number(payment.amount || 0);
      return accumulator;
    }, {});
    setEventBalances(nextBalances);
    setMessage("");
  }

  useEffect(() => {
    loadReservations();
  }, [canSeeRequests]);

  useEffect(() => {
    if (searchParams.get("new") === "1" && canSeeRequests && !isReadOnlyViewer) {
      setShowNewReservationForm(true);
      setActiveTab("course");
    }
  }, [canSeeRequests, isReadOnlyViewer, searchParams]);

  const confirmedRequestIds = useMemo(
    () => events.filter((event) => ["confirmed", "executed", "cancelled"].includes(event.status) && event.request_id).map((event) => event.request_id as string),
    [events]
  );

  const activeRequests = useMemo(
    () =>
      requests.filter((request) => {
        if (request.trashed_at || request.is_archived) return false;
        if (request.status === "lost") return false;
        if (request.status === "confirmed" && confirmedRequestIds.includes(request.id)) return false;
        return ["request_received", "quoted", "pre_reserved", "confirmed"].includes(request.status);
      }),
    [confirmedRequestIds, requests]
  );

  const activeEvents = useMemo(
    () =>
      events.filter((event) => {
        if (event.trashed_at || event.is_archived) return false;
        return ["confirmed", "executed", "cancelled"].includes(event.status);
      }),
    [events]
  );

  const archivedItems = useMemo(
    () => ({
      requests: requests.filter((request) => request.is_archived && !request.trashed_at),
      events: events.filter((event) => event.is_archived && !event.trashed_at)
    }),
    [events, requests]
  );

  const filteredRequests = useMemo(
    () =>
      activeRequests.filter((request) =>
        [request.event_type, request.clients?.full_name, request.clients?.company_name, request.status]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (statusFilter === "all" ||
          (statusFilter === "commercial_open" ? ["request_received", "quoted"].includes(request.status) : request.status === statusFilter))
      ),
    [activeRequests, query, statusFilter]
  );

  const filteredEvents = useMemo(
    () =>
      activeEvents.filter((event) => {
        const closure = eventClosureLabel(
          event.status,
          Object.prototype.hasOwnProperty.call(eventBalances, event.id) ? eventBalances[event.id] : Number(event.balance_amount || 0)
        );
        const matchesQuery = [event.event_name, event.event_type, event.clients?.full_name, event.clients?.company_name, event.status, closure]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesStatus =
          statusFilter === "all" ||
          event.status === statusFilter ||
          closure.toLowerCase().includes(statusFilter.toLowerCase());
        return matchesQuery && matchesStatus;
      }),
    [activeEvents, eventBalances, query, statusFilter]
  );

  const filteredArchivedRequests = useMemo(
    () =>
      archivedItems.requests.filter((request) =>
        [request.event_type, request.clients?.full_name, request.clients?.company_name, request.status]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [archivedItems.requests, query]
  );

  const filteredArchivedEvents = useMemo(
    () =>
      archivedItems.events.filter((event) =>
        [event.event_name, event.event_type, event.clients?.full_name, event.clients?.company_name, event.status]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [archivedItems.events, query]
  );

  const metrics = useMemo(
    () => ({
      commercial: activeRequests.filter((request) => ["request_received", "quoted"].includes(request.status)).length,
      preReserved: activeRequests.filter((request) => request.status === "pre_reserved").length,
      confirmed: activeEvents.filter((event) => event.status === "confirmed").length,
      executed: activeEvents.filter((event) => event.status === "executed").length,
      cancelled: activeEvents.filter((event) => event.status === "cancelled").length,
      archived: archivedItems.requests.length + archivedItems.events.length
    }),
    [activeEvents, activeRequests, archivedItems.events.length, archivedItems.requests.length]
  );

  function applyQuickView(view: ReservationQuickView) {
    setQuery("");
    setShowNewReservationForm(false);

    if (view === "commercial") {
      setActiveTab("course");
      setStatusFilter("commercial_open");
      return;
    }

    if (view === "pre-reserved") {
      setActiveTab("course");
      setStatusFilter("pre_reserved");
      return;
    }

    if (view === "confirmed") {
      setActiveTab("events");
      setStatusFilter("confirmed");
      return;
    }

    if (view === "executed") {
      setActiveTab("events");
      setStatusFilter("executed");
      return;
    }

    if (view === "cancelled") {
      setActiveTab("events");
      setStatusFilter("cancelled");
      return;
    }

    setActiveTab("archived");
    setStatusFilter("all");
  }

  return (
    <>
      <PageHeader
        eyebrow="Gestión principal"
        title="Reservas"
        description="La entrada madre real del caso: aquí nace la reserva, aquí se sigue el tramo comercial y desde aquí se entiende cuándo pasa a operación."
      />

      <section className="grid-3" style={{ marginBottom: 14 }}>
        <button
          className={`stat-card${metrics.commercial > 0 ? " is-warning" : ""}`}
          type="button"
          onClick={() => applyQuickView("commercial")}
          style={{ textAlign: "left" }}
        >
          <span>Nuevas / cotizando</span>
          <strong>{metrics.commercial}</strong>
        </button>
        <button
          className={`stat-card${metrics.preReserved > 0 ? " is-warning" : ""}`}
          type="button"
          onClick={() => applyQuickView("pre-reserved")}
          style={{ textAlign: "left" }}
        >
          <span>Pre-reservas</span>
          <strong>{metrics.preReserved}</strong>
        </button>
        <button className="stat-card" type="button" onClick={() => applyQuickView("confirmed")} style={{ textAlign: "left" }}>
          <span>Confirmadas</span>
          <strong>{metrics.confirmed}</strong>
        </button>
        <button className="stat-card" type="button" onClick={() => applyQuickView("executed")} style={{ textAlign: "left" }}>
          <span>Realizadas</span>
          <strong>{metrics.executed}</strong>
        </button>
        <button className="stat-card" type="button" onClick={() => applyQuickView("cancelled")} style={{ textAlign: "left" }}>
          <span>Canceladas</span>
          <strong>{metrics.cancelled}</strong>
        </button>
        <button className="stat-card" type="button" onClick={() => applyQuickView("archived")} style={{ textAlign: "left" }}>
          <span>Archivados</span>
          <strong>{metrics.archived}</strong>
        </button>
      </section>

      <section className="panel">
        <div className="detail-copy" style={{ marginBottom: 14 }}>
          <h2>Cómo seguir el caso</h2>
          <p>
            Usa esta vista como puerta principal. El cliente entra aquí, la reserva se crea aquí y el caso solo pasa a operación cuando ya fue confirmado.
          </p>
        </div>
        {canSeeRequests && !isReadOnlyViewer ? (
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="list-item-header">
              <div>
                <h2>Nueva reserva</h2>
                <p className="muted">Empieza siempre aquí el caso nuevo, con cliente existente o creando uno nuevo en el mismo flujo.</p>
              </div>
              <button
                className={showNewReservationForm ? "secondary-button" : "primary-button"}
                type="button"
                onClick={() => setShowNewReservationForm((current) => !current)}
              >
                {showNewReservationForm ? "Ocultar formulario" : "Crear nueva reserva"}
              </button>
            </div>
            {showNewReservationForm ? (
              <div style={{ marginTop: 14 }}>
                <RequestForm
                  embedded
                  onCreated={async () => {
                    await loadReservations();
                    setShowNewReservationForm(false);
                    setActiveTab("course");
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="toolbar">
          <input placeholder="Buscar por cliente, empresa, tipo o nombre del evento" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="button-row">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="commercial_open">Nuevas / cotizando</option>
              <option value="request_received">Nueva solicitud</option>
              <option value="quoted">Cotizando / enviada</option>
              <option value="pre_reserved">Pre-reserva</option>
              <option value="confirmed">Confirmada</option>
              <option value="executed">Realizada</option>
              <option value="cancelled">Cancelada</option>
              <option value="cerrada">Cerrada</option>
            </select>
            <Link className="secondary-button" href="/calendar">
              Ver calendario
            </Link>
          </div>
        </div>

        <nav className="section-tabs" aria-label="Secciones de reservas" style={{ marginTop: 14 }}>
          {canSeeRequests ? (
            <button className={activeTab === "course" ? "primary-button" : "secondary-button"} type="button" onClick={() => setActiveTab("course")}>
              Reservas activas
            </button>
          ) : null}
          <button className={activeTab === "events" ? "primary-button" : "secondary-button"} type="button" onClick={() => setActiveTab("events")}>
            Operación
          </button>
          <button className={activeTab === "archived" ? "primary-button" : "secondary-button"} type="button" onClick={() => setActiveTab("archived")}>
            Archivados
          </button>
        </nav>

        {activeTab === "course" && canSeeRequests ? (
          <div className="list" style={{ marginTop: 14 }}>
            {filteredRequests.length === 0 && <p className="muted">No hay solicitudes activas con este filtro.</p>}
            {filteredRequests.map((request) => (
              <article className="list-item" key={request.id}>
                <div className="list-item-header">
                  <div>
                    <h3>{request.event_type}</h3>
                    <p className="muted">{request.clients?.company_name || request.clients?.full_name || "Cliente sin nombre"}</p>
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
                    <span>Espacio</span>
                    {request.venues_spaces?.name ?? "Sin bloqueo"}
                  </div>
                  <div className="meta-block">
                    <span>Estado visible</span>
                    {statusLabel(request.status)}
                  </div>
                  <div className="meta-block">
                    <span>Próximo paso</span>
                    {requestNextStep(request.status)}
                  </div>
                </div>
                <div className="button-row" style={{ marginTop: 12 }}>
                  <Link className="primary-button" href={`/requests/${request.id}`}>
                    Abrir caso
                  </Link>
                  {!isReadOnlyViewer && ["quoted", "pre_reserved", "confirmed"].includes(request.status) ? (
                    <Link className="secondary-button" href={`/requests/${request.id}?section=conversion`}>
                      Confirmar reserva
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {activeTab === "events" ? (
          <div className="list" style={{ marginTop: 14 }}>
            {filteredEvents.length === 0 && <p className="muted">No hay eventos visibles con este filtro.</p>}
            {filteredEvents.map((event) => (
              <article
                className={`list-item${
                  (Object.prototype.hasOwnProperty.call(eventBalances, event.id) ? eventBalances[event.id] : Number(event.balance_amount || 0)) > 0
                    ? " is-warning"
                    : ""
                }`}
                key={event.id}
              >
                <div className="list-item-header">
                  <div>
                    <h3>{event.event_name}</h3>
                    <p className="muted">{event.clients?.company_name || event.clients?.full_name || "Cliente sin nombre"}</p>
                  </div>
                  <StatusBadge status={event.status} />
                </div>
                <div className="meta-grid">
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
                    {formatCurrency(Object.prototype.hasOwnProperty.call(eventBalances, event.id) ? eventBalances[event.id] : event.balance_amount)}
                  </div>
                  <div className="meta-block">
                    <span>Cierre</span>
                    {eventClosureLabel(
                      event.status,
                      Object.prototype.hasOwnProperty.call(eventBalances, event.id) ? eventBalances[event.id] : Number(event.balance_amount || 0)
                    )}
                  </div>
                  <div className="meta-block">
                    <span>Próxima acción</span>
                    {event.status === "confirmed"
                      ? "Coordinar y cobrar"
                      : event.status === "executed"
                        ? (Object.prototype.hasOwnProperty.call(eventBalances, event.id) ? eventBalances[event.id] : Number(event.balance_amount || 0)) > 0
                          ? "Cerrar saldo pendiente"
                          : "Caso listo para cierre"
                        : "Revisar caso"}
                  </div>
                </div>
                <div className="button-row" style={{ marginTop: 12 }}>
                  <Link className="primary-button" href={`/events/${event.id}`}>
                    Abrir caso
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {activeTab === "archived" ? (
          <div className="list" style={{ marginTop: 14 }}>
            {filteredArchivedRequests.length === 0 && filteredArchivedEvents.length === 0 && (
              <p className="muted">No hay elementos archivados con este filtro.</p>
            )}

            {filteredArchivedRequests.map((request) => (
              <article className="list-item" key={`request-${request.id}`}>
                <div className="list-item-header">
                  <div>
                    <h3>{request.event_type}</h3>
                    <p className="muted">Reserva archivada · {request.clients?.company_name || request.clients?.full_name || "Cliente sin nombre"}</p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
                <div className="button-row" style={{ marginTop: 12 }}>
                  <Link className="secondary-button" href={`/requests/${request.id}`}>
                    Abrir caso archivado
                  </Link>
                </div>
              </article>
            ))}

            {filteredArchivedEvents.map((event) => (
              <article className="list-item" key={`event-${event.id}`}>
                <div className="list-item-header">
                  <div>
                    <h3>{event.event_name}</h3>
                    <p className="muted">Evento archivado · {event.clients?.company_name || event.clients?.full_name || "Cliente sin nombre"}</p>
                  </div>
                  <StatusBadge status={event.status} />
                </div>
                <div className="button-row" style={{ marginTop: 12 }}>
                  <Link className="secondary-button" href={`/events/${event.id}`}>
                    Abrir caso archivado
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {message ? <p className="form-message">{message}</p> : null}
      </section>
    </>
  );
}
