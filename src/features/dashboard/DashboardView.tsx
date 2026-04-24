"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Event, EventRequest, Payment, Task } from "@/types/database";

type TaskWithEvent = Task & {
  profiles?: {
    full_name: string;
  } | null;
  events?: {
    id: string;
    event_name: string;
    event_date: string;
  } | null;
};

type PaymentWithEvent = Payment & {
  events?: {
    id: string;
    event_name: string;
    event_date: string;
  } | null;
};

export function DashboardView() {
  const { user, roles } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [payments, setPayments] = useState<PaymentWithEvent[]>([]);
  const [tasks, setTasks] = useState<TaskWithEvent[]>([]);
  const [teamTasks, setTeamTasks] = useState<TaskWithEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const userId = user?.id;
      const isCoordinator = roles.includes("coordinador_evento");
      const weekLimit = new Date();
      weekLimit.setDate(weekLimit.getDate() + 7);
      const weekLimitIso = weekLimit.toISOString();

      const [eventsResponse, requestsResponse, paymentsResponse, tasksResponse, teamTasksResponse] = await Promise.all([
        supabase
          .from("events")
          .select("*, clients(full_name, phone, email, company_name)")
          .order("event_date", { ascending: true })
          .limit(8),
        supabase
          .from("event_requests")
          .select("*, clients(full_name, phone, email, company_name), venues_spaces(name)")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("payments")
          .select("*, events(id, event_name, event_date)")
          .in("status", ["pending", "overdue", "paid"])
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(20),
        userId
          ? supabase
              .from("tasks")
              .select("*, profiles!tasks_assigned_to_fkey(full_name), events(id, event_name, event_date)")
              .eq("assigned_to", userId)
              .in("status", ["pending", "in_progress", "blocked"])
              .order("due_date", { ascending: true, nullsFirst: false })
              .limit(6)
          : Promise.resolve({ data: [], error: null }),
        userId && isCoordinator
          ? supabase
              .from("tasks")
              .select("*, profiles!tasks_assigned_to_fkey(full_name), events(id, event_name, event_date)")
              .neq("assigned_to", userId)
              .not("assigned_to", "is", null)
              .not("due_date", "is", null)
              .lte("due_date", weekLimitIso)
              .in("status", ["pending", "in_progress", "blocked"])
              .order("due_date", { ascending: true, nullsFirst: false })
              .limit(8)
          : Promise.resolve({ data: [], error: null })
      ]);

      setEvents((eventsResponse.data ?? []) as Event[]);
      setRequests((requestsResponse.data ?? []) as EventRequest[]);
      setPayments((paymentsResponse.data ?? []) as PaymentWithEvent[]);
      setTasks((tasksResponse.data ?? []) as TaskWithEvent[]);
      setTeamTasks((teamTasksResponse.data ?? []) as TaskWithEvent[]);
      setLoading(false);
    }

    loadDashboard();
  }, [roles, user?.id]);

  const metrics = useMemo(() => {
    const confirmed = events.filter((event) => ["confirmed", "executed"].includes(event.status));
    const pipeline = requests.filter((request) => !["lost", "cancelled"].includes(request.status));
    const total = events.reduce((sum, event) => sum + Number(event.total_amount || 0), 0);
    const balances = events.reduce((sum, event) => sum + Number(event.balance_amount || 0), 0);
    const urgentTasks = tasks.filter((task) => task.priority === "urgent" && task.status !== "done");
    const overdueTasks = tasks.filter((task) => {
      if (!task.due_date || task.status === "done" || task.status === "cancelled") return false;
      return new Date(task.due_date).getTime() < Date.now();
    });

    return {
      confirmed: confirmed.length,
      pipeline: pipeline.length,
      total,
      balances,
      urgentTasks: urgentTasks.length,
      overdueTasks: overdueTasks.length,
      teamWeekTasks: teamTasks.length
    };
  }, [events, requests, tasks, teamTasks]);

  const requestsWithoutQuote = useMemo(
    () => requests.filter((request) => request.status === "request_received").slice(0, 4),
    [requests]
  );

  const requestsWithoutConfirmation = useMemo(
    () => requests.filter((request) => ["quoted", "pre_reserved"].includes(request.status)).slice(0, 4),
    [requests]
  );

  const invoicePendingItems = useMemo(
    () =>
      payments
        .filter((payment) => {
          const hasLegacyInvoice = /Factura N°:/i.test(payment.notes ?? "");
          return payment.status === "paid" && !payment.is_invoiced && !payment.invoice_number && !hasLegacyInvoice;
        })
        .slice(0, 4),
    [payments]
  );

  const overduePaymentItems = useMemo(
    () =>
      payments
        .filter((payment) => {
          if (payment.status === "overdue") return true;
          if (payment.status !== "pending" || !payment.due_date) return false;
          return new Date(`${payment.due_date}T00:00:00`).getTime() < Date.now();
        })
        .slice(0, 4),
    [payments]
  );

  const dueThisWeekPaymentItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekLimit = new Date(today);
    weekLimit.setDate(weekLimit.getDate() + 7);

    return payments
      .filter((payment) => {
        if (payment.status === "paid" || !payment.due_date) return false;
        const due = new Date(`${payment.due_date}T00:00:00`);
        return due.getTime() >= today.getTime() && due.getTime() <= weekLimit.getTime();
      })
      .slice(0, 4);
  }, [payments]);

  const priorityMetrics = useMemo(
    () => [
      { label: "Solicitudes pendientes", value: metrics.pipeline, tone: metrics.pipeline > 0 ? "warning" : "" },
      { label: "Pagos vencidos", value: overduePaymentItems.length, tone: overduePaymentItems.length > 0 ? "alert" : "" },
      { label: "Vencen esta semana", value: dueThisWeekPaymentItems.length, tone: dueThisWeekPaymentItems.length > 0 ? "warning" : "" },
      { label: "Tareas urgentes", value: metrics.urgentTasks + metrics.overdueTasks, tone: metrics.overdueTasks > 0 ? "alert" : metrics.urgentTasks > 0 ? "warning" : "" }
    ],
    [dueThisWeekPaymentItems.length, metrics.overdueTasks, metrics.pipeline, metrics.urgentTasks, overduePaymentItems.length]
  );

  function getTaskAlert(task: TaskWithEvent) {
    if (task.status === "blocked") return { tone: "alert", text: "Bloqueada" };
    if (task.priority === "urgent") return { tone: "alert", text: "Urgente" };
    if (task.due_date && task.status !== "done" && task.status !== "cancelled") {
      const due = new Date(task.due_date).getTime();
      const now = Date.now();
      if (due < now) return { tone: "alert", text: "Vencida" };
      if (due - now <= 1000 * 60 * 60 * 24) return { tone: "warning", text: "Vence pronto" };
    }
    return null;
  }

  return (
    <>
      <PageHeader
        eyebrow="Inicio"
        title="Resumen general"
        description="Prioridades del día, próximos eventos y seguimientos que conviene resolver antes de abrir el resto de la operación."
      />

      <section className="grid-4">
        {priorityMetrics.map((item) => (
          <article className={`stat-card${item.tone === "alert" ? " is-alert" : item.tone === "warning" ? " is-warning" : ""}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="content-grid" style={{ marginTop: 14 }}>
        <div className="panel">
          <h2>Próximos eventos</h2>
          <div className="list">
            {loading && <p className="muted">Cargando eventos...</p>}
            {!loading && events.length === 0 && <p className="muted">Aún no hay eventos visibles para tu rol.</p>}
            {events.map((event) => (
              <article className="list-item" key={event.id}>
                <div className="list-item-header">
                  <div>
                    <h3>{event.event_name}</h3>
                    <p className="muted">{event.clients?.full_name ?? "Cliente sin nombre"}</p>
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
                    <span>Invitados</span>
                    {event.guest_count}
                  </div>
                  <div className="meta-block">
                    <span>Total</span>
                    {formatCurrency(event.total_amount)}
                  </div>
                </div>
                <Link className="dashboard-link" href={`/events/${event.id}`}>
                  Abrir evento
                </Link>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="page-header" style={{ marginBottom: 0 }}>
            <div>
              <h2>Seguimiento pendiente</h2>
              <p className="muted">Solicitudes por mover, facturas pendientes y pagos que requieren seguimiento.</p>
            </div>
          </div>

          <div className="dashboard-list">
            <article className={`dashboard-mini-item${requestsWithoutQuote.length > 0 ? " is-warning" : ""}`}>
              <strong>Sin cotizar</strong>
              {requestsWithoutQuote.length === 0 ? (
                <p className="muted">No hay solicitudes pendientes de cotización.</p>
              ) : (
                <>
                  {requestsWithoutQuote.map((request) => (
                    <p className="muted" key={request.id}>
                      <Link className="dashboard-link" href={`/requests/${request.id}`}>
                        {request.clients?.full_name ?? request.event_type}
                      </Link>{" "}
                      · {formatDate(request.tentative_date)}
                    </p>
                  ))}
                </>
              )}
            </article>

            <article className={`dashboard-mini-item${requestsWithoutConfirmation.length > 0 ? " is-warning" : ""}`}>
              <strong>Sin confirmar</strong>
              {requestsWithoutConfirmation.length === 0 ? (
                <p className="muted">No hay solicitudes pendientes de confirmación.</p>
              ) : (
                <>
                  {requestsWithoutConfirmation.map((request) => (
                    <p className="muted" key={request.id}>
                      <Link className="dashboard-link" href={`/requests/${request.id}`}>
                        {request.clients?.full_name ?? request.event_type}
                      </Link>{" "}
                      · {request.status === "quoted" ? "Cotizada" : "Lista para pasar a evento"}
                    </p>
                  ))}
                </>
              )}
            </article>

            <article className={`dashboard-mini-item${invoicePendingItems.length > 0 ? " is-warning" : ""}`}>
              <strong>Facturas pendientes</strong>
              {invoicePendingItems.length === 0 ? (
                <p className="muted">No hay pagos pagados pendientes de factura.</p>
              ) : (
                <>
                  {invoicePendingItems.map((payment) => (
                    <p className="muted" key={payment.id}>
                      <Link className="dashboard-link" href={payment.events?.id ? `/events/${payment.events.id}` : "/payments"}>
                        {payment.events?.event_name ?? "Pago sin evento"}
                      </Link>{" "}
                      · {formatCurrency(payment.amount)}
                    </p>
                  ))}
                </>
              )}
            </article>

            <article className={`dashboard-mini-item${overduePaymentItems.length > 0 ? " is-alert" : ""}`}>
              <strong>Pagos vencidos</strong>
              {overduePaymentItems.length === 0 ? (
                <p className="muted">No hay pagos vencidos por ahora.</p>
              ) : (
                <>
                  {overduePaymentItems.map((payment) => (
                    <p className="muted" key={payment.id}>
                      <Link className="dashboard-link" href={payment.events?.id ? `/events/${payment.events.id}` : "/payments"}>
                        {payment.events?.event_name ?? "Pago sin evento"}
                      </Link>{" "}
                      · {payment.due_date ? formatDate(payment.due_date.slice(0, 10)) : "Sin fecha"} · {formatCurrency(payment.amount)}
                    </p>
                  ))}
                </>
              )}
            </article>

            <article className={`dashboard-mini-item${dueThisWeekPaymentItems.length > 0 ? " is-warning" : ""}`}>
              <strong>Vencen esta semana</strong>
              {dueThisWeekPaymentItems.length === 0 ? (
                <p className="muted">No hay pagos que venzan esta semana.</p>
              ) : (
                <>
                  {dueThisWeekPaymentItems.map((payment) => (
                    <p className="muted" key={payment.id}>
                      <Link className="dashboard-link" href={payment.events?.id ? `/events/${payment.events.id}` : "/payments"}>
                        {payment.events?.event_name ?? "Pago sin evento"}
                      </Link>{" "}
                      · {payment.due_date ? formatDate(payment.due_date.slice(0, 10)) : "Sin fecha"} · {formatCurrency(payment.amount)}
                    </p>
                  ))}
                </>
              )}
            </article>
          </div>
        </div>
      </section>

      <section className="content-grid" style={{ marginTop: 14 }}>
        <div className="panel">
          <div className="page-header" style={{ marginBottom: 0 }}>
            <div>
              <h2>Mis tareas activas</h2>
              <p className="muted">Pendientes, en progreso o bloqueadas asignadas a tu usuario.</p>
            </div>
            <Link className="secondary-button" href="/my-tasks">
              Ver todas
            </Link>
          </div>

          <div className="dashboard-list">
            {loading && <p className="muted">Cargando tareas...</p>}
            {!loading && tasks.length === 0 && <p className="muted">No tienes tareas activas en este momento.</p>}
            {tasks.map((task) => {
              const alert = getTaskAlert(task);

              return (
                <article
                  className={`dashboard-mini-item${alert?.tone === "alert" ? " is-alert" : alert?.tone === "warning" ? " is-warning" : ""}`}
                  key={task.id}
                >
                  <div className="list-item-header">
                    <div>
                      <strong>{task.title}</strong>
                      <p className="muted">
                        {task.events?.event_name ?? "Sin evento"} · prioridad {task.priority}
                      </p>
                    </div>
                    <div className="button-row">
                      {alert ? <span className={`alert-pill ${alert.tone}`}>{alert.text}</span> : null}
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                  <p className="muted">{task.description ?? "Sin descripción adicional."}</p>
                  <div className="button-row">
                    {task.events?.id ? (
                      <Link className="dashboard-link" href={`/events/${task.events.id}`}>
                        Abrir evento
                      </Link>
                    ) : null}
                    <Link className="dashboard-link" href="/my-tasks">
                      Ir a mis tareas
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="panel">
          {roles.includes("coordinador_evento") ? (
            <>
              <div className="page-header" style={{ marginBottom: 0 }}>
                <div>
                  <h2>Tareas del equipo esta semana</h2>
                  <p className="muted">Vencimientos próximos de otros responsables para que puedas hacer seguimiento.</p>
                </div>
                <strong>{metrics.teamWeekTasks}</strong>
              </div>
              <div className="dashboard-list">
                {loading && <p className="muted">Cargando tareas del equipo...</p>}
                {!loading && teamTasks.length === 0 && <p className="muted">No hay tareas de otros usuarios que venzan esta semana.</p>}
                {teamTasks.map((task) => {
                  const alert = getTaskAlert(task);

                  return (
                    <article
                      className={`dashboard-mini-item${alert?.tone === "alert" ? " is-alert" : alert?.tone === "warning" ? " is-warning" : ""}`}
                      key={task.id}
                    >
                      <div className="list-item-header">
                        <div>
                          <strong>{task.title}</strong>
                          <p className="muted">
                            {task.profiles?.full_name ?? "Sin responsable"} · {task.events?.event_name ?? "Sin evento"}
                          </p>
                        </div>
                        <div className="button-row">
                          {alert ? <span className={`alert-pill ${alert.tone}`}>{alert.text}</span> : null}
                          <StatusBadge status={task.status} />
                        </div>
                      </div>
                      <p className="muted">
                        {task.due_date ? `Vence ${formatDate(task.due_date.slice(0, 10))}` : "Sin fecha de vencimiento"}
                        {task.priority ? ` · prioridad ${task.priority}` : ""}
                      </p>
                      {task.events?.id ? (
                        <Link className="dashboard-link" href={`/events/${task.events.id}`}>
                          Abrir evento
                        </Link>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h2>Lo importante hoy</h2>
              <div className="dashboard-list">
                <article className={`dashboard-mini-item${metrics.pipeline > 0 ? " is-warning" : ""}`}>
                  <strong>Solicitudes pendientes</strong>
                  <p className="muted">{metrics.pipeline} solicitudes pendientes de seguimiento o cierre.</p>
                </article>
                <article className={`dashboard-mini-item${metrics.balances > 0 ? " is-warning" : ""}`}>
                  <strong>Cobros pendientes</strong>
                  <p className="muted">{formatCurrency(metrics.balances)} aún pendientes por cobrar.</p>
                </article>
                <article className={`dashboard-mini-item${metrics.overdueTasks > 0 ? " is-alert" : metrics.urgentTasks > 0 ? " is-warning" : ""}`}>
                  <strong>Tareas urgentes</strong>
                  <p className="muted">{metrics.urgentTasks} urgentes y {metrics.overdueTasks} vencidas.</p>
                </article>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
