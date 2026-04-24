"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  documentsBucketName,
  formatDocumentFileSize,
  openStoredDocument,
  safeDocumentFileName
} from "@/features/documents/documentStorage";
import { moveDocumentToTrashById } from "@/lib/deleteRecords";
import { supabase } from "@/lib/supabase";
import type { Document } from "@/types/database";

export function EventDocuments({ eventId }: { eventId: string }) {
  const { hasRole } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canUploadDocuments = hasRole("admin_general") || hasRole("ventas") || hasRole("coordinador_evento");
  const canManageTrash = hasRole("admin_general");

  async function loadDocuments() {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("related_type", "event")
      .eq("related_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`No se pudieron cargar documentos: ${error.message}`);
      return;
    }

    setDocuments((data ?? []).filter((document) => !document.trashed_at));
  }

  useEffect(() => {
    loadDocuments();
  }, [eventId]);

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setMessage("Subiendo documento...");

    const { data: userData } = await supabase.auth.getUser();
    const filePath = `events/${eventId}/${Date.now()}-${safeDocumentFileName(selectedFile.name)}`;

    const { error: uploadError } = await supabase.storage.from(documentsBucketName).upload(filePath, selectedFile, {
      cacheControl: "3600",
      upsert: false
    });

    if (uploadError) {
      setUploading(false);
      setMessage(`No se pudo subir el archivo: ${uploadError.message}`);
      return;
    }

    const { error: documentError } = await supabase.from("documents").insert({
      related_type: "event",
      related_id: eventId,
      file_name: selectedFile.name,
      file_path: filePath,
      mime_type: selectedFile.type || null,
      file_size: selectedFile.size,
      uploaded_by: userData.user?.id ?? null
    });

    if (documentError) {
      setUploading(false);
      setMessage(`Archivo subido, pero no se pudo registrar documento: ${documentError.message}`);
      return;
    }

    setSelectedFile(null);
    setUploading(false);
    setMessage("Documento subido correctamente.");
    await loadDocuments();
  }

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
      setMessage(`No se pudo mover el archivo a papelera: ${error instanceof Error ? error.message : "Error desconocido"}`);
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelected(documentId: string) {
    setSelectedIds((current) => (current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId]));
  }

  function selectVisible() {
    setSelectedIds(documents.map((document) => document.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function deleteSelectedDocuments() {
    if (selectedIds.length === 0) return;

    const selectedDocuments = documents.filter((document) => selectedIds.includes(document.id));
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
    <section className="panel" style={{ marginTop: 14 }}>
      <div className="list-item-header">
        <div>
          <h2>Documentos</h2>
          <p className="muted">Sube contratos, comprobantes, cotizaciones firmadas, fotos o archivos operativos.</p>
        </div>
        <strong>{documents.length} archivos</strong>
      </div>

      {canUploadDocuments ? (
        <form className="edit-form" onSubmit={uploadDocument}>
          <label>
            Archivo
            <input type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
          </label>
          <button className="primary-button" disabled={!selectedFile || uploading} type="submit">
            {uploading ? "Subiendo..." : "Subir documento"}
          </button>
        </form>
      ) : null}

      {canManageTrash ? (
        <div className="button-row" style={{ marginTop: 14 }}>
          <button className="secondary-button" type="button" onClick={selectVisible} disabled={documents.length === 0}>
            Seleccionar visibles
          </button>
          <button className="secondary-button" type="button" onClick={clearSelection} disabled={selectedIds.length === 0}>
            Limpiar selección
          </button>
          <button className="danger-button" type="button" onClick={deleteSelectedDocuments} disabled={selectedIds.length === 0 || deleting}>
            {deleting ? "Moviendo..." : `Mover a papelera (${selectedIds.length})`}
          </button>
        </div>
      ) : null}

      <div className="list" style={{ marginTop: 14 }}>
        {documents.length === 0 && <p className="muted">Todavía no hay documentos asociados a este evento.</p>}
        {documents.map((document) => (
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
                {canManageTrash ? (
                  <button className="secondary-button" disabled={deleting} type="button" onClick={() => deleteDocument(document)}>
                    Papelera
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
