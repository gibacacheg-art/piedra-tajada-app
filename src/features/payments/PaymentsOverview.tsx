"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { paymentTypeLabel } from "@/features/events/eventPaymentsSupport";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Payment } from "@/types/database";

type PaymentWithEvent = Payment & {
  events?: {
    id: string;
    event_name: string;
    event_date: string;
    status: string;
    total_amount: number;
    balance_amount: number;
    clients?: {
      full_name: string;
      company_name: string | null;
    } | null;
  } | null;
};

function paymentStatusLabel(value: string, isOverdue: boolean) {
  if (value === "paid") return "Pagado";
  if (value === "cancelled") return "Cancelado";
  if (isOverdue) return "Vencido";
  return "Pendiente";
}

export function PaymentsOverview() {
  const [payments, setPayments] = useState<PaymentWithEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  async function loadPayments() {
    const { data, error } = await supabase
      .from("payments")
      .select("*, events(id, event_name, event_date, status, total_amount, balance_amount, clients(full_name, company_name))")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`No se pudieron cargar los pagos: ${error.message}`);
      return;
    }

    setPayments((data ?? []) as PaymentWithEvent[]);
    setMessage("");
  }

  useEffect(() => {
    loadPayments();
  }, []);

  const summary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return payments.reduce(
      (acc, payment) => {
        const amount = Number(payment.amount || 0);
        const dueDate = payment.due_date ? new Date(`${payment.due_date}T00:00:00`) : null;
        const isOverdue = payment.status !== "paid" && payment.status !== "cancelled" && dueDate ? dueDate < today : false;
        const isUpcoming =
          payment.status !== "paid" &&
          payment.status !== "cancelled" &&
          dueDate
            ? dueDate >= today && dueDate.getTime() <= today.getTime() + 1000 * 60 * 60 * 24 * 7
            : false;

        if (payment.status === "paid") acc.paid += amount;
        if (payment.status !== "paid" && payment.status !== "cancelled") acc.pending += amount;
        if (isOverdue) acc.overdue += amount;
        if (isUpcoming) acc.upcoming += amount;

        return acc;
      },
      { paid: 0, pending: 0, overdue: 0, upcoming: 0 }
    );
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return payments.filter((payment) => {
      const dueDate = payment.due_date ? new Date(`${payment.due_date}T00:00:00`) : null;
      const isOverdue = payment.status !== "paid" && payment.status !== "cancelled" && dueDate ? dueDate < today : false;

      switch (statusFilter) {
        case "paid":
          return payment.status === "paid";
        case "pending":
          return payment.status !== "paid" && payment.status !== "cancelled" && !isOverdue;
        case "overdue":
          return isOverdue;
        case "cancelled":
          return payment.status === "cancelled";
        default:
          return true;
      }
    });
  }, [payments, statusFilter]);

  const groupedByEvent = useMemo(() => {
    const groups = new Map<
      string,
      {
        eventId: string;
        eventName: string;
        eventDate: string;
        clientName: string;
        eventStatus: string;
        totalAmount: number;
        balanceAmount: number;
        payments: PaymentWithEvent[];
      }
    >();

    filteredPayments.forEach((payment) => {
      const eventId = payment.events?.id ?? "sin-evento";
      const existing = groups.get(eventId);

      if (existing) {
        existing.payments.push(payment);
        return;
      }

      groups.set(eventId, {
        eventId,
        eventName: payment.events?.event_name ?? "Sin evento asociado",
        eventDate: payment.events?.event_date ?? "",
        clientName: payment.events?.clients?.company_name || payment.events?.clients?.full_name || "Cliente sin nombre",
        eventStatus: payment.events?.status ?? "unknown",
        totalAmount: Number(payment.events?.total_amount || 0),
        balanceAmount: Number(payment.events?.balance_amount || 0),
        payments: [payment]
      });
    });

    return Array.from(groups.values());
  }, [filteredPayments]);

  function getPaymentAlert(payment: PaymentWithEvent) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = payment.due_date ? new Date(`${payment.due_date}T00:00:00`) : null;

    if (payment.status !== "paid" && payment.status !== "cancelled" && dueDate) {
      if (dueDate < today) {
        return { tone: "alert", text: "Vencido" };
      }

      if (dueDate.getTime() <= today.getTime() + 1000 * 60 * 60 * 24 * 7) {
        return { tone: "warning", text: "Vence pronto" };
      }
    }

    if (payment.status === "paid") {
      return { tone: "info", text: "Pagado" };
    }

    return null;
  }

  return (
    <>
      <PageHeader
        eyebrow="Finanzas"
        title="Cobros y facturación"
        description="Controla abonos, cuotas, vencimientos y facturas sin tener que abrir cada evento por separado."
      />

      <section className="grid-4">
        <article className="stat-card">
          <span>Total pagado</span>
          <strong>{formatCurrency(summary.paid)}</strong>
        </article>
        <article className="stat-card">
          <span>Total pendiente</span>
          <strong>{formatCurrency(summary.pending)}</strong>
        </article>
        <article className="stat-card">
          <span>Vencido</span>
          <strong>{formatCurrency(summary.overdue)}</strong>
        </article>
        <article className="stat-card">
          <span>Próximos 7 días</span>
          <strong>{formatCurrency(summary.upcoming)}</strong>
        </article>
      </section>

      <section className="panel" style={{ marginTop: 14 }}>
        <div className="toolbar">
          <div>
            <h2>Resumen por evento</h2>
            <p className="muted">Filtra el estado de las cuotas y revisa rápidamente dónde hay seguimiento financiero.</p>
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="overdue">Vencidos</option>
            <option value="paid">Pagados</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>

        <div className="list" style={{ marginTop: 14 }}>
          {groupedByEvent.length === 0 && <p className="muted">No hay pagos en este filtro.</p>}
          {groupedByEvent.map((group) => {
            const paid = group.payments
              .filter((payment) => payment.status === "paid")
              .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
            const pending = group.payments
              .filter((payment) => payment.status !== "paid" && payment.status !== "cancelled")
              .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

            return (
              <article className={`list-item${pending > 0 ? " is-warning" : ""}`} key={group.eventId}>
                <div className="list-item-header">
                  <div>
                    <h3>{group.eventName}</h3>
                    <p className="muted">
                      {group.clientName} {group.eventDate ? `· ${formatDate(group.eventDate)}` : ""}
                    </p>
                  </div>
                  {group.eventId !== "sin-evento" ? (
                    <div className="button-row">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setExpandedGroups((current) => ({ ...current, [group.eventId]: !current[group.eventId] }))}
                      >
                        {expandedGroups[group.eventId] ? "Ocultar cuotas" : `Ver cuotas (${group.payments.length})`}
                      </button>
                      <Link className="secondary-button" href={`/events/${group.eventId}`}>
                        Abrir evento
                      </Link>
                    </div>
                  ) : null}
                </div>

                <div className="meta-grid">
                  <div className="meta-block">
                    <span>Total pactado</span>
                    {formatCurrency(group.totalAmount)}
                  </div>
                  <div className="meta-block">
                    <span>Pagado</span>
                    {formatCurrency(paid)}
                  </div>
                  <div className="meta-block">
                    <span>Pendiente</span>
                    {formatCurrency(pending)}
                  </div>
                  <div className="meta-block">
                    <span>Saldo evento</span>
                    {formatCurrency(group.balanceAmount)}
                  </div>
                </div>

                {expandedGroups[group.eventId] && (
                  <div className="dashboard-list">
                    {group.payments.map((payment) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dueDate = payment.due_date ? new Date(`${payment.due_date}T00:00:00`) : null;
                    const isOverdue =
                      payment.status !== "paid" && payment.status !== "cancelled" && dueDate ? dueDate < today : false;
                    const alert = getPaymentAlert(payment);

                      return (
                        <div
                          className={`dashboard-mini-item${alert?.tone === "alert" ? " is-alert" : alert?.tone === "warning" ? " is-warning" : ""}`}
                          key={payment.id}
                        >
                          <div className="list-item-header">
                            <div>
                              <strong>
                                {paymentTypeLabel(payment.payment_type)} · {formatCurrency(payment.amount)}
                              </strong>
                              <p className="muted">
                                {paymentStatusLabel(payment.status, isOverdue)}
                                {payment.due_date ? ` · vence ${formatDate(payment.due_date)}` : " · sin vencimiento"}
                                {payment.paid_at ? ` · pagado ${formatDate(payment.paid_at.slice(0, 10))}` : ""}
                              </p>
                            </div>
                            {alert ? <span className={`alert-pill ${alert.tone}`}>{alert.text}</span> : null}
                          </div>
                          {payment.reference ? <p className="muted">Referencia: {payment.reference}</p> : null}
                          {payment.notes ? <p className="muted">{payment.notes}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {message && <p className="form-message">{message}</p>}
      </section>
    </>
  );
}
