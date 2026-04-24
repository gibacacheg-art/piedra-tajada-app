"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/features/auth/AuthProvider";
import { archiveRequestById, moveRequestToTrashById } from "@/lib/deleteRecords";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { EventRequest } from "@/types/database";

export function RequestList() {
  const { canAccess, hasRole } = useAuth();
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [requestIdsWithConfirmedEvent, setRequestIdsWithConfirmedEvent] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const canDeleteRequests = hasRole("admin_general") || hasRole("ventas");
  const canCreateRequests = canAccess("/requests/new");
  const canAccessTrash = canAccess("/trash");

  async function loadRequests() {
    const [requestsResponse, eventsResponse] = await Promise.all([
      supabase
        .from("event_requests")
        .select("*, clients(full_name, phone, email, company_name), venues_spaces(name)")
        .order("tentative_date", { ascending: true }),
      supabase.from("events").select("request_id, status").in("status", ["confirmed", "executed", "cancelled"])
    ]);

    setRequests((requestsResponse.data ?? []) as EventRequest[]);
    setRequestIdsWithConfirmedEvent(
      (eventsResponse.data ?? [])
        .map((event) => event.request_id)
        .filter(Boolean) as string[]
    );
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const visibleRequests = requests.filter((request) => {
    if (request.trashed_at) return false;
    if (showArchived ? !request.is_archived : request.is_archived) return false;
    if (!showArchived && request.status === "confirmed" && requestIdsWithConfirmedEvent.includes(request.id)) return false;
    return true;
  });

  const filtered = visibleRequests.filter((request) => {
    const text = [request.event_type, request.clients?.full_name, request.clients?.company_name, request.status]
      .join(" ")
      .toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const matchesStatus = status === "all" || request.status === status;
    return matchesQuery && matchesStatus;
  });

  const selectedCount = selectedIds.filter((id) => filtered.some((request) => request.id === id)).length;

  const metrics = useMemo(() => {
    const now = Date.now();

    const needsQuote = visibleRequests.filter((request) => request.status === "request_received").length;
    const nearDate = visibleRequests.filter((request) => {
      if (!["request_received", "quoted", "pre_reserved"].includes(request.status)) return false;
      const eventDate = new Date(`${request.tentative_date}T00:00:00`).getTime();
      return eventDate >= now && eventDate - now <= 1000 * 60 * 60 * 24 * 7;
    }).length;
    const staleFollowUp = visibleRequests.filter((request) => {
      if (!["request_received", "quoted"].includes(request.status)) return false;
      const createdAt = new Date(request.created_at).getTime();
      return now - createdAt >= 1000 * 60 * 60 * 24 * 5;
    }).length;

    return { needsQuote, nearDate, staleFollowUp };
  }, [visibleRequests]);

  function getRequestAlert(request: EventRequest) {
    const now = Date.now();
    const eventDate = new Date(`${request.tentative_date}T00:00:00`).getTime();
    const createdAt = new Date(request.created_at).getTime();

    if (request.status === "request_received" && now - createdAt >= 1000 * 60 * 60 * 24 * 5) {
      return { tone: "alert", text: "Seguimiento pendiente" };
    }

    if (request.status === "request_received") {
      return { tone: "warning", text: "Sin cotizar" };
    }

    if (["quoted", "pre_reserved"].includes(request.status) && eventDate >= now && eventDate - now <= 1000 * 60 * 60 * 24 * 7) {
      return { tone: "warning", text: "Fecha cercana" };
    }

    if (request.status === "quoted" && now - createdAt >= 1000 * 60 * 60 * 24 * 5) {
      return { tone: "info", text: "Revisar cierre" };
    }

    return null;
  }

  async function handleTrashRequest(request: EventRequest) {
    const shouldDelete = window.confirm(
      `¿Mover a papelera la solicitud "${request.event_type}" de ${request.clients?.full_name ?? "este cliente"}?\n\nLuego la podrás recuperar desde Papelera.`
    );

    if (!shouldDelete) return;

    setDeletingId(request.id);
    setMessage("");

    try {
      await moveRequestToTrashById(request.id);
      setRequests((current) => current.filter((item) => item.id !== request.id));
      setSelectedIds((current) => current.filter((id) => id !== request.id));
      setMessage("Solicitud enviada a papelera.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo mover la solicitud a papelera.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleArchiveRequest(request: EventRequest, shouldArchive: boolean) {
    setDeletingId(request.id);
    setMessage("");

    try {
      await archiveRequestById(request.id, shouldArchive);
      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? { ...item, is_archived: shouldArchive, archived_at: shouldArchive ? new Date().toISOString() : null }
            : item
        )
      );
      setSelectedIds((current) => current.filter((id) => id !== request.id));
      setMessage(shouldArchive ? "Solicitud archivada." : "Solicitud recuperada desde archivados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el archivo de la solicitud.");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSelected(requestId: string) {
    setSelectedIds((current) => (current.includes(requestId) ? current.filter((id) => id !== requestId) : [...current, requestId]));
  }

  function selectVisible() {
    setSelectedIds(filtered.map((request) => request.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function trashSelectedRequests() {
    if (selectedIds.length === 0) return;

    const selectedRequests = filtered.filter((request) => selectedIds.includes(request.id));
    const shouldDelete = window.confirm(
      `¿Mover ${selectedRequests.length} solicitud(es) a papelera?\n\nLuego podrás recuperarlas desde la sección Papelera.`
    );

    if (!shouldDelete) return;

    setDeletingId("bulk");
    setMessage("");

    try {
      for (const request of selectedRequests) {
        await moveRequestToTrashById(request.id);
      }
      setRequests((current) => current.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
      setMessage(`${selectedRequests.length} solicitud(es) enviada(s) a papelera.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron mover las solicitudes seleccionadas a papelera.");
    } finally {
      setDeletingId(null);
    }
  }

  async function archiveSelectedRequests(shouldArchive: boolean) {
    if (selectedIds.length === 0) return;

    const selectedRequests = filtered.filter((request) => selectedIds.includes(request.id));
    setDeletingId("bulk");
    setMessage("");

    try {
      for (const request of selectedRequests) {
        await archiveRequestById(request.id, shouldArchive);
      }
      setRequests((current) =>
        current.map((item) =>
          selectedIds.includes(item.id)
            ? { ...item, is_archived: shouldArchive, archived_at: shouldArchive ? new Date().toISOString() : null }
            : item
        )
      );
      setSelectedIds([]);
      setMessage(
        shouldArchive
          ? `${selectedRequests.length} solicitud(es) archivada(s).`
          : `${selectedRequests.length} solicitud(es) recuperada(s) de archivados.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron actualizar las solicitudes seleccionadas.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Ventas"
        title="Solicitudes de reserva"
        description="Vista de apoyo para el tramo comercial. El seguimiento principal del caso ahora parte desde Reservas."
      />

      <section className="grid-3" style={{ marginBottom: 14 }}>
        <article className={`stat-card${metrics.needsQuote > 0 ? " is-warning" : ""}`}>
          <span>Sin cotizar</span>
          <strong>{metrics.needsQuote}</strong>
        </article>
        <article className={`stat-card${metrics.nearDate > 0 ? " is-warning" : ""}`}>
          <span>Fecha cercana</span>
          <strong>{metrics.nearDate}</strong>
        </article>
        <article className={`stat-card${metrics.staleFollowUp > 0 ? " is-alert" : ""}`}>
          <span>Seguimiento pendiente</span>
          <strong>{metrics.staleFollowUp}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="toolbar">
          <input placeholder="Buscar por cliente, empresa o tipo de evento" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="button-row">
            <Link className="secondary-button" href="/reservations">
              Volver a Reservas
            </Link>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="request_received">Nueva solicitud</option>
              <option value="quoted">Cotización enviada</option>
              <option value="pre_reserved">Lista para pasar a evento</option>
              <option value="lost">Perdida</option>
            </select>
            <button className="secondary-button" type="button" onClick={() => setShowArchived((current) => !current)}>
              {showArchived ? "Ver activas" : "Ver archivadas"}
            </button>
            {canAccessTrash ? (
              <Link className="secondary-button" href="/trash">
                Papelera
              </Link>
            ) : null}
            {canCreateRequests ? (
              <Link className="primary-button" href="/requests/new">
                Nueva reserva
              </Link>
            ) : null}
          </div>
        </div>

        {canDeleteRequests ? (
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
              onClick={() => archiveSelectedRequests(!showArchived)}
              disabled={selectedIds.length === 0 || deletingId === "bulk"}
            >
              {showArchived ? `Desarchivar seleccionadas (${selectedCount || selectedIds.length})` : `Archivar seleccionadas (${selectedCount || selectedIds.length})`}
            </button>
            <button className="danger-button" type="button" onClick={trashSelectedRequests} disabled={selectedIds.length === 0 || deletingId === "bulk"}>
              {deletingId === "bulk" ? "Moviendo..." : `Mover a papelera (${selectedCount || selectedIds.length})`}
            </button>
          </div>
        ) : null}

        <div className="list" style={{ marginTop: 14 }}>
          {filtered.map((request) => {
            const alert = getRequestAlert(request);

            return (
              <article
                className={`list-item${alert?.tone === "alert" ? " is-alert" : alert?.tone === "warning" ? " is-warning" : ""}`}
                key={request.id}
              >
                <div className="list-item-header">
                  <div className="button-row" style={{ alignItems: "flex-start" }}>
                    {canDeleteRequests ? (
                      <label className="checkbox-option" style={{ padding: 8 }}>
                        <input
                          checked={selectedIds.includes(request.id)}
                          type="checkbox"
                          onChange={() => toggleSelected(request.id)}
                        />
                      </label>
                    ) : null}
                    <Link className="list-item-link" href={`/requests/${request.id}`}>
                      <div>
                        <h3>{request.event_type}</h3>
                        <p className="muted">{request.clients?.full_name ?? "Cliente sin nombre"}</p>
                      </div>
                    </Link>
                  </div>
                  <div className="button-row list-item-actions">
                    {alert ? <span className={`alert-pill ${alert.tone}`}>{alert.text}</span> : null}
                    <StatusBadge status={request.status} />
                    {canDeleteRequests ? (
                      <>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={deletingId === request.id}
                          onClick={() => handleArchiveRequest(request, !request.is_archived)}
                        >
                          {deletingId === request.id ? "Guardando..." : request.is_archived ? "Desarchivar" : "Archivar"}
                        </button>
                        <button
                          className="danger-button"
                          type="button"
                          disabled={deletingId === request.id}
                          onClick={() => handleTrashRequest(request)}
                        >
                          {deletingId === request.id ? "Moviendo..." : "Papelera"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                <Link className="list-item-link" href={`/requests/${request.id}`}>
                  <div className="meta-grid">
                    <div className="meta-block">
                      <span>Fecha tentativa</span>
                      {formatDate(request.tentative_date)}
                    </div>
                    <div className="meta-block">
                      <span>Horario</span>
                      {request.start_time.slice(0, 5)} - {request.end_time.slice(0, 5)}
                    </div>
                    <div className="meta-block">
                      <span>Bloqueo calendario</span>
                      {request.venues_spaces?.name ?? "Sin bloqueo"}
                    </div>
                    <div className="meta-block">
                      <span>Presupuesto</span>
                      {formatCurrency(request.estimated_budget)}
                    </div>
                  </div>
                </Link>
              </article>
            );
          })}
          {filtered.length === 0 && <p className="muted">No hay solicitudes con esos filtros.</p>}
        </div>

        {message ? <p className="form-message">{message}</p> : null}
      </section>
    </>
  );
}
