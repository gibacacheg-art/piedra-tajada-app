"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/features/auth/AuthProvider";
import { archiveEventById, moveEventToTrashById } from "@/lib/deleteRecords";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Event } from "@/types/database";

type EventWithRequestStatus = Event & {
  event_requests?: {
    status: string;
  } | null;
};

export function EventList() {
  const { hasRole, canAccess } = useAuth();
  const [events, setEvents] = useState<EventWithRequestStatus[]>([]);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const canDeleteEvents = hasRole("admin_general");
  const canAccessTrash = canAccess("/trash");

  useEffect(() => {
    async function loadEvents() {
      const { data } = await supabase
        .from("events")
        .select("*, clients(full_name, phone, email, company_name), event_requests(status)")
        .order("event_date", { ascending: true });

      setEvents((data ?? []) as EventWithRequestStatus[]);
    }

    loadEvents();
  }, []);

  const visibleEvents = events.filter((event) => {
    if (event.trashed_at) return false;
    if (showArchived ? !event.is_archived : event.is_archived) return false;
    if (showArchived) return true;
    return ["confirmed", "executed", "cancelled"].includes(event.status) || event.event_requests?.status === "confirmed";
  });

  const filtered = visibleEvents.filter((event) =>
    [event.event_name, event.event_type, event.clients?.full_name, event.status].join(" ").toLowerCase().includes(query.toLowerCase())
  );
  const selectedCount = selectedIds.filter((id) => filtered.some((event) => event.id === id)).length;

  function getEventAlert(event: Event) {
    const eventDate = new Date(`${event.event_date}T00:00:00`).getTime();
    const now = Date.now();

    if (Number(event.balance_amount || 0) > 0 && eventDate - now <= 1000 * 60 * 60 * 24 * 7 && event.status === "confirmed") {
      return { tone: "warning", text: "Saldo pendiente" };
    }

    if (eventDate - now <= 1000 * 60 * 60 * 24 * 3 && event.status === "confirmed") {
      return { tone: "info", text: "Próximo" };
    }

    return null;
  }

  async function handleTrashEvent(event: Event) {
    const shouldDelete = window.confirm(
      `¿Mover a papelera el evento "${event.event_name}"?\n\nLuego lo podrás recuperar desde Papelera.`
    );

    if (!shouldDelete) return;

    setDeletingId(event.id);
    setMessage("");

    try {
      await moveEventToTrashById(event.id);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setSelectedIds((current) => current.filter((id) => id !== event.id));
      setMessage("Evento enviado a papelera.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo mover el evento a papelera.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleArchiveEvent(event: Event, shouldArchive: boolean) {
    setDeletingId(event.id);
    setMessage("");

    try {
      await archiveEventById(event.id, shouldArchive);
      setEvents((current) =>
        current.map((item) =>
          item.id === event.id
            ? { ...item, is_archived: shouldArchive, archived_at: shouldArchive ? new Date().toISOString() : null }
            : item
        )
      );
      setSelectedIds((current) => current.filter((id) => id !== event.id));
      setMessage(shouldArchive ? "Evento archivado." : "Evento recuperado desde archivados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el archivo del evento.");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSelected(eventId: string) {
    setSelectedIds((current) => (current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId]));
  }

  function selectVisible() {
    setSelectedIds(filtered.map((event) => event.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function trashSelectedEvents() {
    if (selectedIds.length === 0) return;

    const selectedEvents = filtered.filter((event) => selectedIds.includes(event.id));
    const shouldDelete = window.confirm(
      `¿Mover ${selectedEvents.length} evento(s) a papelera?\n\nLuego los podrás recuperar desde Papelera.`
    );

    if (!shouldDelete) return;

    setDeletingId("bulk");
    setMessage("");

    try {
      for (const event of selectedEvents) {
        await moveEventToTrashById(event.id);
      }
      setEvents((current) => current.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
      setMessage(`${selectedEvents.length} evento(s) enviado(s) a papelera.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron mover los eventos seleccionados a papelera.");
    } finally {
      setDeletingId(null);
    }
  }

  async function archiveSelectedEvents(shouldArchive: boolean) {
    if (selectedIds.length === 0) return;

    const selectedEvents = filtered.filter((event) => selectedIds.includes(event.id));
    setDeletingId("bulk");
    setMessage("");

    try {
      for (const event of selectedEvents) {
        await archiveEventById(event.id, shouldArchive);
      }
      setEvents((current) =>
        current.map((item) =>
          selectedIds.includes(item.id)
            ? { ...item, is_archived: shouldArchive, archived_at: shouldArchive ? new Date().toISOString() : null }
            : item
        )
      );
      setSelectedIds([]);
      setMessage(shouldArchive ? `${selectedEvents.length} evento(s) archivado(s).` : `${selectedEvents.length} evento(s) desarchivado(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron actualizar los eventos seleccionados.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Eventos"
        description="Vista de apoyo para operación. La continuidad del caso se sigue primero desde Reservas."
      />

      <section className="panel">
        <div className="toolbar">
          <input placeholder="Buscar evento, cliente o estado" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="button-row">
            <Link className="secondary-button" href="/reservations">
              Volver a Reservas
            </Link>
            <button className="secondary-button" type="button" onClick={() => setShowArchived((current) => !current)}>
              {showArchived ? "Ver activos" : "Ver archivados"}
            </button>
            {canAccessTrash ? (
              <Link className="secondary-button" href="/trash">
                Papelera
              </Link>
            ) : null}
          </div>
        </div>

        {canDeleteEvents ? (
          <div className="button-row" style={{ marginTop: 14 }}>
            <button className="secondary-button" type="button" onClick={selectVisible} disabled={filtered.length === 0}>
              Seleccionar visibles
            </button>
            <button className="secondary-button" type="button" onClick={clearSelection} disabled={selectedIds.length === 0}>
              Limpiar selección
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => archiveSelectedEvents(!showArchived)}
              disabled={selectedIds.length === 0 || deletingId === "bulk"}
            >
              {showArchived ? `Desarchivar seleccionados (${selectedCount || selectedIds.length})` : `Archivar seleccionados (${selectedCount || selectedIds.length})`}
            </button>
            <button className="danger-button" type="button" onClick={trashSelectedEvents} disabled={selectedIds.length === 0 || deletingId === "bulk"}>
              {deletingId === "bulk" ? "Moviendo..." : `Mover a papelera (${selectedCount || selectedIds.length})`}
            </button>
          </div>
        ) : null}

        <div className="list" style={{ marginTop: 14 }}>
          {filtered.map((event) => {
            const alert = getEventAlert(event);

            return (
              <article
                className={`list-item${alert?.tone === "warning" ? " is-warning" : ""}`}
                key={event.id}
              >
                <div className="list-item-header">
                  <div className="button-row" style={{ alignItems: "flex-start" }}>
                    {canDeleteEvents ? (
                      <label className="checkbox-option" style={{ padding: 8 }}>
                        <input checked={selectedIds.includes(event.id)} type="checkbox" onChange={() => toggleSelected(event.id)} />
                      </label>
                    ) : null}
                    <Link className="list-item-link" href={`/events/${event.id}`}>
                      <div>
                        <h3>{event.event_name}</h3>
                        <p className="muted">{event.clients?.full_name ?? "Cliente sin nombre"}</p>
                      </div>
                    </Link>
                  </div>
                  <div className="button-row list-item-actions">
                    {alert ? <span className={`alert-pill ${alert.tone}`}>{alert.text}</span> : null}
                    <StatusBadge status={event.status} />
                    {canDeleteEvents ? (
                      <>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={deletingId === event.id}
                          onClick={() => handleArchiveEvent(event, !event.is_archived)}
                        >
                          {deletingId === event.id ? "Guardando..." : event.is_archived ? "Desarchivar" : "Archivar"}
                        </button>
                        <button
                          className="danger-button"
                          type="button"
                          disabled={deletingId === event.id}
                          onClick={() => handleTrashEvent(event)}
                        >
                          {deletingId === event.id ? "Moviendo..." : "Papelera"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                <Link className="list-item-link" href={`/events/${event.id}`}>
                  <div className="meta-grid">
                    <div className="meta-block">
                      <span>Fecha</span>
                      {formatDate(event.event_date)}
                    </div>
                    <div className="meta-block">
                      <span>Tipo</span>
                      {event.event_type}
                    </div>
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
              </article>
            );
          })}
          {filtered.length === 0 && <p className="muted">No hay eventos visibles para tu rol.</p>}
        </div>

        {message ? <p className="form-message">{message}</p> : null}
      </section>
    </>
  );
}
