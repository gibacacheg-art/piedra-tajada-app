"use client";

import { useEffect, useMemo, useState } from "react";
import { openStoredDocument } from "@/features/documents/documentStorage";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Document, Event, Payment } from "@/types/database";
import {
  buildInstallmentRows,
  buildInvoiceNotes,
  calculatePaymentTotals,
  calculateRemainingBalance,
  extractInvoiceNumber,
  isPaymentInvoiced,
  loadEventPaymentsSnapshot,
  paymentTypeLabel,
  uploadPaymentInvoiceDocument
} from "./eventPaymentsSupport";

export function EventPayments({ eventId }: { eventId: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentDocuments, setPaymentDocuments] = useState<Record<string, Document[]>>({});
  const [eventSummary, setEventSummary] = useState<Pick<Event, "id" | "total_amount"> | null>(null);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [invoiceEditingId, setInvoiceEditingId] = useState<string | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiced: false,
    invoiceNumber: ""
  });
  const [editingForm, setEditingForm] = useState({
    amount: "",
    due_date: "",
    payment_type: "installment"
  });
  const [form, setForm] = useState({
    amount: "",
    payment_type: "installment",
    due_date: ""
  });
  const [planForm, setPlanForm] = useState({
    installment_count: "1",
    first_due_date: ""
  });
  const [showPayments, setShowPayments] = useState(false);

  const totals = useMemo(() => calculatePaymentTotals(payments), [payments]);

  const remainingBalance = useMemo(() => calculateRemainingBalance(eventSummary?.total_amount, totals.paid), [eventSummary?.total_amount, totals.paid]);

  async function loadPayments() {
    try {
      const snapshot = await loadEventPaymentsSnapshot(eventId);
      setPayments(snapshot.payments);
      setPaymentDocuments(snapshot.paymentDocuments);
      setEventSummary(snapshot.eventSummary as Pick<Event, "id" | "total_amount">);
      setPlanForm((current) => ({
        installment_count: current.installment_count,
        first_due_date: current.first_due_date || new Date().toISOString().slice(0, 10)
      }));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar pagos.");
    }
  }

  useEffect(() => {
    loadPayments();
  }, [eventId]);

  async function addPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Registrando cuota...");

    const { error } = await supabase.from("payments").insert({
      event_id: eventId,
      amount: Number(form.amount || 0),
      payment_type: form.payment_type,
      due_date: form.due_date || null,
      paid_at: null,
      status: "pending",
      reference: null,
      notes: null
    });

    if (error) {
      setMessage(`No se pudo registrar el pago: ${error.message}`);
      return;
    }

    setForm({ amount: "", payment_type: "installment", due_date: "" });
    setMessage("");
    await loadPayments();
  }

  function startEditing(payment: Payment) {
    setEditingId(payment.id);
    setEditingForm({
      amount: String(payment.amount),
      due_date: payment.due_date ?? "",
      payment_type: payment.payment_type
    });
  }

  async function saveEditedPayment(payment: Payment) {
    setMessage("Actualizando cuota...");

    const { error } = await supabase
      .from("payments")
      .update({
        amount: Number(editingForm.amount || 0),
        due_date: editingForm.due_date || null,
        payment_type: editingForm.payment_type,
        notes: [
          payment.notes,
          `Cuota ajustada el ${new Intl.DateTimeFormat("es-CL").format(new Date())}`
        ]
          .filter(Boolean)
          .join("\n")
      })
      .eq("id", payment.id);

    if (error) {
      setMessage(`No se pudo actualizar la cuota: ${error.message}`);
      return;
    }

    setEditingId(null);
    setEditingForm({ amount: "", due_date: "", payment_type: "installment" });
    setMessage("");
    await loadPayments();
  }

  async function markAsPaid(payment: Payment) {
    const { error } = await supabase
      .from("payments")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        reference: payment.reference || "Marcado como pagado desde la ficha del evento"
      })
      .eq("id", payment.id);

    if (error) {
      setMessage(`No se pudo marcar como pagado: ${error.message}`);
      return;
    }

    setMessage("");
    await loadPayments();
  }

  async function deletePayment(payment: Payment) {
    const shouldDelete = window.confirm(`¿Eliminar el pago/cuota de ${formatCurrency(payment.amount)}?`);
    if (!shouldDelete) return;

    const { error } = await supabase.from("payments").delete().eq("id", payment.id);

    if (error) {
      setMessage(`No se pudo eliminar la cuota: ${error.message}`);
      return;
    }

    setMessage("");
    await loadPayments();
  }

  function startInvoiceEditing(payment: Payment) {
    setInvoiceEditingId(payment.id);
    setInvoiceFile(null);
    setInvoiceForm({
      invoiced: isPaymentInvoiced(payment, paymentDocuments),
      invoiceNumber: extractInvoiceNumber(payment)
    });
  }

  async function openDocument(document: Document) {
    try {
      await openStoredDocument(document);
    } catch (error) {
      setMessage(`No se pudo abrir la factura: ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  }

  async function saveInvoiceInfo(payment: Payment) {
    setMessage("Guardando facturación...");

    const nextNotes = buildInvoiceNotes(payment, invoiceForm);

    const invoiceNumber = invoiceForm.invoiceNumber.trim() || null;
    const invoiceIssuedAt = invoiceForm.invoiced ? new Date().toISOString().slice(0, 10) : null;

    const { error: paymentError } = await supabase
      .from("payments")
      .update({
        notes: nextNotes || null,
        is_invoiced: invoiceForm.invoiced,
        invoice_number: invoiceNumber,
        invoice_issued_at: invoiceIssuedAt
      })
      .eq("id", payment.id);

    if (paymentError) {
      const needsFallback = /column .*does not exist|schema cache/i.test(paymentError.message);

      if (!needsFallback) {
        setMessage(`No se pudo guardar la facturación: ${paymentError.message}`);
        return;
      }

      const { error: fallbackError } = await supabase
        .from("payments")
        .update({
          notes: nextNotes || null
        })
        .eq("id", payment.id);

      if (fallbackError) {
        setMessage(`No se pudo guardar la facturación: ${fallbackError.message}`);
        return;
      }
    }

    if (invoiceFile) {
      const { data: userData } = await supabase.auth.getUser();
      try {
        await uploadPaymentInvoiceDocument({
          paymentId: payment.id,
          invoiceNumber: invoiceForm.invoiceNumber,
          invoiceFile,
          uploadedBy: userData.user?.id ?? null
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo subir la factura.");
        await loadPayments();
        return;
      }
    }

    setInvoiceEditingId(null);
    setInvoiceFile(null);
    setInvoiceForm({ invoiced: false, invoiceNumber: "" });
    setMessage(
      paymentError
        ? "Facturación actualizada. Para guardarla en campos estructurados, ejecuta la migración 003_payment_invoicing.sql."
        : "Facturación actualizada."
    );
    await loadPayments();
  }

  async function rebuildPendingPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const installmentCount = Math.max(Number(planForm.installment_count || 1), 1);
    const firstDueDate = planForm.first_due_date || new Date().toISOString().slice(0, 10);
    const pendingPayments = payments.filter((payment) => payment.status !== "paid");

    if (remainingBalance <= 0) {
      setMessage("No queda saldo pendiente para rearmar el plan de pagos.");
      return;
    }

    const shouldReplace = window.confirm(
      `¿Reemplazar el plan pendiente por ${installmentCount} cuota(s) desde ${formatDate(firstDueDate)}?\n\nLos pagos ya marcados como pagados se mantendrán.`
    );

    if (!shouldReplace) return;

    setMessage("Rearmando plan pendiente...");

    if (pendingPayments.length > 0) {
      const { error: deleteError } = await supabase.from("payments").delete().in(
        "id",
        pendingPayments.map((payment) => payment.id)
      );

      if (deleteError) {
        setMessage(`No se pudo limpiar el plan pendiente anterior: ${deleteError.message}`);
        return;
      }
    }

    const paymentRows = buildInstallmentRows({
      eventId,
      amount: remainingBalance,
      installmentCount,
      firstDueDate,
      notes: "Plan de pagos actualizado desde la ficha del evento"
    });

    const { error: insertError } = await supabase.from("payments").insert(paymentRows);

    if (insertError) {
      setMessage(`No se pudo crear el nuevo plan de pagos: ${insertError.message}`);
      return;
    }

    setMessage("Plan de pagos pendiente actualizado.");
    await loadPayments();
  }

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <div className="list-item-header">
        <div>
          <h2>Plan de pagos</h2>
          <p className="muted">Ahora puedes editar una cuota puntual o rehacer el plan pendiente completo sin tocar lo ya pagado.</p>
        </div>
        <div>
          <strong>{formatCurrency(totals.paid)} pagado</strong>
          <p className="muted">{formatCurrency(totals.pending)} pendiente</p>
        </div>
      </div>

      <section className="grid-3" style={{ marginTop: 14 }}>
        <article className="stat-card">
          <span>Total del evento</span>
          <strong>{formatCurrency(eventSummary?.total_amount)}</strong>
        </article>
        <article className="stat-card">
          <span>Total pagado</span>
          <strong>{formatCurrency(totals.paid)}</strong>
        </article>
        <article className={`stat-card${remainingBalance > 0 ? " is-warning" : ""}`}>
          <span>Saldo por planificar</span>
          <strong>{formatCurrency(remainingBalance)}</strong>
        </article>
      </section>

      <form className="edit-form" onSubmit={rebuildPendingPlan} style={{ marginTop: 14 }}>
        <h3>Modificar plan pendiente</h3>
        <div className="form-grid-2">
          <label>
            Repartir saldo en cuántas cuotas
            <input
              min={1}
              required
              step={1}
              type="number"
              value={planForm.installment_count}
              onChange={(event) => setPlanForm((current) => ({ ...current, installment_count: event.target.value }))}
            />
          </label>
          <label>
            Primera fecha de vencimiento
            <input
              required
              type="date"
              value={planForm.first_due_date}
              onChange={(event) => setPlanForm((current) => ({ ...current, first_due_date: event.target.value }))}
            />
          </label>
        </div>
        <p className="muted">
          Esta acción conserva las cuotas ya pagadas y reemplaza solo el plan pendiente con un nuevo calendario.
        </p>
        <button className="primary-button" type="submit">
          Rehacer plan pendiente
        </button>
      </form>

      <form className="edit-form" onSubmit={addPayment} style={{ marginTop: 14 }}>
        <h3>Agregar cuota manual</h3>
        <div className="form-grid-2">
          <label>
            Monto
            <input
              inputMode="numeric"
              min={1}
              required
              step={1}
              type="number"
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            />
          </label>
          <label>
            Tipo
            <select value={form.payment_type} onChange={(event) => setForm((current) => ({ ...current, payment_type: event.target.value }))}>
              <option value="deposit">Abono</option>
              <option value="installment">Cuota</option>
              <option value="balance">Saldo</option>
              <option value="refund">Devolución</option>
              <option value="other">Otro</option>
            </select>
          </label>
        </div>
        <div className="form-grid-2">
          <label>
            Vence
            <input type="date" value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} />
          </label>
          <p className="muted">Si necesitas una cuota especial, puedes agregarla manualmente sin rehacer el resto del plan.</p>
        </div>
        <button className="primary-button" type="submit">
          Agregar cuota
        </button>
      </form>

      <div className="button-row" style={{ marginTop: 14 }}>
        <button className="secondary-button" type="button" onClick={() => setShowPayments((current) => !current)}>
          {showPayments ? "Ocultar cuotas" : `Ver cuotas (${payments.length})`}
        </button>
      </div>

      {showPayments && (
        <div className="list" style={{ marginTop: 14 }}>
          {payments.length === 0 && <p className="muted">Todavía no hay cuotas o pagos registrados.</p>}
          {payments.map((payment) => (
            <article className="list-item" key={payment.id}>
              <div className="list-item-header">
                <div>
                  <h3>{formatCurrency(payment.amount)}</h3>
                  <p className="muted">
                    {paymentTypeLabel(payment.payment_type)} · {payment.status}
                    {payment.due_date ? ` · vence ${formatDate(payment.due_date)}` : " · sin vencimiento"}
                    {payment.paid_at ? ` · pagada ${formatDate(payment.paid_at.slice(0, 10))}` : ""}
                  </p>
                </div>
                <div className="button-row">
                  {payment.status !== "paid" && (
                    <button className="primary-button" type="button" onClick={() => markAsPaid(payment)}>
                      Marcar pagada
                    </button>
                  )}
                  <button className="secondary-button" type="button" onClick={() => startEditing(payment)}>
                    Editar cuota
                  </button>
                  <button className="secondary-button" type="button" onClick={() => deletePayment(payment)}>
                    Eliminar
                  </button>
                </div>
              </div>

            {editingId === payment.id && (
              <div className="edit-form">
                <div className="form-grid-2">
                  <label>
                    Monto
                    <input
                      inputMode="numeric"
                      min={1}
                      step={1}
                      type="number"
                      value={editingForm.amount}
                      onChange={(event) => setEditingForm((current) => ({ ...current, amount: event.target.value }))}
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={editingForm.payment_type}
                      onChange={(event) => setEditingForm((current) => ({ ...current, payment_type: event.target.value }))}
                    >
                      <option value="deposit">Abono</option>
                      <option value="installment">Cuota</option>
                      <option value="balance">Saldo</option>
                      <option value="refund">Devolución</option>
                      <option value="other">Otro</option>
                    </select>
                  </label>
                </div>
                <div className="form-grid-2">
                  <label>
                    Vencimiento
                    <input
                      type="date"
                      value={editingForm.due_date}
                      onChange={(event) => setEditingForm((current) => ({ ...current, due_date: event.target.value }))}
                    />
                  </label>
                  <div className="button-row" style={{ alignItems: "end" }}>
                    <button className="primary-button" type="button" onClick={() => saveEditedPayment(payment)}>
                      Guardar cuota
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditingForm({ amount: "", due_date: "", payment_type: "installment" });
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {payment.reference && <p>Referencia: {payment.reference}</p>}
            {payment.notes && <p className="muted">{payment.notes}</p>}

            <div className="detail-copy" style={{ marginTop: 0 }}>
              <h3>Facturación</h3>
              <p className="muted">
                {isPaymentInvoiced(payment, paymentDocuments) ? "Facturado" : "Sin factura registrada"}
                {extractInvoiceNumber(payment) ? ` · N° ${extractInvoiceNumber(payment)}` : ""}
              </p>
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={() => startInvoiceEditing(payment)}>
                  {isPaymentInvoiced(payment, paymentDocuments) ? "Editar facturación" : "Registrar factura"}
                </button>
                {(paymentDocuments[payment.id] ?? []).map((document) => (
                  <button className="secondary-button" key={document.id} type="button" onClick={() => openDocument(document)}>
                    Abrir factura
                  </button>
                ))}
              </div>
            </div>

            {invoiceEditingId === payment.id && (
              <div className="edit-form">
                <label className="checkbox-option">
                  <input
                    checked={invoiceForm.invoiced}
                    type="checkbox"
                    onChange={(event) => setInvoiceForm((current) => ({ ...current, invoiced: event.target.checked }))}
                  />
                  El servicio ya fue facturado
                </label>
                <div className="form-grid-2">
                  <label>
                    Número de factura
                    <input
                      placeholder="Ej: 1458"
                      value={invoiceForm.invoiceNumber}
                      onChange={(event) => setInvoiceForm((current) => ({ ...current, invoiceNumber: event.target.value }))}
                    />
                  </label>
                  <label>
                    Adjuntar factura
                    <input type="file" onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)} />
                  </label>
                </div>
                <div className="button-row">
                  <button className="primary-button" type="button" onClick={() => saveInvoiceInfo(payment)}>
                    Guardar facturación
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setInvoiceEditingId(null);
                      setInvoiceFile(null);
                      setInvoiceForm({ invoiced: false, invoiceNumber: "" });
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            </article>
          ))}
        </div>
      )}
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
