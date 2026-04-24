"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  deleteEventById,
  deleteRequestById,
  permanentlyDeleteDocumentById,
  restoreDocumentById,
  restoreEventById,
  restoreRequestById
} from "@/lib/deleteRecords";
import { openStoredDocument } from "@/features/documents/documentStorage";
import { formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Document, Event, EventRequest } from "@/types/database";

type TrashedRequest = EventRequest & {
  clients?: {
    full_name: string | null;
  } | null;
};

type TrashedEvent = Event & {
  clients?: {
    full_name: string | null;
  } | null;
};

export function TrashOverview() {
  const [requests, setRequests] = useState<TrashedRequest[]>([]);
  const [events, setEvents] = useState<TrashedEvent[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadTrash() {
    const [requestsResponse, eventsResponse, documentsResponse] = await Promise.all([
      supabase
        .from("event_requests")
        .select("*, clients(full_name)")
        .not("trashed_at", "is", null)
        .order("trashed_at", { ascending: false }),
      supabase
        .from("events")
        .select("*, clients(full_name)")
        .not("trashed_at", "is", null)
        .order("trashed_at", { ascending: false }),
      supabase.from("documents").select("*").not("trashed_at", "is", null).order("trashed_at", { ascending: false })
    ]);

    if (requestsResponse.error || eventsResponse.error || documentsResponse.error) {
      setMessage(
        `No se pudo cargar la papelera: ${
          requestsResponse.error?.message || eventsResponse.error?.message || documentsResponse.error?.message || "Error desconocido"
        }`
      );
      return;
    }

    setRequests((requestsResponse.data ?? []) as TrashedRequest[]);
    setEvents((eventsResponse.data ?? []) as TrashedEvent[]);
    setDocuments((documentsResponse.data ?? []) as Document[]);
    setMessage("");
  }

  useEffect(() => {
    loadTrash();
  }, []);

  function toggleSelected(setter: Dispatch<SetStateAction<string[]>>, id: string) {
    setter((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function restoreSelectedRequests(ids: string[]) {
    if (ids.length === 0) return;
    setBusyKey("restore-requests");
    setMessage("");

    try {
      for (const id of ids) {
        await restoreRequestById(id);
      }
      setSelectedRequestIds([]);
      await loadTrash();
      setMessage(`${ids.length} solicitud(es) recuperada(s) desde papelera.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron recuperar las solicitudes.");
    } finally {
      setBusyKey(null);
    }
  }

  async function restoreSelectedEvents(ids: string[]) {
    if (ids.length === 0) return;
    setBusyKey("restore-events");
    setMessage("");

    try {
      for (const id of ids) {
        await restoreEventById(id);
      }
      setSelectedEventIds([]);
      await loadTrash();
      setMessage(`${ids.length} evento(s) recuperado(s) desde papelera.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron recuperar los eventos.");
    } finally {
      setBusyKey(null);
    }
  }

  async function restoreSelectedDocuments(ids: string[]) {
    if (ids.length === 0) return;
    setBusyKey("restore-documents");
    setMessage("");

    try {
      for (const id of ids) {
        await restoreDocumentById(id);
      }
      setSelectedDocumentIds([]);
      await loadTrash();
      setMessage(`${ids.length} documento(s) recuperado(s) desde papelera.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron recuperar los documentos.");
    } finally {
      setBusyKey(null);
    }
  }

  async function permanentlyDeleteSelectedRequests(ids: string[]) {
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `¿Eliminar definitivamente ${ids.length} solicitud(es)?\n\nEsta acción ya no se podrá deshacer.`
    );
    if (!confirmed) return;

    setBusyKey("delete-requests");
    setMessage("");

    try {
      for (const id of ids) {
        await deleteRequestById(id);
      }
      setSelectedRequestIds([]);
      await loadTrash();
      setMessage(`${ids.length} solicitud(es) eliminada(s) definitivamente.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron eliminar definitivamente las solicitudes.");
    } finally {
      setBusyKey(null);
    }
  }

  async function permanentlyDeleteSelectedEvents(ids: string[]) {
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `¿Eliminar definitivamente ${ids.length} evento(s)?\n\nEsta acción ya no se podrá deshacer.`
    );
    if (!confirmed) return;

    setBusyKey("delete-events");
    setMessage("");

    try {
      for (const id of ids) {
        await deleteEventById(id);
      }
      setSelectedEventIds([]);
      await loadTrash();
      setMessage(`${ids.length} evento(s) eliminado(s) definitivamente.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron eliminar definitivamente los eventos.");
    } finally {
      setBusyKey(null);
    }
  }

  async function permanentlyDeleteSelectedDocuments(ids: string[]) {
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `¿Eliminar definitivamente ${ids.length} documento(s)?\n\nEsta acción ya no se podrá deshacer.`
    );
    if (!confirmed) return;

    setBusyKey("delete-documents");
    setMessage("");

    try {
      for (const document of documents.filter((item) => ids.includes(item.id))) {
        await permanentlyDeleteDocumentById(document);
      }
      setSelectedDocumentIds([]);
      await loadTrash();
      setMessage(`${ids.length} documento(s) eliminado(s) definitivamente.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron eliminar definitivamente los documentos.");
    } finally {
      setBusyKey(null);
    }
  }

  async function openDocument(document: Document) {
    try {
      await openStoredDocument(document);
    } catch (error) {
      setMessage(`No se pudo abrir el documento: ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Recuperación"
        title="Papelera"
        description="Aquí quedan solicitudes, eventos y documentos enviados a papelera para recuperarlos o borrarlos definitivamente."
      />

      <section className="grid-3" style={{ marginBottom: 14 }}>
        <article className="stat-card">
          <span>Solicitudes en papelera</span>
          <strong>{requests.length}</strong>
        </article>
        <article className="stat-card">
          <span>Eventos en papelera</span>
          <strong>{events.length}</strong>
        </article>
        <article className="stat-card">
          <span>Documentos en papelera</span>
          <strong>{documents.length}</strong>
        </article>
      </section>

      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="list-item-header">
          <div>
            <h2>Solicitudes eliminadas</h2>
            <p className="muted">Recupéralas si te equivocaste o elimínalas definitivamente si ya no las necesitas.</p>
          </div>
          <strong>{requests.length}</strong>
        </div>
        <div className="button-row" style={{ marginTop: 14 }}>
          <button className="secondary-button" type="button" onClick={() => setSelectedRequestIds(requests.map((item) => item.id))} disabled={requests.length === 0}>
            Seleccionar visibles
          </button>
          <button className="secondary-button" type="button" onClick={() => setSelectedRequestIds([])} disabled={selectedRequestIds.length === 0}>
            Limpiar selección
          </button>
          <button className="secondary-button" type="button" onClick={() => restoreSelectedRequests(selectedRequestIds)} disabled={selectedRequestIds.length === 0 || busyKey !== null}>
            {busyKey === "restore-requests" ? "Recuperando..." : `Recuperar (${selectedRequestIds.length})`}
          </button>
          <button className="danger-button" type="button" onClick={() => permanentlyDeleteSelectedRequests(selectedRequestIds)} disabled={selectedRequestIds.length === 0 || busyKey !== null}>
            {busyKey === "delete-requests" ? "Eliminando..." : `Borrado definitivo (${selectedRequestIds.length})`}
          </button>
        </div>
        <div className="list" style={{ marginTop: 14 }}>
          {requests.length === 0 && <p className="muted">No hay solicitudes en papelera.</p>}
          {requests.map((request) => (
            <article className="list-item" key={request.id}>
              <div className="list-item-header">
                <div className="button-row" style={{ alignItems: "flex-start" }}>
                  <label className="checkbox-option" style={{ padding: 8 }}>
                    <input
                      checked={selectedRequestIds.includes(request.id)}
                      type="checkbox"
                      onChange={() => toggleSelected(setSelectedRequestIds, request.id)}
                    />
                  </label>
                  <div>
                    <h3>{request.event_type}</h3>
                    <p className="muted">{request.clients?.full_name ?? "Cliente sin nombre"}</p>
                  </div>
                </div>
                <p className="muted">En papelera desde {request.trashed_at ? formatDate(request.trashed_at.slice(0, 10)) : "sin fecha"}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="list-item-header">
          <div>
            <h2>Eventos eliminados</h2>
            <p className="muted">Útil cuando un evento se fue por error y todavía quieres traerlo de vuelta.</p>
          </div>
          <strong>{events.length}</strong>
        </div>
        <div className="button-row" style={{ marginTop: 14 }}>
          <button className="secondary-button" type="button" onClick={() => setSelectedEventIds(events.map((item) => item.id))} disabled={events.length === 0}>
            Seleccionar visibles
          </button>
          <button className="secondary-button" type="button" onClick={() => setSelectedEventIds([])} disabled={selectedEventIds.length === 0}>
            Limpiar selección
          </button>
          <button className="secondary-button" type="button" onClick={() => restoreSelectedEvents(selectedEventIds)} disabled={selectedEventIds.length === 0 || busyKey !== null}>
            {busyKey === "restore-events" ? "Recuperando..." : `Recuperar (${selectedEventIds.length})`}
          </button>
          <button className="danger-button" type="button" onClick={() => permanentlyDeleteSelectedEvents(selectedEventIds)} disabled={selectedEventIds.length === 0 || busyKey !== null}>
            {busyKey === "delete-events" ? "Eliminando..." : `Borrado definitivo (${selectedEventIds.length})`}
          </button>
        </div>
        <div className="list" style={{ marginTop: 14 }}>
          {events.length === 0 && <p className="muted">No hay eventos en papelera.</p>}
          {events.map((event) => (
            <article className="list-item" key={event.id}>
              <div className="list-item-header">
                <div className="button-row" style={{ alignItems: "flex-start" }}>
                  <label className="checkbox-option" style={{ padding: 8 }}>
                    <input checked={selectedEventIds.includes(event.id)} type="checkbox" onChange={() => toggleSelected(setSelectedEventIds, event.id)} />
                  </label>
                  <div>
                    <h3>{event.event_name}</h3>
                    <p className="muted">{event.clients?.full_name ?? "Cliente sin nombre"}</p>
                  </div>
                </div>
                <p className="muted">En papelera desde {event.trashed_at ? formatDate(event.trashed_at.slice(0, 10)) : "sin fecha"}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="list-item-header">
          <div>
            <h2>Documentos eliminados</h2>
            <p className="muted">Puedes recuperar cotizaciones, comprobantes y archivos operativos sin perderlos al primer clic.</p>
          </div>
          <strong>{documents.length}</strong>
        </div>
        <div className="button-row" style={{ marginTop: 14 }}>
          <button className="secondary-button" type="button" onClick={() => setSelectedDocumentIds(documents.map((item) => item.id))} disabled={documents.length === 0}>
            Seleccionar visibles
          </button>
          <button className="secondary-button" type="button" onClick={() => setSelectedDocumentIds([])} disabled={selectedDocumentIds.length === 0}>
            Limpiar selección
          </button>
          <button className="secondary-button" type="button" onClick={() => restoreSelectedDocuments(selectedDocumentIds)} disabled={selectedDocumentIds.length === 0 || busyKey !== null}>
            {busyKey === "restore-documents" ? "Recuperando..." : `Recuperar (${selectedDocumentIds.length})`}
          </button>
          <button className="danger-button" type="button" onClick={() => permanentlyDeleteSelectedDocuments(selectedDocumentIds)} disabled={selectedDocumentIds.length === 0 || busyKey !== null}>
            {busyKey === "delete-documents" ? "Eliminando..." : `Borrado definitivo (${selectedDocumentIds.length})`}
          </button>
        </div>
        <div className="list" style={{ marginTop: 14 }}>
          {documents.length === 0 && <p className="muted">No hay documentos en papelera.</p>}
          {documents.map((document) => (
            <article className="list-item" key={document.id}>
              <div className="list-item-header">
                <div className="button-row" style={{ alignItems: "flex-start" }}>
                  <label className="checkbox-option" style={{ padding: 8 }}>
                    <input
                      checked={selectedDocumentIds.includes(document.id)}
                      type="checkbox"
                      onChange={() => toggleSelected(setSelectedDocumentIds, document.id)}
                    />
                  </label>
                  <div>
                    <h3>{document.file_name}</h3>
                    <p className="muted">{document.related_type}</p>
                  </div>
                </div>
                <div className="button-row">
                  <button className="secondary-button" type="button" onClick={() => openDocument(document)}>
                    Abrir
                  </button>
                  {document.related_type === "event" ? (
                    <Link className="secondary-button" href={`/events/${document.related_id}`}>
                      Ir al evento
                    </Link>
                  ) : document.related_type === "event_request" ? (
                    <Link className="secondary-button" href={`/requests/${document.related_id}`}>
                      Ir a la solicitud
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {message ? <p className="form-message">{message}</p> : null}
    </>
  );
}
