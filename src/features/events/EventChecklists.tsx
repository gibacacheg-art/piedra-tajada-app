"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Checklist, Department } from "@/types/database";

const templates = [
  {
    title: "Montaje salón",
    items: [
      "Mesas y sillas montadas",
      "Mantelería revisada",
      "Baños revisados",
      "Iluminación del salón probada",
      "Accesos despejados"
    ]
  },
  {
    title: "Piscina",
    items: ["Piscina limpia", "Área perimetral segura", "Reglas visibles", "Toallas o zona de apoyo preparada"]
  },
  {
    title: "Tinaja",
    items: ["Tinaja limpia", "Agua cargada", "Temperatura revisada", "Leña o energía disponible", "Zona segura y seca"]
  },
  {
    title: "Alimentación",
    items: ["Menú confirmado", "Horarios de servicio definidos", "Restricciones alimentarias revisadas", "Personal de servicio coordinado"]
  },
  {
    title: "Decoración",
    items: ["Adornos revisados", "Mesa principal montada", "Zona de fotos preparada", "Retiro de decoración coordinado"]
  },
  {
    title: "Juegos",
    items: ["Inflables instalados", "Taca taca disponible", "Ranita disponible", "Extensiones y seguridad revisadas"]
  },
  {
    title: "Cierre y limpieza",
    items: ["Retiro de basura", "Revisión de daños", "Objetos perdidos guardados", "Cierre de accesos", "Limpieza final completada"]
  }
];

