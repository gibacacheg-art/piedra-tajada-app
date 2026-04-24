"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types/database";

type ClientRequest = {
  id: string;
  event_type: string;
  tentative_date: string;
  status: string;
  estimated_budget: number | null;
  created_at: string;
};

type ClientEvent = {
  id: string;
  event_name: string;
  event_type: string;
  event_date: string;
  status: string;
  total_amount: number;
  balance_amount: number;
};

type ClientPayment = {
  id: string;
  amount: number;
  status: string;
  payment_type: string;
  due_date: string | null;
  paid_at: string | null;
  events?: {
    id: string;
    event_name: string;
  } | null;
};

export function ClientDetail({ id }: { id: string }) {
  const { canAccess, hasRole } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [clientRequests, setClientRequests] = useState<ClientRequest[]>([]);
  const [clientEvents, setClientEvents] = useState<ClientEvent[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [message, setMessage] = useState("");
  const [activeSection, setActiveSection] = useState("resumen");
  const [showClientPayments, setShowClientPayments] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    company_name: "",
    notes: ""
  });
  const isReadOnlyViewer = hasRole("consulta_disponibilidad");

  async function loadClient() {
    const [clientResponse, requestsResponse, eventsResponse] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase
        .from("event_requests")
        .select("id, event_type, tentative_date, status, estimated_budget, created_at")
        .eq("client_id", id)
        .order("tentative_date", { ascending: false }),
      supabase
        .from("events")
        .select("id, event_name, event_type, event_date, status, total_amount, balance_amount")
        .eq("client_id", id)
        .order("event_date", { ascending: false })
    ]);

    if (clientResponse.error) {
      setMessage(`No se pudo cargar el cliente: ${clientResponse.error.message}`);
      return;
    }

    const nextEvents = (eventsResponse.data ?? []) as ClientEvent[];
    const eventIds = nextEvents.map((event) => event.id);

    let payments: ClientPayment[] = [];
    if (eventIds.length > 0) {
      const paymentsResponse = await supabase
        .from("payments")
        .select("id, amount, status, payment_type, due_date, paid_at, events(id, event_name)")
        .in("event_id", eventIds)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (!paymentsResponse.error) {
        payments = (paymentsResponse.data ?? []) as ClientPayment[];
      }
    }

    const nextClient = clientResponse.data as Client;
    setClient(nextClient);
    setClientRequests((requestsResponse.data ?? []) as ClientRequest[]);
    setClientEvents(nextEvents);
    setClientPayments(payments);
    setForm({
      full_name: nextClient.full_name,
      phone: nextClient.phone ?? "",
      email: nextClient.email ?? "",
      company_name: nextClient.company_name ?? "",
      notes: nextClient.notes ?? ""
    });
  }

  useEffect(() => {
    loadClient();
  }, [id]);

  const summary = useMemo(() => {
    const totalQuoted = clientRequests.reduce((sum, request) => sum + Number(request.estimated_budget || 0), 0);
    const totalEvents = clientEvents.reduce((sum, event) => sum + Number(event.total_amount || 0), 0);
    const pendingBalance = clientEvents.reduce((sum, event) => sum + Number(event.balance_amount || 0), 0);

    return {
      requestCount: clientRequests.length,
      eventCount: clientEvents.length,
      totalQuoted,
      totalEvents,
      pendingBalance
    };
  }, [clientRequests, clientEvents]);

  async function saveClientChanges(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;

    setMessage("Guardando cambios del cliente...");

    const { error } = await supabase
      .from("clients")
      .update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        company_name: form.company_name.trim() || null,
        notes: form.notes.trim() || null
      })
      .eq("id", client.id);

    if (error) {
      setMessage(`No se pudo actualizar el cliente: ${error.message}`);
      return;
    }

    setMessage("Cliente actualizado.");
    await loadClient();
  }

  function getRequestAlert(request: ClientRequest) {
    const now = Date.now();
    const tentativeDate = new Date(`${request.tentative_date}T00:00:00`).getTime();

    if (request.status === "request_received") return { tone: "warning", text: "Sin cotizar" };
    if (request.status === "lost") return { tone: "alert", text: "Perdida" };
    if (["quoted", "pre_reserved"].includes(request.status) && tentativeDate >= now && tentativeDate - now <= 1000 * 60 * 60 * 24 * 7) {
      return { tone: "warning", text: "Fecha cercana" };
    }

    return null;
  }

  if (!client) {
    return <p className="muted">{message || "Cargando ficha del cliente..."}</p>;
  }

  const sections = [
    { id: "resumen", label: "Resumen" },
    { id: "solicitudes", label: "Solicitudes" },
    { id: "eventos", label: "Eventos" },
    { id: "pagos", label: "Pagos" },
    { id: "editar", label: "Editar cliente" }
  ].filter((section) => !isReadOnlyViewer || section.id !== "editar");
  const currentSection = sections.some((section) => section.id === activeSection) ? activeSection : "resumen";

  return (
    <>
      <PageHeader
        eyebrow="Ficha del cliente"
        title={client.full_name}
        description="Vista individual del cliente con su historial comercial, eventos y situación financiera."
      />

      <section className="detail-grid">
        <article className="detail-section">
          <h2>Contacto</h2>
          <p>{[client.company_name, client.phone, client.email].filter(Boolean).join(" · ") || "Sin datos complementarios."}</p>
        </article>

        <article className={`detail-section${summary.pendingBalance > 0 ? " is-warning" : ""}`}>
          <h2>Saldo pendiente</h2>
          <p>{formatCurrency(summary.pendingBalance)}</p>
        </article>

        <article className="detail-section">
          <h2>Solicitudes</h2>
          <p>{summary.requestCount}</p>
        </article>

        <article className="detail-section">
          <h2>Eventos</h2>
          <p>{summary.eventCount}</p>
        </article>
      </section>

      <div className="button-row" style={{ marginBottom: 14 }}>
        <Link className="secondary-button" href="/clients">
          Volver a clientes
        </Link>
        {canAccess("/clients/new") ? (
          <Link className="secondary-button" href="/clients/new">
            Nuevo cliente
          </Link>
        ) : null}
      </div>

      <nav className="section-tabs" aria-label="Secciones del cliente">
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
        <section className="panel" style={{ marginTop: 14 }}>
          <div className="grid-3">
            <article className="stat-card">
              <span>Presupuestos solicitados</span>
              <strong>{formatCurrency(summary.totalQuoted)}</strong>
            </article>
            <article className="stat-card">
              <span>Total eventos</span>
              <strong>{formatCurrency(summary.totalEvents)}</strong>
            </article>
            <article className={`stat-card${summary.pendingBalance > 0 ? " is-warning" : ""}`}>
              <span>Saldo pendiente</span>
              <strong>{formatCurrency(summary.pendingBalance)}</strong>
            </article>
          </div>

          <div className="detail-copy">
            <h3>Notas del cliente</h3>
            <p>{client.notes || "Sin notas registradas."}</p>
          </div>
        </section>
      )}

      {currentSection === "solicitudes" && (
        <section className="panel" style={{ marginTop: 14 }}>
          <h2>Solicitudes del cliente</h2>
          <div className="list" style={{ marginTop: 14 }}>
            {clientRequests.length === 0 && <p className="muted">Este cliente todavía no tiene solicitudes registradas.</p>}
            {clientRequests.map((request) => {
              const alert = getRequestAlert(request);

              return (
                <Link
                  className={`list-item${alert?.tone === "alert" ? " is-alert" : alert?.tone === "warning" ? " is-warning" : ""}`}
                  href={`/requests/${request.id}`}
                  key={request.id}
                >
                  <div className="list-item-header">
                    <div>
                      <h3>{request.event_type}</h3>
                      <p className="muted">{formatDate(request.tentative_date)}</p>
                    </div>
                    <div className="button-row">
                      {alert ? <span className={`alert-pill ${alert.tone}`}>{alert.text}</span> : null}
                      <StatusBadge status={request.status} />
                    </div>
                  </div>
                  <div className="meta-grid">
                    <div className="meta-block">
                      <span>Presupuesto</span>
                      {formatCurrency(request.estimated_budget)}
                    </div>
                    <div className="meta-block">
                      <span>Creada</span>
                      {formatDate(request.created_at.slice(0, 10))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {currentSection === "eventos" && (
        <section className="panel" style={{ marginTop: 14 }}>
          <h2>Eventos del cliente</h2>
          <div className="list" style={{ marginTop: 14 }}>
            {clientEvents.length === 0 && <p className="muted">Este cliente todavía no tiene eventos creados.</p>}
            {clientEvents.map((event) => (
              <Link className={`list-item${Number(event.balance_amount || 0) > 0 ? " is-warning" : ""}`} href={`/events/${event.id}`} key={event.id}>
                <div className="list-item-header">
                  <div>
                    <h3>{event.event_name}</h3>
                    <p className="muted">
                      {formatDate(event.event_date)} · {event.event_type}
                    </p>
                  </div>
                  <StatusBadge status={event.status} />
                </div>
                <div className="meta-grid">
                  <div className="meta-block">
                    <span>Total</span>
                    {formatCurrency(event.total_amount)}
                  </div>
                  <div className="meta-block">
                    <span>Saldo</span>
                    {formatCurrency(event.balance_amount)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {currentSection === "pagos" && (
        <section className="panel" style={{ marginTop: 14 }}>
          <div className="list-item-header">
            <h2>Pagos relacionados</h2>
            <button className="secondary-button" type="button" onClick={() => setShowClientPayments((current) => !current)}>
              {showClientPayments ? "Ocultar cuotas" : `Ver cuotas (${clientPayments.length})`}
            </button>
          </div>
          {showClientPayments && (
            <div className="list" style={{ marginTop: 14 }}>
              {clientPayments.length === 0 && <p className="muted">Todavía no hay pagos asociados a los eventos de este cliente.</p>}
              {clientPayments.map((payment) => (
                <article className={`list-item${payment.status !== "paid" ? " is-warning" : ""}`} key={payment.id}>
                  <div className="list-item-header">
                    <div>
                      <h3>{formatCurrency(payment.amount)}</h3>
                      <p className="muted">
                        {payment.events?.event_name ?? "Evento"} · {payment.payment_type}
                      </p>
                    </div>
                    <StatusBadge status={payment.status} />
                  </div>
                  <div className="meta-grid">
                    <div className="meta-block">
                      <span>Vence</span>
                      {payment.due_date ? formatDate(payment.due_date) : "Sin vencimiento"}
                    </div>
                    <div className="meta-block">
                      <span>Pagado</span>
                      {payment.paid_at ? formatDate(payment.paid_at.slice(0, 10)) : "No"}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {currentSection === "editar" && !isReadOnlyViewer && (
        <section className="panel" style={{ marginTop: 14 }}>
          <h2>Editar cliente</h2>
          <form className="edit-form" onSubmit={saveClientChanges}>
            <label>
              Nombre completo
              <input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} />
            </label>
            <label>
              Teléfono
              <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <label>
              Correo
              <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <label>
              Empresa
              <input value={form.company_name} onChange={(event) => setForm((current) => ({ ...current, company_name: event.target.value }))} />
            </label>
            <label>
              Notas
              <textarea rows={5} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </label>
            <button className="primary-button" type="submit">
              Guardar cambios del cliente
            </button>
            {message && <p className="form-message">{message}</p>}
          </form>
        </section>
      )}
    </>
  );
}
