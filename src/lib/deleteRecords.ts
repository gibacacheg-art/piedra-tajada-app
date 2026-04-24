"use client";

import { supabase } from "@/lib/supabase";
import type { Document } from "@/types/database";

const bucketName = "event-documents";

type MinimalDocument = {
  id: string;
  file_path: string;
};

type MinimalQuoteItem = {
  id: string;
  request_id: string | null;
  event_id: string | null;
};

async function deleteStoredDocuments(relatedType: "event" | "event_request", relatedId: string) {
  const { data, error } = await supabase
    .from("documents")
    .select("id, file_path")
    .eq("related_type", relatedType)
    .eq("related_id", relatedId);

  if (error) {
    throw new Error(`No se pudieron cargar documentos asociados: ${error.message}`);
  }

  const documents = (data ?? []) as MinimalDocument[];
  const filePaths = documents.map((document) => document.file_path).filter(Boolean);

  if (filePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from(bucketName).remove(filePaths);

    if (storageError) {
      throw new Error(`No se pudieron eliminar archivos de Storage: ${storageError.message}`);
    }
  }

  if (documents.length > 0) {
    const { error: documentsError } = await supabase.from("documents").delete().eq("related_type", relatedType).eq("related_id", relatedId);

    if (documentsError) {
      throw new Error(`No se pudieron eliminar documentos registrados: ${documentsError.message}`);
    }
  }
}

async function cleanupCommentsAndActivityLogs(relatedType: "event" | "event_request", relatedId: string) {
  const [{ error: commentsError }, { error: activityLogsError }] = await Promise.all([
    supabase.from("comments").delete().eq("related_type", relatedType).eq("related_id", relatedId),
    supabase.from("activity_logs").delete().eq("related_type", relatedType).eq("related_id", relatedId)
  ]);

  if (commentsError) {
    throw new Error(`No se pudieron eliminar comentarios asociados: ${commentsError.message}`);
  }

  if (activityLogsError) {
    throw new Error(`No se pudo limpiar la trazabilidad asociada: ${activityLogsError.message}`);
  }
}

async function getLinkedEventIdsForRequest(requestId: string) {
  const { data, error } = await supabase.from("events").select("id").eq("request_id", requestId);

  if (error) {
    throw new Error(`No se pudieron cargar los eventos vinculados: ${error.message}`);
  }

  return (data ?? []).map((event) => event.id);
}

export async function archiveRequestById(requestId: string, shouldArchive = true) {
  const payload = shouldArchive
    ? { is_archived: true, archived_at: new Date().toISOString() }
    : { is_archived: false, archived_at: null };

  const { error } = await supabase.from("event_requests").update(payload).eq("id", requestId).is("trashed_at", null);

  if (error) {
    throw new Error(
      `No se pudo ${shouldArchive ? "archivar" : "desarchivar"} la solicitud: ${error.message}. Si sigue pasando, ejecuta la migración 004_archive_and_trash.sql.`
    );
  }
}

export async function archiveEventById(eventId: string, shouldArchive = true) {
  const payload = shouldArchive
    ? { is_archived: true, archived_at: new Date().toISOString() }
    : { is_archived: false, archived_at: null };

  const { error } = await supabase.from("events").update(payload).eq("id", eventId).is("trashed_at", null);

  if (error) {
    throw new Error(
      `No se pudo ${shouldArchive ? "archivar" : "desarchivar"} el evento: ${error.message}. Si sigue pasando, ejecuta la migración 004_archive_and_trash.sql.`
    );
  }
}

export async function moveRequestToTrashById(requestId: string) {
  const trashedAt = new Date().toISOString();
  const linkedEventIds = await getLinkedEventIdsForRequest(requestId);

  const [{ error: requestError }, linkedEventsResponse] = await Promise.all([
    supabase
      .from("event_requests")
      .update({ trashed_at: trashedAt, is_archived: false, archived_at: null })
      .eq("id", requestId),
    linkedEventIds.length > 0
      ? supabase
          .from("events")
          .update({ trashed_at: trashedAt, is_archived: false, archived_at: null })
          .in("id", linkedEventIds)
      : Promise.resolve({ error: null })
  ]);

  if (requestError) {
    throw new Error(`No se pudo mover la solicitud a papelera: ${requestError.message}. Ejecuta la migración 004_archive_and_trash.sql.`);
  }

  if (linkedEventsResponse.error) {
    throw new Error(`La solicitud se movió, pero no se pudo mover su evento vinculado: ${linkedEventsResponse.error.message}`);
  }
}

