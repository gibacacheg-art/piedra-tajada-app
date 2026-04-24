"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Department, Profile, Task } from "@/types/database";

const priorities = [
  { value: "low", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" }
];

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  blocked: "Bloqueada",
  done: "Completada",
  cancelled: "Cancelada"
};

export function EventTasks({ eventId }: { eventId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    department_id: "",
    due_date: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    requires_acknowledgement: false
  });

  const metrics = useMemo(() => {
    const done = tasks.filter((task) => task.status === "done").length;
    return { done, total: tasks.length };
  }, [tasks]);

  async function loadTasks() {
    const { data, error } = await supabase
      .from("tasks")
      .select("*, profiles!tasks_assigned_to_fkey(full_name), departments(name)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`No se pudieron cargar tareas: ${error.message}`);
      return;
    }

    setTasks((data ?? []) as Task[]);
  }

  async function loadOptions() {
    const [profilesResponse, departmentsResponse] = await Promise.all([
      supabase.from("profiles").select("*").eq("is_active", true).order("full_name"),
      supabase.from("departments").select("*").order("name")
    ]);

    setProfiles(profilesResponse.data ?? []);
    setDepartments(departmentsResponse.data ?? []);
  }

  useEffect(() => {
    loadTasks();
    loadOptions();
  }, [eventId]);

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Creando tarea...");

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("tasks").insert({
      event_id: eventId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: form.assigned_to || null,
      department_id: form.department_id || null,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      priority: form.priority,
      status: "pending",
      requires_acknowledgement: form.requires_acknowledgement,
      created_by: userData.user?.id ?? null
    });

    if (error) {
      setMessage(`No se pudo crear la tarea: ${error.message}`);
      return;
    }

    setForm({
      title: "",
      description: "",
      assigned_to: "",
      department_id: "",
      due_date: "",
      priority: "normal",
      requires_acknowledgement: false
    });
    setMessage("");
    await loadTasks();
  }

  async function updateStatus(task: Task, status: string) {
    const { error } = await supabase
      .from("tasks")
      .update({
        status,
        completed_at: status === "done" ? new Date().toISOString() : null
      })
      .eq("id", task.id);

    if (error) {
      setMessage(`No se pudo actualizar la tarea: ${error.message}`);
      return;
    }

    setMessage("");
    await loadTasks();
  }

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <div className="list-item-header">
        <div>
          <h2>Tareas del evento</h2>
          <p className="muted">Coordina pendientes por responsable, área, prioridad y vencimiento.</p>
        </div>
        <strong>
          {metrics.done}/{metrics.total} completadas
        </strong>
      </div>

      <form className="edit-form" onSubmit={createTask}>
        <div className="form-grid-2">
          <label>
            Tarea
            <input
              required
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ej: Confirmar menú, preparar tinaja..."
            />
          </label>
          <label>
            Prioridad
            <select
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as typeof form.priority }))}
            >
              {priorities.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Descripción
          <textarea
            rows={2}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Detalle operativo, instrucciones o acuerdos"
          />
        </label>

        <div className="form-grid-2">
          <label>
            Responsable
            <select value={form.assigned_to} onChange={(event) => setForm((current) => ({ ...current, assigned_to: event.target.value }))}>
              <option value="">Sin responsable</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Área
            <select value={form.department_id} onChange={(event) => setForm((current) => ({ ...current, department_id: event.target.value }))}>
              <option value="">Sin área</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid-2">
          <label>
            Fecha límite
            <input
              type="datetime-local"
              value={form.due_date}
              onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
            />
          </label>
          <label className="checkbox-option">
            <input
              checked={form.requires_acknowledgement}
              type="checkbox"
              onChange={(event) => setForm((current) => ({ ...current, requires_acknowledgement: event.target.checked }))}
            />
            Requiere confirmación del responsable
          </label>
        </div>

        <button className="primary-button" type="submit">
          Crear tarea
        </button>
      </form>

      <div className="list" style={{ marginTop: 14 }}>
        {tasks.length === 0 && <p className="muted">Todavía no hay tareas para este evento.</p>}
        {tasks.map((task) => (
          <article className="list-item" key={task.id}>
            <div className="list-item-header">
              <div>
                <h3>{task.title}</h3>
                <p className="muted">
                  {statusLabels[task.status] ?? task.status} · prioridad {task.priority}
                  {task.due_date ? ` · vence ${formatDate(task.due_date.slice(0, 10))}` : ""}
                </p>
              </div>
              <select value={task.status} onChange={(event) => updateStatus(task, event.target.value)}>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {task.description && <p>{task.description}</p>}
            <div className="meta-grid">
              <div className="meta-block">
                <span>Responsable</span>
                {task.profiles?.full_name ?? "Sin responsable"}
              </div>
              <div className="meta-block">
                <span>Área</span>
                {task.departments?.name ?? "Sin área"}
              </div>
              <div className="meta-block">
                <span>Confirmación</span>
                {task.requires_acknowledgement ? "Requerida" : "No requerida"}
              </div>
              <div className="meta-block">
                <span>Completada</span>
                {task.completed_at ? "Sí" : "No"}
              </div>
            </div>
          </article>
        ))}
      </div>
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
