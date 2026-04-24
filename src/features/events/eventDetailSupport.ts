import { supabase } from "@/lib/supabase";
import type { Event } from "@/types/database";
import { summarizeEventPayments, type EventPaymentSummary } from "./eventPaymentsSupport";

export type EventRequestSummary = {
  id: string;
  event_type: string;
  status: string;
  created_at: string;
};

export type ActivityLogEntry = {
  id: string;
  action: string;
  description: string | null;
  created_at: string;
};

export type CoordinationSummary = {
  openTasks: number;
  blockedTasks: number;
  checklistDone: number;
  checklistTotal: number;
};

export type EventDetailSnapshot = {
  event: Event;
  requestSummary: EventRequestSummary | null;
  quoteCount: number;
  activityLogs: ActivityLogEntry[];
  profileNames: Record<string, string>;
  coordinationSummary: CoordinationSummary;
  paymentSummary: EventPaymentSummary;
  warningMessage: string;
};

export async function loadEventDetailSnapshot(id: string): Promise<EventDetailSnapshot> {
  const { data, error } = await supabase.from("events").select("*, clients(full_name, phone, email, company_name)").eq("id", id).single();

  if (error) {
    throw new Error(`No se pudo cargar el evento: ${error.message}`);
  }

  const event = data as Event;
  const relatedProfileIds = [event.main_responsible_id, event.commercial_responsible_id, event.operations_responsible_id].filter(Boolean) as string[];

  const [requestResponse, quoteResponse, logsResponse, profilesResponse, tasksResponse, checklistItemsResponse, paymentsResponse] = await Promise.all([
    event.request_id
      ? supabase.from("event_requests").select("id, event_type, status, created_at").eq("id", event.request_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("quote_items")
      .select("id")
      .or(event.request_id ? `event_id.eq.${event.id},request_id.eq.${event.request_id}` : `event_id.eq.${event.id}`),
    supabase.from("activity_logs").select("id, action, description, created_at").eq("related_type", "event").eq("related_id", event.id).order("created_at", { ascending: false }).limit(12),
    relatedProfileIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", relatedProfileIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("tasks").select("id, status").eq("event_id", event.id),
    supabase.from("checklist_items").select("id, is_done, checklists!inner(event_id)").eq("checklists.event_id", event.id),
    supabase.from("payments").select("id, amount, due_date, status").eq("event_id", event.id)
  ]);

  const warnings = [requestResponse.error?.message, quoteResponse.error?.message, logsResponse.error?.message].filter(Boolean);
  const tasks = tasksResponse.data ?? [];
  const checklistItems = (checklistItemsResponse.data ?? []) as Array<{ id: string; is_done: boolean }>;
  const payments = paymentsResponse.data ?? [];
  const profileNames = ((profilesResponse.data ?? []) as Array<{ id: string; full_name: string }>).reduce<Record<string, string>>(
    (accumulator, profile) => {
      accumulator[profile.id] = profile.full_name;
      return accumulator;
    },
    {}
  );

  return {
    event,
    requestSummary: (requestResponse.data as EventRequestSummary | null) ?? null,
    quoteCount: (quoteResponse.data ?? []).length,
    activityLogs: (logsResponse.data ?? []) as ActivityLogEntry[],
    profileNames,
    coordinationSummary: {
      openTasks: tasks.filter((task) => ["pending", "in_progress", "blocked"].includes(task.status)).length,
      blockedTasks: tasks.filter((task) => task.status === "blocked").length,
      checklistDone: checklistItems.filter((item) => item.is_done).length,
      checklistTotal: checklistItems.length
    },
    paymentSummary: summarizeEventPayments(payments),
    warningMessage: warnings.join(" · ")
  };
}

export function getVisibleBalance(paymentSummary: EventPaymentSummary, fallbackBalance: number | null | undefined) {
  return paymentSummary.totalCount > 0 ? paymentSummary.pendingAmount : Number(fallbackBalance || 0);
}

export function getClosureLabel(event: Event, visibleBalance: number, openTasks: number) {
  if (event.status === "cancelled") return "Cancelada";
  if (event.status !== "executed") return "Aún en curso";
  if (visibleBalance > 0) return "Realizada con cierre pendiente";
  if (openTasks > 0) return "Realizada con pendientes internos";
  return "Cerrada";
}

export function getEventNextAction({
  event,
  visibleBalance,
  coordinationSummary,
  paymentSummary
}: {
  event: Event;
  visibleBalance: number;
  coordinationSummary: CoordinationSummary;
  paymentSummary: EventPaymentSummary;
}) {
  const eventDate = new Date(`${event.event_date}T00:00:00`);
  const now = new Date();
  const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (!event.main_responsible_id) {
    return "Asignar responsable principal para que la coordinación tenga dueño claro.";
  }

  if (event.status === "pre_reserved") {
    return "Definir si el evento pasa a confirmado y revisar que la cotización vigente esté alineada.";
  }

  if (visibleBalance > 0 && paymentSummary.overdueCount > 0) {
    return "Revisar cobros vencidos antes de seguir con el cierre operativo del evento.";
  }

  if (visibleBalance > 0 && daysUntilEvent <= 7) {
    return "Revisar saldo pendiente y próximos vencimientos antes de la fecha del evento.";
  }

  if (coordinationSummary.blockedTasks > 0) {
    return "Destrabar tareas bloqueadas para que la coordinación no llegue con pendientes críticos.";
  }

  if (coordinationSummary.openTasks > 0 && daysUntilEvent <= 7) {
    return "Revisar pendientes operativos y confirmar que el checklist avance esta semana.";
  }

  if (!event.menu_details && daysUntilEvent <= 14) {
    return "Completar menú y definiciones clave antes de entrar a la última etapa de coordinación.";
  }

  if (event.status === "executed" && visibleBalance > 0) {
    return "Cerrar cobros pendientes del evento ya ejecutado.";
  }

  if (event.status === "executed" && coordinationSummary.openTasks === 0 && visibleBalance === 0) {
    return "El caso está listo para darse por cerrado y salir del flujo activo.";
  }

  return "Seguimiento normal: revisar responsables, actividad reciente y próximos hitos del evento.";
}
