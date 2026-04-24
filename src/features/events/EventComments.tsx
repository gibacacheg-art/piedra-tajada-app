"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Comment } from "@/types/database";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function EventComments({ eventId, readOnly = false }: { eventId: string; readOnly?: boolean }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");

  async function loadComments() {
    const { data, error } = await supabase
      .from("comments")
      .select("*, profiles!comments_author_id_fkey(full_name)")
      .eq("related_type", "event")
      .eq("related_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`No se pudo cargar bitácora: ${error.message}`);
      return;
    }

    setComments((data ?? []) as Comment[]);
  }

  useEffect(() => {
    loadComments();
  }, [eventId]);

  async function addComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = body.trim();
    if (!text) return;

    setMessage("Guardando comentario...");
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("comments").insert({
      related_type: "event",
      related_id: eventId,
      author_id: userData.user?.id ?? null,
      body: text,
      is_internal: true
    });

    if (error) {
      setMessage(`No se pudo guardar comentario: ${error.message}`);
      return;
    }

    setBody("");
    setMessage("");
    await loadComments();
  }

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <div className="list-item-header">
        <div>
          <h2>Bitácora interna</h2>
          <p className="muted">
            {readOnly ? "Consulta decisiones, acuerdos, cambios y observaciones del equipo." : "Registra decisiones, acuerdos, cambios y observaciones del equipo."}
          </p>
        </div>
        <strong>{comments.length} notas</strong>
      </div>

      {!readOnly ? (
        <form className="edit-form" onSubmit={addComment}>
          <label>
            Nuevo comentario interno
            <textarea
              required
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Ej: Cliente confirma piscina hasta las 18:00. Alimentación queda pendiente de menú final."
            />
          </label>
          <button className="primary-button" type="submit">
            Agregar a bitácora
          </button>
        </form>
      ) : null}

      <div className="list" style={{ marginTop: 14 }}>
        {comments.length === 0 && <p className="muted">Todavía no hay comentarios internos para este evento.</p>}
        {comments.map((comment) => (
          <article className="list-item" key={comment.id}>
            <div className="list-item-header">
              <strong>{comment.profiles?.full_name ?? "Usuario"}</strong>
              <span className="muted">{formatDateTime(comment.created_at)}</span>
            </div>
            <p>{comment.body}</p>
          </article>
        ))}
      </div>
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
