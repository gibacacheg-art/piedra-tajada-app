import { supabase } from "@/lib/supabase";
import { safeDocumentFileName } from "@/features/documents/documentStorage";
import { buildInstallmentRows } from "@/features/events/eventPaymentsSupport";
import type { EventRequest } from "@/types/database";

function toLocalDateTime(date: string, time: string) {
  return `${date}T${time.length === 5 ? `${time}:00` : time}`;
}

type ConversionForm = {
  event_name: string;
  event_status: string;
  total_amount: string;
  deposit_amount: string;
  installment_count: string;
  first_due_date: string;
};

type ConvertRequestToEventParams = {
  request: EventRequest;
  form: ConversionForm;
  linkedEventId: string | null;
  createdBy: string | null;
};

type ConvertRequestToEventResult =
  | {
      success: true;
      eventId: string;
      eventStatus: string;
      message: string;
      shouldRedirect: boolean;
    }
  | {
      success: false;
      message: string;
      eventId?: string;
    };

async function syncExistingEvent({
  request,
  form,
  linkedEventId,
  createdBy
}: Required<Pick<ConvertRequestToEventParams, "request" | "form" | "createdBy">> & { linkedEventId: string }) {
  const targetEventStatus = form.event_status;

  const { error: updateEventError } = await supabase
    .from("events")
    .update({
      event_name: form.event_name.trim(),
      status: targetEventStatus,
      total_amount: Number(form.total_amount || 0),
      deposit_amount: Number(form.deposit_amount || 0),
      commercial_responsible_id: createdBy
    })
    .eq("id", linkedEventId);

  if (updateEventError) {
    return { success: false, message: `No se pudo actualizar el evento existente: ${updateEventError.message}` } satisfies ConvertRequestToEventResult;
  }

  const { error: reservationUpdateError } = await supabase
    .from("event_space_reservations")
    .update({ status: targetEventStatus })
    .eq("event_id", linkedEventId);

  if (reservationUpdateError) {
    return {
      success: false,
      message: `Evento actualizado, pero no se pudo sincronizar la reserva: ${reservationUpdateError.message}`
    } satisfies ConvertRequestToEventResult;
  }

  const { error: requestUpdateError } = await supabase.from("event_requests").update({ status: targetEventStatus }).eq("id", request.id);

  if (requestUpdateError) {
    return {
      success: false,
      message: `Evento actualizado, pero no se pudo sincronizar la solicitud: ${requestUpdateError.message}`
    } satisfies ConvertRequestToEventResult;
  }

  return {
    success: true,
    eventId: linkedEventId,
    eventStatus: targetEventStatus,
    message: targetEventStatus === "confirmed" ? "Evento confirmado y listo para abrir." : "Evento actualizado.",
    shouldRedirect: true
  } satisfies ConvertRequestToEventResult;
}

async function copyRequestDocumentsToEvent(requestId: string, eventId: string, createdBy: string | null) {
  const { data: quoteDocuments } = await supabase
    .from("documents")
    .select("*")
    .eq("related_type", "event_request")
    .eq("related_id", requestId);

  for (const document of quoteDocuments ?? []) {
    const eventFilePath = `events/${eventId}/cotizaciones/${Date.now()}-${safeDocumentFileName(document.file_name)}`;
    const { error: copyError } = await supabase.storage.from("event-documents").copy(document.file_path, eventFilePath);

    if (!copyError) {
      await supabase.from("documents").insert({
        related_type: "event",
        related_id: eventId,
        file_name: document.file_name,
        file_path: eventFilePath,
        mime_type: document.mime_type,
        file_size: document.file_size,
        uploaded_by: createdBy
      });
    }
  }
}

