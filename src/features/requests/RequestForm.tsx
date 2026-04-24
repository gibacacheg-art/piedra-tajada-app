"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Client, Database } from "@/types/database";

type Space = Database["public"]["Tables"]["venues_spaces"]["Row"];

type ServiceOption = {
  label: string;
  blocksSalon?: boolean;
};

type ServicePricing = {
  amount: string;
  isFree: boolean;
};

const serviceOptions: ServiceOption[] = [
  { label: "Salón de eventos", blocksSalon: true },
  { label: "Piscina" },
  { label: "Tinaja" },
  { label: "Juegos inflables" },
  { label: "Arriendo de taca taca" },
  { label: "Arriendo de ranita" },
  { label: "Servicio de alimentación" },
  { label: "Adornos y decoración" },
  { label: "Otros servicios" }
];

const initialForm = {
  client_id: "",
  event_type: "",
  tentative_date: "",
  start_time: "19:00",
  end_time: "23:00",
  guest_count: "80",
  estimated_budget: "",
  lead_source: "",
  special_requirements: "",
  notes: ""
};

export function RequestForm({ onCreated }: { onCreated?: () => Promise<void> }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [servicePricing, setServicePricing] = useState<Record<string, ServicePricing>>({});
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadOptions() {
      const [clientsResponse, spacesResponse] = await Promise.all([
        supabase.from("clients").select("*").order("full_name", { ascending: true }),
        supabase.from("venues_spaces").select("*").eq("is_active", true).order("name", { ascending: true })
      ]);

      setClients(clientsResponse.data ?? []);
      setSpaces(spacesResponse.data ?? []);
    }

    loadOptions();
  }, []);

  const selectedServiceTotal = useMemo(() => {
    return selectedServices.reduce((sum, service) => {
      const pricing = servicePricing[service];
      if (!pricing || pricing.isFree) return sum;
      return sum + Number(pricing.amount || 0);
    }, 0);
  }, [selectedServices, servicePricing]);

  function resetForNextRequest() {
    setCreatedRequestId(null);
    setForm(initialForm);
    setSelectedServices([]);
    setServicePricing({});
    setMessage("");
  }

  function toggleService(service: string) {
    setSelectedServices((current) => {
      if (current.includes(service)) {
        setServicePricing((pricing) => {
          const next = { ...pricing };
          delete next[service];
          return next;
        });
        return current.filter((item) => item !== service);
      }

      setServicePricing((pricing) => ({
        ...pricing,
        [service]: pricing[service] ?? { amount: "", isFree: false }
      }));
      return [...current, service];
    });
  }

  function updateServicePricing(service: string, updates: Partial<ServicePricing>) {
    setServicePricing((current) => ({
      ...current,
      [service]: {
        amount: current[service]?.amount ?? "",
        isFree: current[service]?.isFree ?? false,
        ...updates
      }
    }));
  }

  async function createRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Guardando solicitud...");

    const { data: userData } = await supabase.auth.getUser();
    const salonSpace = spaces.find((space) => space.name.toLowerCase().includes("sal"));
    const shouldBlockSalon = selectedServices.includes("Salón de eventos") && salonSpace;

    const selectedServiceLines =
      selectedServices.length > 0
        ? selectedServices.map((service) => {
            const pricing = servicePricing[service];
            if (pricing?.isFree) return `- ${service}: sin costo`;
            if (pricing?.amount) return `- ${service}: ${formatCurrency(Number(pricing.amount || 0))}`;
            return `- ${service}`;
          })
        : [];

    const servicesText = selectedServiceLines.length > 0 ? `Servicios solicitados:\n${selectedServiceLines.join("\n")}` : "";
    const requirementsText = [servicesText, form.special_requirements.trim()].filter(Boolean).join("\n\n");
    const estimatedBudget = form.estimated_budget ? Number(form.estimated_budget) : selectedServiceTotal || null;

    const { data, error } = await supabase
      .from("event_requests")
      .insert({
        client_id: form.client_id,
        event_type: form.event_type.trim(),
        tentative_date: form.tentative_date,
        start_time: form.start_time,
        end_time: form.end_time,
        guest_count: Number(form.guest_count),
        requested_space_id: shouldBlockSalon ? salonSpace.id : null,
        estimated_budget: estimatedBudget,
        lead_source: form.lead_source.trim() || null,
        special_requirements: requirementsText || null,
        status: "request_received",
        notes: form.notes.trim() || null,
        created_by: userData.user?.id ?? null
      })
      .select("id")
      .single();

    if (error) {
      setMessage(`No se pudo crear la solicitud: ${error.message}`);
      return;
    }

    if (selectedServices.length > 0) {
      const quoteRows = selectedServices.map((service, index) => {
        const pricing = servicePricing[service];
        const amount = pricing?.isFree ? 0 : Number(pricing?.amount || 0);

        return {
          request_id: data.id,
          event_id: null,
          service_name: service,
          description: pricing?.isFree ? "Sin costo" : null,
          quantity: 1,
          unit_price: amount,
          sort_order: index + 1,
          created_by: userData.user?.id ?? null
        };
      });

      const { error: quoteError } = await supabase.from("quote_items").insert(quoteRows);

      if (quoteError) {
        setCreatedRequestId(data.id);
        setMessage(`Solicitud creada, pero no se pudo generar la cotización base: ${quoteError.message}`);
        if (onCreated) {
          await onCreated();
        }
        return;
      }
    }

    setCreatedRequestId(data.id);
    setMessage("Solicitud creada correctamente con cotización base.");
    if (onCreated) {
      await onCreated();
    }
  }

  return (
    <form className="panel" onSubmit={createRequest}>
      <h2>Nueva solicitud</h2>
      <label>
        Cliente
        <select
          required
          value={form.client_id}
          onChange={(event) => setForm((current) => ({ ...current, client_id: event.target.value }))}
        >
          <option value="">Selecciona un cliente</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.full_name}
              {client.company_name ? ` · ${client.company_name}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tipo de evento
        <input
          required
          value={form.event_type}
          onChange={(event) => setForm((current) => ({ ...current, event_type: event.target.value }))}
          placeholder="Matrimonio, empresa, cumpleaños..."
        />
      </label>
      <div className="form-grid-2">
        <label>
          Fecha tentativa
          <input
            required
            type="date"
            value={form.tentative_date}
            onChange={(event) => setForm((current) => ({ ...current, tentative_date: event.target.value }))}
          />
        </label>
        <label>
          Invitados
          <input
            required
            min={1}
            type="number"
            value={form.guest_count}
            onChange={(event) => setForm((current) => ({ ...current, guest_count: event.target.value }))}
          />
        </label>
      </div>
      <div className="form-grid-2">
        <label>
          Inicio
          <input
            required
            type="time"
            value={form.start_time}
            onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))}
          />
        </label>
        <label>
          Término
          <input
            required
            type="time"
            value={form.end_time}
            onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
          />
        </label>
      </div>
      <fieldset className="service-fieldset">
        <legend>Servicios solicitados</legend>
        <p className="muted">
          Marca lo que el cliente pidió y, si ya lo sabes, define el valor o déjalo marcado como sin costo. Esto crea la cotización base automáticamente.
        </p>
        <div className="checkbox-grid">
          {serviceOptions.map((service) => (
            <label className="checkbox-option" key={service.label}>
              <input checked={selectedServices.includes(service.label)} type="checkbox" onChange={() => toggleService(service.label)} />
              {service.label}
            </label>
          ))}
        </div>

        {selectedServices.length > 0 ? (
          <div className="service-pricing-list">
            {selectedServices.map((service) => {
              const pricing = servicePricing[service] ?? { amount: "", isFree: false };

              return (
                <article className="service-pricing-item" key={service}>
                  <div className="list-item-header">
                    <div>
                      <h3>{service}</h3>
                      <p className="muted">Valor inicial para la cotización de esta solicitud.</p>
                    </div>
                    <strong>{pricing.isFree ? "Sin costo" : formatCurrency(Number(pricing.amount || 0))}</strong>
                  </div>

                  <div className="form-grid-2">
                    <label>
                      Valor del servicio
                      <input
                        inputMode="numeric"
                        min={0}
                        step={1}
                        type="number"
                        disabled={pricing.isFree}
                        value={pricing.amount}
                        onChange={(event) => updateServicePricing(service, { amount: event.target.value })}
                        placeholder="0"
                      />
                    </label>
                    <label className="checkbox-option">
                      <input
                        checked={pricing.isFree}
                        type="checkbox"
                        onChange={(event) =>
                          updateServicePricing(service, {
                            isFree: event.target.checked,
                            amount: event.target.checked ? "0" : pricing.amount
                          })
                        }
                      />
                      Sin costo
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </fieldset>
      <div className="form-grid-2">
        <label>
          Presupuesto estimado
          <input
            inputMode="numeric"
            min={0}
            step={1}
            type="number"
            value={form.estimated_budget}
            onChange={(event) => setForm((current) => ({ ...current, estimated_budget: event.target.value }))}
            placeholder={selectedServiceTotal > 0 ? String(selectedServiceTotal) : "1200000"}
          />
        </label>
        <label>
          Origen
          <input
            value={form.lead_source}
            onChange={(event) => setForm((current) => ({ ...current, lead_source: event.target.value }))}
            placeholder="Instagram, referido, web..."
          />
        </label>
      </div>
      {selectedServices.length > 0 ? (
        <p className="muted" style={{ marginTop: -4 }}>
          Total base de servicios seleccionados: <strong>{formatCurrency(selectedServiceTotal)}</strong>
        </p>
      ) : null}
      <label>
        Detalle de servicios, alimentación, adornos u otros requerimientos
        <textarea
          rows={3}
          value={form.special_requirements}
          onChange={(event) => setForm((current) => ({ ...current, special_requirements: event.target.value }))}
          placeholder="Menú tentativo, tipo de decoración, horarios de piscina/tinaja, cantidad de juegos, montaje..."
        />
      </label>
      <label>
        Notas internas
        <textarea
          rows={3}
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Seguimiento comercial, acuerdos o contexto"
        />
      </label>
      <div className="button-row">
        <button className="primary-button" disabled={Boolean(createdRequestId)} type="submit">
          {createdRequestId ? "Solicitud ya creada" : "Crear solicitud"}
        </button>
        {!onCreated ? (
          <Link className="secondary-button" href="/requests">
            Volver al listado
          </Link>
        ) : null}
        {createdRequestId ? (
          <Link className="secondary-button" href={`/requests/${createdRequestId}?section=cotizacion`}>
            Editar cotización
          </Link>
        ) : null}
        {createdRequestId ? (
          <Link className="secondary-button" href={`/requests/${createdRequestId}`}>
            Ver solicitud creada
          </Link>
        ) : null}
        {createdRequestId ? (
          <button className="secondary-button" type="button" onClick={resetForNextRequest}>
            Crear otra solicitud
          </button>
        ) : null}
      </div>
      {message && <p className="form-message">{message}</p>}
    </form>
  );
}
