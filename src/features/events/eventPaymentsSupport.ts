import { supabase } from "@/lib/supabase";
import { documentsBucketName, safeDocumentFileName } from "@/features/documents/documentStorage";
import type { Document, Event, Payment } from "@/types/database";

export type EventPaymentSummary = {
  totalCount: number;
  pendingCount: number;
  overdueCount: number;
  pendingAmount: number;
};

export type InvoiceFormState = {
  invoiced: boolean;
  invoiceNumber: string;
};

export function paymentTypeLabel(paymentType: string) {
  switch (paymentType) {
    case "deposit":
      return "Abono";
    case "installment":
      return "Cuota";
    case "balance":
      return "Saldo";
    case "refund":
      return "Devolución";
    default:
      return "Otro";
  }
}

export function calculatePaymentTotals(payments: Payment[]) {
  return payments.reduce(
    (acc, payment) => {
      if (payment.status === "paid") acc.paid += Number(payment.amount || 0);
      if (payment.status === "pending" || payment.status === "overdue") acc.pending += Number(payment.amount || 0);
      return acc;
    },
    { paid: 0, pending: 0 }
  );
}

export function calculateRemainingBalance(totalAmount: number | null | undefined, paidAmount: number) {
  return Math.max(Number(totalAmount || 0) - paidAmount, 0);
}

export function summarizeEventPayments(
  payments: Array<Pick<Payment, "id" | "amount" | "due_date" | "status">>
): EventPaymentSummary {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    totalCount: payments.length,
    pendingCount: payments.filter((payment) => payment.status === "pending").length,
    overdueCount: payments.filter((payment) => {
      if (payment.status === "overdue") return true;
      if (payment.status !== "pending" || !payment.due_date) return false;
      return new Date(`${payment.due_date}T00:00:00`).getTime() < today.getTime();
    }).length,
    pendingAmount: payments
      .filter((payment) => payment.status === "pending" || payment.status === "overdue")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  };
}

export function extractInvoiceNumber(payment: Payment) {
  if (payment.invoice_number) {
    return payment.invoice_number.trim();
  }

  const match = payment.notes?.match(/Factura N°:\s*(.+)/i);
  return match?.[1]?.trim() ?? "";
}

export function isPaymentInvoiced(payment: Payment, paymentDocuments: Record<string, Document[]>) {
  return Boolean(payment.is_invoiced) || Boolean(extractInvoiceNumber(payment)) || (paymentDocuments[payment.id]?.length ?? 0) > 0;
}

export async function loadPaymentDocuments(paymentIds: string[]) {
  if (paymentIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("related_type", "payment")
    .in("related_id", paymentIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce<Record<string, Document[]>>((accumulator, document) => {
    if (!accumulator[document.related_id]) accumulator[document.related_id] = [];
    accumulator[document.related_id].push(document);
    return accumulator;
  }, {});
}

export async function loadEventPaymentsSnapshot(eventId: string) {
  const [{ data: paymentsData, error: paymentsError }, { data: eventData, error: eventError }] = await Promise.all([
    supabase.from("payments").select("*").eq("event_id", eventId).order("due_date"),
    supabase.from("events").select("id, total_amount").eq("id", eventId).single()
  ]);

  if (paymentsError) {
    throw new Error(`No se pudieron cargar pagos: ${paymentsError.message}`);
  }

  if (eventError) {
    throw new Error(`No se pudo cargar el total del evento: ${eventError.message}`);
  }

  const payments = (paymentsData ?? []) as Payment[];
  const paymentDocuments = await loadPaymentDocuments(payments.map((payment) => payment.id));

  return {
    payments,
    paymentDocuments,
    eventSummary: eventData as Pick<Event, "id" | "total_amount">
  };
}

export function buildInvoiceNotes(payment: Payment, invoiceForm: InvoiceFormState) {
  const baseNotes = (payment.notes ?? "")
    .split("\n")
    .filter((line) => !/^Factura N°:/i.test(line) && !/^Facturación:/i.test(line))
    .join("\n")
    .trim();

  return [
    baseNotes,
    invoiceForm.invoiced ? "Facturación: emitida" : "",
    invoiceForm.invoiced && invoiceForm.invoiceNumber ? `Factura N°: ${invoiceForm.invoiceNumber.trim()}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInstallmentRows({
  eventId,
  amount,
  installmentCount,
  firstDueDate,
  createdBy,
  notes
}: {
  eventId: string;
  amount: number;
  installmentCount: number;
  firstDueDate: string;
  createdBy?: string | null;
  notes?: string | null;
}) {
  const safeInstallmentCount = Math.max(installmentCount, 1);
  const baseAmount = Math.floor(amount / safeInstallmentCount);
  const remainder = amount - baseAmount * safeInstallmentCount;

  return Array.from({ length: safeInstallmentCount }, (_, index) => {
    const dueDate = new Date(`${firstDueDate}T00:00:00`);
    dueDate.setMonth(dueDate.getMonth() + index);

    return {
      event_id: eventId,
      amount: index === safeInstallmentCount - 1 ? baseAmount + remainder : baseAmount,
      payment_type: index === safeInstallmentCount - 1 ? "balance" : "installment",
      due_date: dueDate.toISOString().slice(0, 10),
      paid_at: null,
      status: "pending",
      reference: `Cuota ${index + 1} de ${safeInstallmentCount}`,
      notes: notes ?? null,
      created_by: createdBy ?? null
    };
  });
}

export async function uploadPaymentInvoiceDocument({
  paymentId,
  invoiceNumber,
  invoiceFile,
  uploadedBy
}: {
  paymentId: string;
  invoiceNumber: string;
  invoiceFile: File;
  uploadedBy: string | null;
}) {
  const invoiceLabel = invoiceNumber.trim() || "factura";
  const filePath = `payments/${paymentId}/${Date.now()}-${safeDocumentFileName(invoiceLabel)}-${safeDocumentFileName(invoiceFile.name)}`;

  const { error: uploadError } = await supabase.storage.from(documentsBucketName).upload(filePath, invoiceFile, {
    cacheControl: "3600",
    upsert: false
  });

  if (uploadError) {
    throw new Error(`Facturación guardada, pero no se pudo subir la factura: ${uploadError.message}`);
  }

  const { error: documentError } = await supabase.from("documents").insert({
    related_type: "payment",
    related_id: paymentId,
    file_name: invoiceFile.name,
    file_path: filePath,
    mime_type: invoiceFile.type || null,
    file_size: invoiceFile.size,
    uploaded_by: uploadedBy
  });

  if (documentError) {
    throw new Error(`Factura subida, pero no se pudo registrar el documento: ${documentError.message}`);
  }
}