async function createNewEvent({
  request,
  form,
  createdBy
}: Required<Pick<ConvertRequestToEventParams, "request" | "form" | "createdBy">>) {
  const targetEventStatus = form.event_status;

  const { data: newEvent, error: eventError } = await supabase
    .from("events")
    .insert({
      request_id: request.id,
      client_id: request.client_id,
      event_name: form.event_name.trim(),
      event_type: request.event_type,
      event_date: request.tentative_date,
      start_time: request.start_time,
      end_time: request.end_time,
      guest_count: request.guest_count,
      status: targetEventStatus,
      main_responsible_id: null,
      commercial_responsible_id: createdBy,
      operations_responsible_id: null,
      contracted_services: null,
      menu_details: null,
      technical_requirements: request.special_requirements,
      logistics_requirements: null,
      internal_notes: request.notes,
      client_notes: null,
      total_amount: Number(form.total_amount || 0),
      deposit_amount: Number(form.deposit_amount || 0),
      created_by: createdBy
    })
    .select("id")
    .single();

  if (eventError) {
    return { success: false, message: `No se pudo crear el evento: ${eventError.message}` } satisfies ConvertRequestToEventResult;
  }

  if (request.requested_space_id) {
    const { error: reservationError } = await supabase.from("event_space_reservations").insert({
      event_id: newEvent.id,
      space_id: request.requested_space_id,
      start_at: toLocalDateTime(request.tentative_date, request.start_time),
      end_at: toLocalDateTime(request.tentative_date, request.end_time),
      status: targetEventStatus,
      created_by: createdBy
    });

    if (reservationError) {
      await supabase.from("events").update({ status: "cancelled" }).eq("id", newEvent.id);
      return {
        success: false,
        message: `El evento fue creado, pero no se pudo reservar el espacio. Probable choque de horario: ${reservationError.message}`,
        eventId: newEvent.id
      } satisfies ConvertRequestToEventResult;
    }
  }

  await supabase.from("quote_items").update({ event_id: newEvent.id }).eq("request_id", request.id);
  await copyRequestDocumentsToEvent(request.id, newEvent.id, createdBy);

  const depositAmount = Number(form.deposit_amount || 0);
  const totalAmount = Number(form.total_amount || 0);
  const installmentCount = Math.max(Number(form.installment_count || 1), 1);
  const balanceForInstallments = Math.max(totalAmount - depositAmount, 0);
  const firstDueDate = form.first_due_date || request.tentative_date;
  const paymentRows = [];

  if (depositAmount > 0) {
    paymentRows.push({
      event_id: newEvent.id,
      amount: depositAmount,
      payment_type: "deposit",
      due_date: new Date().toISOString().slice(0, 10),
      paid_at: new Date().toISOString(),
      status: "paid",
      reference: "Abono inicial registrado al crear evento",
      notes: null,
      created_by: createdBy
    });
  }

  if (balanceForInstallments > 0) {
    paymentRows.push(
      ...buildInstallmentRows({
        eventId: newEvent.id,
        amount: balanceForInstallments,
        installmentCount,
        firstDueDate,
        createdBy
      })
    );
  }

  if (paymentRows.length > 0) {
    const { error: paymentsError } = await supabase.from("payments").insert(paymentRows);

    if (paymentsError) {
      return {
        success: false,
        message: `Evento creado, pero no se pudo crear el plan de pagos: ${paymentsError.message}`,
        eventId: newEvent.id
      } satisfies ConvertRequestToEventResult;
    }
  }

  const { error: requestError } = await supabase.from("event_requests").update({ status: targetEventStatus }).eq("id", request.id);

  if (requestError) {
    return {
      success: false,
      message: `Evento creado, pero no se pudo actualizar la solicitud: ${requestError.message}`,
      eventId: newEvent.id
    } satisfies ConvertRequestToEventResult;
  }

  return {
    success: true,
    eventId: newEvent.id,
    eventStatus: targetEventStatus,
    message: targetEventStatus === "confirmed" ? "Solicitud convertida en evento confirmado." : "Solicitud convertida en evento en pre-reserva.",
    shouldRedirect: targetEventStatus === "confirmed"
  } satisfies ConvertRequestToEventResult;
}

export async function convertRequestToEvent({
  request,
  form,
  linkedEventId,
  createdBy
}: ConvertRequestToEventParams): Promise<ConvertRequestToEventResult> {
  if (linkedEventId) {
    return syncExistingEvent({
      request,
      form,
      linkedEventId,
      createdBy
    });
  }

  return createNewEvent({
    request,
    form,
    createdBy
  });
}