export async function moveEventToTrashById(eventId: string) {
  const { data, error } = await supabase.from("events").select("id, request_id").eq("id", eventId).maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar el evento: ${error.message}`);
  }

  if (!data) {
    throw new Error("El evento ya no existe o no está disponible.");
  }

  const trashedAt = new Date().toISOString();
  const [{ error: eventError }, linkedRequestResponse] = await Promise.all([
    supabase
      .from("events")
      .update({ trashed_at: trashedAt, is_archived: false, archived_at: null })
      .eq("id", eventId),
    data.request_id
      ? supabase
          .from("event_requests")
          .update({ trashed_at: trashedAt, is_archived: false, archived_at: null })
          .eq("id", data.request_id)
      : Promise.resolve({ error: null })
  ]);

  if (eventError) {
    throw new Error(`No se pudo mover el evento a papelera: ${eventError.message}. Ejecuta la migración 004_archive_and_trash.sql.`);
  }

  if (linkedRequestResponse.error) {
    throw new Error(`El evento se movió, pero no se pudo mover la solicitud vinculada: ${linkedRequestResponse.error.message}`);
  }
}

export async function moveDocumentToTrashById(documentId: string) {
  const { error } = await supabase.from("documents").update({ trashed_at: new Date().toISOString() }).eq("id", documentId);

  if (error) {
    throw new Error(`No se pudo mover el documento a papelera: ${error.message}. Ejecuta la migración 004_archive_and_trash.sql.`);
  }
}

export async function restoreRequestById(requestId: string) {
  const linkedEventIds = await getLinkedEventIdsForRequest(requestId);

  const [{ error: requestError }, linkedEventsResponse] = await Promise.all([
    supabase.from("event_requests").update({ trashed_at: null }).eq("id", requestId),
    linkedEventIds.length > 0 ? supabase.from("events").update({ trashed_at: null }).in("id", linkedEventIds) : Promise.resolve({ error: null })
  ]);

  if (requestError) {
    throw new Error(`No se pudo recuperar la solicitud: ${requestError.message}`);
  }

  if (linkedEventsResponse.error) {
    throw new Error(`La solicitud se recuperó, pero no se pudieron recuperar sus eventos vinculados: ${linkedEventsResponse.error.message}`);
  }
}

export async function restoreEventById(eventId: string) {
  const { data, error } = await supabase.from("events").select("id, request_id").eq("id", eventId).maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar el evento: ${error.message}`);
  }

  if (!data) {
    throw new Error("El evento ya no existe o no está disponible.");
  }

  const [{ error: eventError }, linkedRequestResponse] = await Promise.all([
    supabase.from("events").update({ trashed_at: null }).eq("id", eventId),
    data.request_id ? supabase.from("event_requests").update({ trashed_at: null }).eq("id", data.request_id) : Promise.resolve({ error: null })
  ]);

  if (eventError) {
    throw new Error(`No se pudo recuperar el evento: ${eventError.message}`);
  }

  if (linkedRequestResponse.error) {
    throw new Error(`El evento se recuperó, pero no se pudo recuperar la solicitud vinculada: ${linkedRequestResponse.error.message}`);
  }
}

export async function restoreDocumentById(documentId: string) {
  const { error } = await supabase.from("documents").update({ trashed_at: null }).eq("id", documentId);

  if (error) {
    throw new Error(`No se pudo recuperar el documento: ${error.message}`);
  }
}

