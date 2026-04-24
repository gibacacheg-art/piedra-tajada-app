"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatDocumentFileSize, openStoredDocument } from "@/features/documents/documentStorage";
import { formatDate } from "@/lib/format";
import { moveDocumentToTrashById } from "@/lib/deleteRecords";
import { supabase } from "@/lib/supabase";
import type { Document } from "@/types/database";

type RelatedMap = Record<string, { title: string; href: string }>;

type DocumentWithMeta = Document & {
  relatedTitle?: string;
  relatedHref?: string;
};

export function DocumentsOverview() {
  const { hasRole } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithMeta[]>([]);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [relatedType, setRelatedType] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  async function loadDocuments() {
    const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });

    if (error) {
      setMessage(`No se pudieron cargar documentos: ${error.message}`);
      return;
    }

    const rawDocuments = ((data ?? []) as Document[]).filter((document) => !document.trashed_at);
    const eventIds = Array.from(new Set(rawDocuments.filter((document) => document.related_type === "event").map((document) => document.related_id)));
    const requestIds = Array.from(
      new Set(rawDocuments.filter((document) => document.related_type === "event_request").map((document) => document.related_id))
    );

    const [eventsResponse, requestsResponse] = await Promise.all([
      eventIds.length > 0
        ? supabase.from("events").select("id, event_name").in("id", eventIds)
        : Promise.resolve({ data: [], error: null }),
      requestIds.length > 0
        ? supabase.from("event_requests").select("id, event_type").in("id", requestIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    const relatedMap: RelatedMap = {};

    for (const event of eventsResponse.data ?? []) {
      relatedMap[event.id] = {
        title: event.event_name,
        href: `/events/${event.id}`
      };
    }

    for (const request of requestsResponse.data ?? []) {
      relatedMap[request.id] = {
        title: request.event_type,
        href: `/requests/${request.id}`
      };
    }

    setDocuments(
      rawDocuments.map((document) => ({
        ...document,
        relatedTitle: relatedMap[document.related_id]?.title,
        relatedHref: relatedMap[document.related_id]?.href
      }))
    );
    setMessage("");
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function openDocument(document: Document) {
    try {
      await openStoredDocument(document);
    } catch (error) {
      setMessage(`No se pudo abrir documento: ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  }

  async function deleteDocument(document: Document) {
    const shouldDelete = window.confirm(`¿Mover "${document.file_name}" a papelera?`);
    if (!shouldDelete) return;

    setDeleting(true);
    setMessage("");

    try {
      await moveDocumentToTrashById(document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setSelectedIds((current) => current.filter((id) => id !== document.id));
      setMessage("Documento enviado a papelera.");
    } catch (error) {
      setMessage(`No se pudo mover el documento a papelera: ${error instanceof Error ? error.message : "Error desconocido"}`);
    } finally {
      setDeleting(false);
    }
  }

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const matchesType = relatedType === "all" || document.related_type === relatedType;
      const matchesQuery = [document.file_name, document.relatedTitle, document.mime_type]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
      return matchesType && matchesQuery;
    });
  }, [documents, query, relatedType]);
  const selectedCount = selectedIds.filter((id) => filteredDocuments.some((document) => document.id === id)).length;
  const canManageTrash = hasRole("admin_general");

  const summary = useMemo(() => {
    return {
      total: documents.length,
      eventDocs: documents.filter((document) => document.related_type === "event").length,
      requestDocs: documents.filter((document) => document.related_type === "event_request").length
    };
  }, [documents]);

  function toggleSelected(documentId: string) {
    setSelectedIds((current) => (current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId]));
  }

  function selectVisible() {
    setSelectedIds(filteredDocuments.map((document) => document.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function deleteSelectedDocuments() {
    if (selectedIds.length === 0) return;

    const selectedDocuments = filteredDocuments.filter((document) => selectedIds.includes(document.id));
    const shouldDelete = window.confirm(`¿Mover ${selectedDocuments.length} documento(s) seleccionado(s) a papelera?`);
    if (!shouldDelete) return;

    setDeleting(true);
    setMessage("");

    try {
      for (const document of selectedDocuments) {
        await moveDocumentToTrashById(document.id);
      }
      setDocuments((current) => current.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
      setMessage(`${selectedDocuments.length} documento(s) enviado(s) a papelera.`);
    } catch (error) {
      setMessage(`No se pudieron mover los documentos seleccionados a papelera: ${error instanceof Error ? error.message : "Error desconocido"}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Archivos"
        title="Documentos"
        description="Vista central de cotizaciones, comprobantes, contratos y archivos asociados a solicitudes y eventos."
      />

      <section className="grid-3" style={{ marginBottom: 14 }}>
        <article className="stat-card">
          <span>Total documentos</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="stat-card">
          <span>Documentos de eventos</span>
          <strong>{summary.eventDocs}</strong>
        </article>
        <article className="stat-card">
          <span>Documentos de solicitudes</span>
          <strong>{summary.requestDocs}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="toolbar">
          <input placeholder="Buscar por nombre de archivo o referencia" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="button-row">
            <select value={relatedType} onChange={(event) => setRelatedType(event.target.value)}>
              <option value="all">Todos</option>
              <option value="event">Solo eventos</option>
              <option value="event_request">Solo solicitudes</option>
            </select>
            {canManageTrash ? (
              <Link className="secondary-button" href="/trash">
                Ver papelera
              </Link>
            ) : null}
          </div>
        </div>

        {canManageTrash ? (
          <div className="button-row" style={{ marginTop: 14 }}>
            <button className="secondary-button" type="button" onClick={selectVisible} disabled={filteredDocuments.length === 0}>
              Seleccionar visibles
            </button>
            <button className="secondary-button" type="button" onClick={clearSelection} disabled={selectedIds.length === 0}>
              Limpiar selección
            </button>
            <button className="danger-button" type="button" onClick={deleteSelectedDocuments} disabled={selectedIds.length === 0 || deleting}>
              {deleting ? "Moviendo..." : `Mover a papelera (${selectedCount || selectedIds.length})`}
            </button>
          </div>
        ) : null}

        <div className="list" style={{ marginTop: 14 }}>
          {filteredDocuments.length === 0 && <p className="muted">No hay documentos para este filtro.</p>}
          {filteredDocuments.map((document) => (
            <article className="list-item" key={document.id}>
              <div className="list-item-header">
                <div className="button-row" style={{ alignItems: "flex-start" }}>
                  {canManageTrash ? (
                    <label className="checkbox-option" style={{ padding: 8 }}>
                      <input checked={selectedIds.includes(document.id)} type="checkbox" onChange={() => toggleSelected(document.id)} />
                    </label>
                  ) : null}
                  <div>
                    <h3>{document.file_name}</h3>
                    <p className="muted">
                      {document.mime_type || "Archivo"} · {formatDocumentFileSize(document.file_size)}
                    </p>
                  </div>
                </div>
                <div className="button-row">
                  <button className="secondary-button" type="button" onClick={() => openDocument(document)}>
                    Abrir
                  </button>
                  {document.relatedHref ? (
                    <Link className="secondary-button" href={document.relatedHref}>
                      Ir relacionado
                    </Link>
                  ) : null}
                  {canManageTrash ? (
                    <button className="danger-button" type="button" onClick={() => deleteDocument(document)} disabled={deleting}>
                      Papelera
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="meta-grid">
                <div className="meta-block">
                  <span>Tipo</span>
                  {document.related_type === "event" ? "Evento" : document.related_type === "event_request" ? "Solicitud" : document.related_type}
                </div>
                <div className="meta-block">
                  <span>Relacionado</span>
                  {document.relatedTitle || document.related_id}
                </div>
                <div className="meta-block">
                  <span>Creado</span>
                  {formatDate(document.created_at.slice(0, 10))}
                </div>
              </div>
            </article>
          ))}
        </div>

        {message && <p className="form-message">{message}</p>}
      </section>
    </>
  );
}
