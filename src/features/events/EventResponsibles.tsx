"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Database, Department, EventResponsible, Profile } from "@/types/database";

export function EventResponsibles({
  eventId,
  mainResponsibleId,
  commercialResponsibleId,
  operationsResponsibleId,
  onUpdated,
  readOnly = false
}: {
  eventId: string;
  mainResponsibleId: string | null;
  commercialResponsibleId: string | null;
  operationsResponsibleId: string | null;
  onUpdated: () => Promise<void>;
  readOnly?: boolean;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [responsibles, setResponsibles] = useState<EventResponsible[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    user_id: "",
    department_id: "",
    notes: ""
  });

  async function loadOptions() {
    const [profilesResponse, departmentsResponse, responsiblesResponse] = await Promise.all([
      supabase.from("profiles").select("*").eq("is_active", true).order("full_name"),
      supabase.from("departments").select("*").order("name"),
      supabase
        .from("event_responsibles")
        .select("*, profiles!event_responsibles_user_id_fkey(full_name), departments(name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true })
    ]);

    if (profilesResponse.error) setMessage(`No se pudieron cargar perfiles: ${profilesResponse.error.message}`);
    if (departmentsResponse.error) setMessage(`No se pudieron cargar áreas: ${departmentsResponse.error.message}`);
    if (responsiblesResponse.error) setMessage(`No se pudieron cargar responsables: ${responsiblesResponse.error.message}`);

    setProfiles(profilesResponse.data ?? []);
    setDepartments(departmentsResponse.data ?? []);
    setResponsibles((responsiblesResponse.data ?? []) as EventResponsible[]);
  }

  useEffect(() => {
    loadOptions();
  }, [eventId]);

  function profileName(id: string | null) {
    if (!id) return "Sin asignar";
    return profiles.find((profile) => profile.id === id)?.full_name ?? "Usuario";
  }

  async function updateEventResponsible(field: "main_responsible_id" | "commercial_responsible_id" | "operations_responsible_id", value: string) {
    const eventUpdate: Database["public"]["Tables"]["events"]["Update"] = {
      [field]: value || null
    };

    const { error } = await supabase.from("events").update(eventUpdate).eq("id", eventId);

    if (error) {
      setMessage(`No se pudo actualizar responsable: ${error.message}`);
      return;
    }

    setMessage("");
    await onUpdated();
  }

  async function addDepartmentResponsible(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.user_id) return;

    const { error } = await supabase.from("event_responsibles").insert({
      event_id: eventId,
      user_id: form.user_id,
      department_id: form.department_id || null,
      scope: "department",
      notes: form.notes.trim() || null
    });

    if (error) {
      setMessage(`No se pudo agregar responsable: ${error.message}`);
      return;
    }

    setForm({ user_id: "", department_id: "", notes: "" });
    setMessage("");
    await loadOptions();
  }

  async function removeResponsible(responsible: EventResponsible) {
    const shouldRemove = window.confirm(`¿Quitar a ${responsible.profiles?.full_name ?? "este usuario"} como responsable?`);
    if (!shouldRemove) return;

    const { error } = await supabase.from("event_responsibles").delete().eq("id", responsible.id);

    if (error) {
      setMessage(`No se pudo quitar responsable: ${error.message}`);
      return;
    }

    setMessage("");
    await loadOptions();
  }

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <div className="list-item-header">
        <div>
          <h2>Responsables</h2>
          <p className="muted">
            {readOnly ? "Consulta responsables principales y responsables por área de este evento." : "Define responsables principales y responsables por área para este evento."}
          </p>
        </div>
        <strong>{responsibles.length} por área</strong>
      </div>

      {!readOnly ? (
        <>
          <div className="form-grid-2">
            <label>
              Responsable principal
              <select value={mainResponsibleId ?? ""} onChange={(event) => updateEventResponsible("main_responsible_id", event.target.value)}>
                <option value="">Sin asignar</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Responsable comercial
              <select
                value={commercialResponsibleId ?? ""}
                onChange={(event) => updateEventResponsible("commercial_responsible_id", event.target.value)}
              >
                <option value="">Sin asignar</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Responsable operaciones
            <select
              value={operationsResponsibleId ?? ""}
              onChange={(event) => updateEventResponsible("operations_responsible_id", event.target.value)}
            >
              <option value="">Sin asignar</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      <div className="meta-grid" style={{ marginTop: 14 }}>
        <div className="meta-block">
          <span>Principal</span>
          {profileName(mainResponsibleId)}
        </div>
        <div className="meta-block">
          <span>Comercial</span>
          {profileName(commercialResponsibleId)}
        </div>
        <div className="meta-block">
          <span>Operaciones</span>
          {profileName(operationsResponsibleId)}
        </div>
      </div>

      {!readOnly ? (
        <form className="edit-form" style={{ marginTop: 14 }} onSubmit={addDepartmentResponsible}>
          <h3>Agregar responsable por área</h3>
          <div className="form-grid-2">
            <label>
              Usuario
              <select value={form.user_id} onChange={(event) => setForm((current) => ({ ...current, user_id: event.target.value }))}>
                <option value="">Selecciona usuario</option>
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
          <label>
            Nota
            <input
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Ej: encargado de piscina y tinaja"
            />
          </label>
          <button className="primary-button" type="submit">
            Agregar responsable
          </button>
        </form>
      ) : null}

      <div className="list" style={{ marginTop: 14 }}>
        {responsibles.length === 0 && <p className="muted">No hay responsables por área todavía.</p>}
        {responsibles.map((responsible) => (
          <article className="list-item" key={responsible.id}>
            <div className="list-item-header">
              <div>
                <h3>{responsible.profiles?.full_name ?? "Usuario"}</h3>
                <p className="muted">
                  {responsible.departments?.name ?? "Sin área"} {responsible.notes ? `· ${responsible.notes}` : ""}
                </p>
              </div>
              {!readOnly ? (
                <button className="secondary-button" type="button" onClick={() => removeResponsible(responsible)}>
                  Quitar
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
