"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase";

export function ClientCreateForm() {
  const [message, setMessage] = useState("");
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    company_name: "",
    notes: ""
  });

  async function createClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Guardando cliente...");

    const { data, error } = await supabase
      .from("clients")
      .insert({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        company_name: form.company_name.trim() || null,
        notes: form.notes.trim() || null
      })
      .select("id")
      .single();

    if (error) {
      setMessage(`No se pudo guardar el cliente: ${error.message}`);
      return;
    }

    setCreatedClientId(data.id);
    setMessage("Cliente creado correctamente.");
    setForm({ full_name: "", phone: "", email: "", company_name: "", notes: "" });
  }

  return (
    <>
      <PageHeader
        eyebrow="CRM básico"
        title="Nuevo cliente"
        description="Crea un cliente nuevo sin mezclar este formulario con el listado ni con la ficha histórica."
      />

      <section className="content-grid">
        <form className="panel" onSubmit={createClient}>
          <h2>Datos del cliente</h2>
          <label>
            Nombre completo
            <input
              required
              value={form.full_name}
              onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
              placeholder="Nombre de la persona de contacto"
            />
          </label>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="+56 9 1234 5678"
            />
          </label>
          <label>
            Correo
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="correo@ejemplo.cl"
            />
          </label>
          <label>
            Empresa
            <input
              value={form.company_name}
              onChange={(event) => setForm((current) => ({ ...current, company_name: event.target.value }))}
              placeholder="Opcional"
            />
          </label>
          <label>
            Notas
            <textarea
              rows={5}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Preferencias, contexto comercial o próximos pasos"
            />
          </label>

          <div className="button-row">
            <button className="primary-button" type="submit">
              Guardar cliente
            </button>
            <Link className="secondary-button" href="/clients">
              Volver al listado
            </Link>
            {createdClientId ? (
              <Link className="secondary-button" href={`/clients/${createdClientId}`}>
                Abrir ficha del cliente
              </Link>
            ) : null}
          </div>

          {message && <p className="form-message">{message}</p>}
        </form>

        <section className="panel">
          <h2>Qué sigue después</h2>
          <div className="dashboard-list">
            <article className="dashboard-mini-item">
              <strong>1. Crear solicitud</strong>
              <p className="muted">Una vez creado el cliente, lo ideal es registrar de inmediato su solicitud de reserva.</p>
            </article>
            <article className="dashboard-mini-item">
              <strong>2. Cotizar</strong>
              <p className="muted">Desde la solicitud podrás valorizar servicios, descargar cotización y dejar trazabilidad comercial.</p>
            </article>
            <article className="dashboard-mini-item">
              <strong>3. Convertir en evento</strong>
              <p className="muted">Cuando avance el cierre comercial, la solicitud pasa a evento y empieza la coordinación operativa.</p>
            </article>
          </div>
        </section>
      </section>
    </>
  );
}
