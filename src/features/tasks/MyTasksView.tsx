"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase";
import type { Task } from "@/types/database";

type TaskWithEvent = Task & {
  events?: {
    id: string;
    event_name: string;
    event_date: string;
  } | null;
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  blocked: "Bloqueada",
  done: "Completada",
  cancelled: "Cancelada"
};

const priorityLabels: Record<string, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente"
};

function formatDateTime(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function MyTasksView() {
  const [tasks, setTasks] = useState<TaskWithEvent[]>([]);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");

  async function loadTasks() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      setMessage("No se pudo identificar el usuario.");
      return;
    }

    const { data, error } = await supabase
      .from("tasks")
      .select("*, events(id, event_name, event_date)")
      .eq("assigned_to", userId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`No se pudieron cargar tus tareas: ${error.message}`);
      return;
    }

    setTasks((data ?? []) as TaskWithEvent[]);
    setMessage("");
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function updateStatus(taskId: string, status: string) {
    const { error } = await supabase
      .from("tasks")
      .update({
        status,
        completed_at: status === "done" ? new Date().toISOString() : null
      })
      .eq("id", taskId);

    if (error) {
      setMessage(`No se pudo actualizar tarea: ${error.message}`);
      return;
    }

    await loadTasks();
  }

  const filteredTasks = useMemo(
    () => tasks.filter((task) => (filter === "all" ? true : task.status === filter)),
    [filter, tasks]
  );

  function getTaskAlert(task: TaskWithEvent) {
    if (task.status === "blocked") {
      return { tone: "alert", text: "Bloqueada" };
    }

    if (task.priority === "urgent") {
      return { tone: "alert", text: "Urgente" };
    }

    if (task.due_date && task.status !== "done" && task.status !== "cancelled") {
      const due = new Date(task.due_date).getTime();
      const now = Date.now();

      if (due < now) {
        return { tone: "alert", text: "Vencida" };
      }

      if (due - now <= 1000 * 60 * 60 * 24) {
        return { tone: "warning", text: "Vence pronto" };
      }
    }

    return null;
  }

  return (
    <>
      <PageHeader
        eyebrow="Trabajo personal"
        title="Mis tareas"
        description="Consulta todo lo que está asignado a tu usuario y actualiza su avance rápidamente."
      />

      <section className="panel">
        <div className="toolbar">
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Todas</option>
            <option value="pending">Pendientes</option>
            <option value="in_progress">En progreso</option>
            <option value="blocked">Bloqueadas</option>
            <option value="done">Completadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>

        <div className="list" style={{ marginTop: 14 }}>
          {filteredTasks.length === 0 && <p className="muted">No tienes tareas en este filtro.</p>}
          {filteredTasks.map((task) => {
            const alert = getTaskAlert(task);

            return (
              <article className={`list-item${alert?.tone === "alert" ? " is-alert" : alert?.tone === "warning" ? " is-warning" : ""}`} key={task.id}>
                <div className="list-item-header">
                  <div>
                    <h3>{task.title}</h3>
                    <p className="muted">
                      {statusLabels[task.status] ?? task.status} · prioridad {priorityLabels[task.priority] ?? task.priority}
                    </p>
                  </div>
                  <div className="button-row">
                    {alert ? <span className={`alert-pill ${alert.tone}`}>{alert.text}</span> : null}
                    {task.status !== "in_progress" && task.status !== "done" && (
                      <button className="secondary-button" type="button" onClick={() => updateStatus(task.id, "in_progress")}>
                        En progreso
                      </button>
                    )}
                    {task.status !== "done" && (
                      <button className="primary-button" type="button" onClick={() => updateStatus(task.id, "done")}>
                        Completar
                      </button>
                    )}
                  </div>
                </div>

                {task.description && <p>{task.description}</p>}

                <div className="meta-grid">
                  <div className="meta-block">
                    <span>Evento</span>
                    {task.events ? <Link href={`/events/${task.events.id}`}>{task.events.event_name}</Link> : "Sin evento"}
                  </div>
                  <div className="meta-block">
                    <span>Fecha límite</span>
                    {formatDateTime(task.due_date)}
                  </div>
                  <div className="meta-block">
                    <span>Confirmación</span>
                    {task.requires_acknowledgement ? "Requerida" : "No requerida"}
                  </div>
                  <div className="meta-block">
                    <span>Completada</span>
                    {task.completed_at ? formatDateTime(task.completed_at) : "No"}
                  </div>
                </div>

              </article>
            );
          })}
        </div>

        {message && <p className="form-message">{message}</p>}
      </section>
    </>
  );
}