export function EventChecklists({ eventId, readOnly = false }: { eventId: string; readOnly?: boolean }) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", department_id: "" });
  const [itemForms, setItemForms] = useState<Record<string, string>>({});
  const [applyingTemplates, setApplyingTemplates] = useState<string[]>([]);

  const totals = useMemo(() => {
    return checklists.reduce(
      (acc, checklist) => {
        const items = checklist.checklist_items ?? [];
        acc.total += items.length;
        acc.done += items.filter((item) => item.is_done).length;
        return acc;
      },
      { done: 0, total: 0 }
    );
  }, [checklists]);

  async function loadChecklists() {
    const { data, error } = await supabase
      .from("checklists")
      .select("*, departments(name), checklist_items(*)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(`No se pudieron cargar checklists: ${error.message}`);
      return;
    }

    setChecklists((data ?? []) as Checklist[]);
  }

  async function loadDepartments() {
    const { data } = await supabase.from("departments").select("*").order("name");
    setDepartments(data ?? []);
  }

  useEffect(() => {
    loadChecklists();
    loadDepartments();
  }, [eventId]);

  async function createChecklist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Creando checklist...");

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("checklists").insert({
      event_id: eventId,
      title: form.title.trim(),
      department_id: form.department_id || null,
      created_by: userData.user?.id ?? null
    });

    if (error) {
      setMessage(`No se pudo crear checklist: ${error.message}`);
      return;
    }

    setForm({ title: "", department_id: "" });
    setMessage("");
    await loadChecklists();
  }

  async function applyTemplate(template: (typeof templates)[number]) {
    const alreadyExists = checklists.some((checklist) => checklist.title.toLowerCase() === template.title.toLowerCase());
    const isApplying = applyingTemplates.includes(template.title);

    if (alreadyExists || isApplying) {
      setMessage(`La plantilla "${template.title}" ya está aplicada en este evento.`);
      return;
    }

    setApplyingTemplates((current) => [...current, template.title]);
    setMessage(`Creando plantilla ${template.title}...`);

    const { data: userData } = await supabase.auth.getUser();
    const { data: existingChecklist } = await supabase
      .from("checklists")
      .select("id")
      .eq("event_id", eventId)
      .ilike("title", template.title)
      .maybeSingle();

    if (existingChecklist) {
      setApplyingTemplates((current) => current.filter((title) => title !== template.title));
      setMessage(`La plantilla "${template.title}" ya está aplicada en este evento.`);
      await loadChecklists();
      return;
    }

    const { data: checklist, error } = await supabase
      .from("checklists")
      .insert({
        event_id: eventId,
        title: template.title,
        department_id: null,
        created_by: userData.user?.id ?? null
      })
      .select("id")
      .single();

    if (error) {
      setApplyingTemplates((current) => current.filter((title) => title !== template.title));
      setMessage(`No se pudo crear plantilla: ${error.message}`);
      return;
    }

    const { error: itemsError } = await supabase.from("checklist_items").insert(
      template.items.map((title, index) => ({
        checklist_id: checklist.id,
        title,
        sort_order: index + 1
      }))
    );

    if (itemsError) {
      setApplyingTemplates((current) => current.filter((title) => title !== template.title));
      setMessage(`Checklist creado, pero fallaron los ítems: ${itemsError.message}`);
      return;
    }

    setApplyingTemplates((current) => current.filter((title) => title !== template.title));
    setMessage("");
    await loadChecklists();
  }

  async function addItem(checklistId: string) {
    const title = itemForms[checklistId]?.trim();
    if (!title) return;

    const checklist = checklists.find((item) => item.id === checklistId);
    const sortOrder = (checklist?.checklist_items?.length ?? 0) + 1;

    const { error } = await supabase.from("checklist_items").insert({
      checklist_id: checklistId,
      title,
      sort_order: sortOrder
    });

    if (error) {
      setMessage(`No se pudo agregar ítem: ${error.message}`);
      return;
    }

    setItemForms((current) => ({ ...current, [checklistId]: "" }));
    setMessage("");
    await loadChecklists();
  }

  async function deleteChecklist(checklist: Checklist) {
    const shouldDelete = window.confirm(`¿Eliminar el checklist "${checklist.title}" y todos sus ítems?`);
    if (!shouldDelete) return;

    const { error } = await supabase.from("checklists").delete().eq("id", checklist.id);

    if (error) {
      setMessage(`No se pudo eliminar checklist: ${error.message}`);
      return;
    }

    setMessage("");
    await loadChecklists();
  }

  async function toggleItem(checklistId: string, itemId: string, isDone: boolean) {
    const { error } = await supabase
      .from("checklist_items")
      .update({
        is_done: !isDone,
        done_at: !isDone ? new Date().toISOString() : null
      })
      .eq("id", itemId);

    if (error) {
      setMessage(`No se pudo actualizar ítem: ${error.message}`);
      return;
    }

    setMessage("");
    await loadChecklists();
  }

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <div className="list-item-header">
        <div>
          <h2>Checklist operativo</h2>
          <p className="muted">
            {readOnly ? "Consulta el avance de montaje, servicios, cierre y preparación por área." : "Controla montaje, servicios, cierre y preparación por área."}
          </p>
        </div>
        <strong>
          {totals.done}/{totals.total} listo
        </strong>
      </div>

      {!readOnly ? (
      <div className="template-row">
        {templates.map((template) => {
          const alreadyExists = checklists.some((checklist) => checklist.title.toLowerCase() === template.title.toLowerCase());
          const isApplying = applyingTemplates.includes(template.title);

          return (
            <button
              className="secondary-button"
              disabled={alreadyExists || isApplying}
              key={template.title}
              type="button"
              onClick={() => applyTemplate(template)}
            >
              {alreadyExists ? `${template.title} aplicada` : isApplying ? `Aplicando ${template.title}` : template.title}
            </button>
          );
        })}
      </div>
      ) : null}

      {!readOnly ? (
      <form className="edit-form" onSubmit={createChecklist}>
        <div className="form-grid-2">
          <label>
            Nuevo checklist
            <input
              required
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ej: Preparación ceremonia"
            />
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
        <button className="primary-button" type="submit">
          Crear checklist
        </button>
      </form>
      ) : null}

      <div className="list" style={{ marginTop: 14 }}>
        {checklists.length === 0 && <p className="muted">Todavía no hay checklists para este evento.</p>}
        {checklists.map((checklist) => {
          const items = checklist.checklist_items ?? [];
          const done = items.filter((item) => item.is_done).length;

          return (
            <article className="list-item" key={checklist.id}>
              <div className="list-item-header">
                <div>
                  <h3>{checklist.title}</h3>
                  <p className="muted">
                    {checklist.departments?.name ?? "Sin área"} · {done}/{items.length} listo
                  </p>
                </div>
                {!readOnly ? (
                  <button className="secondary-button" type="button" onClick={() => deleteChecklist(checklist)}>
                    Eliminar checklist
                  </button>
                ) : null}
              </div>

              <div className="checklist-items">
                {items
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item) => (
                    <label className="checklist-item" key={item.id}>
                      <input checked={item.is_done} disabled={readOnly} type="checkbox" onChange={() => toggleItem(checklist.id, item.id, item.is_done)} />
                      <span>{item.title}</span>
                    </label>
                  ))}
              </div>

              {!readOnly ? (
                <div className="inline-add">
                  <input
                    value={itemForms[checklist.id] ?? ""}
                    onChange={(event) => setItemForms((current) => ({ ...current, [checklist.id]: event.target.value }))}
                    placeholder="Agregar ítem"
                  />
                  <button className="secondary-button" type="button" onClick={() => addItem(checklist.id)}>
                    Agregar
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
