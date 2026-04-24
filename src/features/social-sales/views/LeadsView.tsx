"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/features/social-sales/components/EmptyState";
import { PageIntro } from "@/features/social-sales/components/PageIntro";
import { StatusPill } from "@/features/social-sales/components/StatusPill";
import { leadStatusOptions, socialChannelOptions } from "@/features/social-sales/constants/options";
import { formatDate } from "@/features/social-sales/lib/format";
import { useMvpStore } from "@/features/social-sales/providers/MvpStoreProvider";
import type { Lead, LeadDraft } from "@/features/social-sales/types";

const baseLeadDraft: LeadDraft = {
  name: "",
  sourceChannel: "Instagram",
  productId: "",
  status: "nuevo",
  contactDate: new Date().toISOString().slice(0, 10),
  notes: ""
};

export function LeadsView() {
  const { createLead, deleteLead, leads, products, updateLead } = useMvpStore();
  const [statusFilter, setStatusFilter] = useState<"todos" | Lead["status"]>("todos");
  const [query, setQuery] = useState("");
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const editingLead = leads.find((lead) => lead.id === editingLeadId);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const product = products.find((item) => item.id === lead.productId);
      const matchesStatus = statusFilter === "todos" || lead.status === statusFilter;
      const search = query.toLowerCase();
      const matchesQuery =
        lead.name.toLowerCase().includes(search) ||
        lead.sourceChannel.toLowerCase().includes(search) ||
        (product?.name.toLowerCase().includes(search) ?? false);

      return matchesStatus && matchesQuery;
    });
  }, [leads, products, query, statusFilter]);

  return (
    <div className="mvp-page-stack">
      <PageIntro
        eyebrow="Etapa 4"
        title="Módulo de leads"
        description="Centraliza interesados que llegan desde redes y mantén un seguimiento manual, claro y rápido."
      />

      <section className="mvp-two-column feature-layout">
        <article className="mvp-panel-card">
          <div className="mvp-toolbar">
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, canal o producto" value={query} />
            <select onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} value={statusFilter}>
              <option value="todos">Todos los estados</option>
              {leadStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {filteredLeads.length === 0 ? (
            <EmptyState title="Sin leads" description="Todavía no hay interesados cargados con esos filtros." />
          ) : (
            <div className="mvp-table-wrap">
              <table className="mvp-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Producto</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const product = products.find((item) => item.id === lead.productId);

                    return (
                      <tr key={lead.id}>
                        <td>
                          <strong>{lead.name}</strong>
                          <div className="mvp-table-subtext">{lead.sourceChannel}</div>
                        </td>
                        <td>{product?.name ?? "Sin producto"}</td>
                        <td>
                          <StatusPill value={lead.status} />
                        </td>
                        <td>{formatDate(lead.contactDate)}</td>
                        <td>
                          <div className="mvp-inline-actions">
                            <button className="mvp-inline-button" onClick={() => setEditingLeadId(lead.id)} type="button">
                              Editar
                            </button>
                            <button className="mvp-inline-button danger" onClick={() => deleteLead(lead.id)} type="button">
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <LeadForm
          key={editingLead?.id ?? "new-lead"}
          initialValue={editingLead ? mapLeadToDraft(editingLead) : { ...baseLeadDraft, productId: products[0]?.id ?? "" }}
          onCancel={() => setEditingLeadId(null)}
          onSubmit={(draft) => {
            if (editingLead) {
              updateLead(editingLead.id, draft);
            } else {
              createLead(draft);
            }

            setEditingLeadId(null);
          }}
          products={products.map((product) => ({ id: product.id, name: product.name }))}
          title={editingLead ? "Editar lead" : "Nuevo lead"}
        />
      </section>
    </div>
  );
}

function LeadForm({
  initialValue,
  onCancel,
  onSubmit,
  products,
  title
}: {
  initialValue: LeadDraft;
  onCancel: () => void;
  onSubmit: (draft: LeadDraft) => void;
  products: { id: string; name: string }[];
  title: string;
}) {
  const [form, setForm] = useState<LeadDraft>(initialValue);

  function patch<K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <article className="mvp-panel-card">
      <div className="mvp-section-head">
        <div>
          <p className="mvp-kicker">Formulario</p>
          <h3>{title}</h3>
        </div>
      </div>

      <form
        className="mvp-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(form);
        }}
      >
        <label>
          Nombre
          <input onChange={(event) => patch("name", event.target.value)} required value={form.name} />
        </label>
        <div className="mvp-form-grid">
          <label>
            Canal
            <select onChange={(event) => patch("sourceChannel", event.target.value as LeadDraft["sourceChannel"])} value={form.sourceChannel}>
              {socialChannelOptions.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select onChange={(event) => patch("status", event.target.value as LeadDraft["status"])} value={form.status}>
              {leadStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Producto consultado
          <select onChange={(event) => patch("productId", event.target.value)} required value={form.productId}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha de contacto
          <input onChange={(event) => patch("contactDate", event.target.value)} required type="date" value={form.contactDate} />
        </label>
        <label>
          Observaciones
          <textarea onChange={(event) => patch("notes", event.target.value)} rows={4} value={form.notes} />
        </label>
        <div className="mvp-actions">
          <button className="mvp-primary-button" type="submit">
            Guardar lead
          </button>
          <button className="mvp-secondary-button" onClick={onCancel} type="button">
            Limpiar
          </button>
        </div>
      </form>
    </article>
  );
}

function mapLeadToDraft(lead: Lead): LeadDraft {
  return {
    name: lead.name,
    sourceChannel: lead.sourceChannel,
    productId: lead.productId,
    status: lead.status,
    contactDate: lead.contactDate,
    notes: lead.notes
  };
}