export async function permanentlyDeleteDocumentById(document: Pick<Document, "id" | "file_path">) {
  const { error: storageError } = await supabase.storage.from(bucketName).remove([document.file_path]);

  if (storageError) {
    throw new Error(`No se pudo eliminar el archivo de Storage: ${storageError.message}`);
  }

  const { error: documentError } = await supabase.from("documents").delete().eq("id", document.id);

  if (documentError) {
    throw new Error(`No se pudo eliminar el documento: ${documentError.message}`);
  }
}

export async function deleteRequestById(requestId: string) {
  const { data: quoteItemsData, error: quoteItemsError } = await supabase
    .from("quote_items")
    .select("id, request_id, event_id")
    .eq("request_id", requestId);

  if (quoteItemsError) {
    throw new Error(`No se pudieron cargar las líneas de cotización: ${quoteItemsError.message}`);
  }

  const quoteItems = (quoteItemsData ?? []) as MinimalQuoteItem[];
  const quoteItemsToDetach = quoteItems.filter((item) => item.event_id);
  const quoteItemsToDelete = quoteItems.filter((item) => !item.event_id);

  if (quoteItemsToDetach.length > 0) {
    const { error } = await supabase.from("quote_items").update({ request_id: null }).in(
      "id",
      quoteItemsToDetach.map((item) => item.id)
    );

    if (error) {
      throw new Error(`No se pudieron conservar las cotizaciones del evento relacionado: ${error.message}`);
    }
  }

  if (quoteItemsToDelete.length > 0) {
    const { error } = await supabase.from("quote_items").delete().in(
      "id",
      quoteItemsToDelete.map((item) => item.id)
    );

    if (error) {
      throw new Error(`No se pudieron eliminar las cotizaciones de la solicitud: ${error.message}`);
    }
  }

  await deleteStoredDocuments("event_request", requestId);
  await cleanupCommentsAndActivityLogs("event_request", requestId);

  const { error: requestError } = await supabase.from("event_requests").delete().eq("id", requestId);

  if (requestError) {
    throw new Error(`No se pudo eliminar la solicitud: ${requestError.message}`);
  }
}

export async function deleteEventById(eventId: string) {
  const [{ data: eventData, error: eventError }, { data: quoteItemsData, error: quoteItemsError }] = await Promise.all([
    supabase.from("events").select("id, request_id").eq("id", eventId).maybeSingle(),
    supabase.from("quote_items").select("id, request_id, event_id").eq("event_id", eventId)
  ]);

  if (eventError) {
    throw new Error(`No se pudo cargar el evento antes de eliminarlo: ${eventError.message}`);
  }

  if (!eventData) {
    throw new Error("El evento ya no existe o no está disponible.");
  }

  if (quoteItemsError) {
    throw new Error(`No se pudieron cargar las cotizaciones del evento: ${quoteItemsError.message}`);
  }

  const quoteItems = (quoteItemsData ?? []) as MinimalQuoteItem[];
  const quoteItemsToDetach = quoteItems.filter((item) => item.request_id);
  const quoteItemsToDelete = quoteItems.filter((item) => !item.request_id);

  if (quoteItemsToDetach.length > 0) {
    const { error } = await supabase.from("quote_items").update({ event_id: null }).in(
      "id",
      quoteItemsToDetach.map((item) => item.id)
    );

    if (error) {
      throw new Error(`No se pudieron preservar las cotizaciones que vienen de la solicitud: ${error.message}`);
    }
  }

  if (quoteItemsToDelete.length > 0) {
    const { error } = await supabase.from("quote_items").delete().in(
      "id",
      quoteItemsToDelete.map((item) => item.id)
    );

    if (error) {
      throw new Error(`No se pudieron eliminar las cotizaciones propias del evento: ${error.message}`);
    }
  }

  await deleteStoredDocuments("event", eventId);
  await cleanupCommentsAndActivityLogs("event", eventId);

  const { error: deleteEventError } = await supabase.from("events").delete().eq("id", eventId);

  if (deleteEventError) {
    throw new Error(`No se pudo eliminar el evento: ${deleteEventError.message}`);
  }

  if (eventData.request_id) {
    await deleteRequestById(eventData.request_id);
  }
}
