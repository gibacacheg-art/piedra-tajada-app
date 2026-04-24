"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { QuoteItem } from "@/types/database";

const serviceOptions = [
  "Salón de eventos",
  "Piscina",
  "Tinaja",
  "Juegos inflables",
  "Arriendo de taca taca",
  "Arriendo de ranita",
  "Servicio de alimentación",
  "Adornos y decoración",
  "Otros servicios"
];

const companyInfo = {
  legalName: "Sociedad Piedra Tajada SpA",
  phone: "+56995442652",
  email: "soc.piedratajada@gmail.com"
};

type QuoteClient = {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
};

type QuoteContext = {
  eventName?: string | null;
  eventDate?: string | null;
  guestCount?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  quotedAt?: string | null;
  quoteReference?: string | null;
};

function calculateVatBreakdown(grossTotal: number) {
  const net = Math.round((grossTotal / 1.19) * 100) / 100;
  const vat = Math.round((grossTotal - net) * 100) / 100;
  return { net, vat, gross: grossTotal };
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDisplayDate(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-CL").format(parsed);
}

function buildQuoteNumber(ownerId?: string | null, quotedAt?: string | null) {
  const year = new Date().getFullYear();
  const source = (ownerId ?? "00000000").replaceAll("-", "").slice(-6).toUpperCase();
  const dayStamp = (quotedAt ?? new Intl.DateTimeFormat("sv-SE").format(new Date())).replaceAll("-", "");
  return `COT-${year}-${dayStamp}-${source}`;
}

function buildQuoteHtml({
  items,
  total,
  quoteTitle,
  client,
  context
}: {
  items: QuoteItem[];
  total: number;
  quoteTitle: string;
  client: QuoteClient;
  context?: QuoteContext;
}) {
  const { net, vat, gross } = calculateVatBreakdown(total);
  const quoteDate = context?.quotedAt ?? new Intl.DateTimeFormat("es-CL").format(new Date());
  const quoteNumber = buildQuoteNumber(context?.quoteReference ?? null, context?.quotedAt ?? null);
  const rows = items
    .map(
      (item) => `
        <tr>
          <td class="service-cell">${escapeHtml(item.service_name)}</td>
          <td>${escapeHtml(item.description || "-")}</td>
          <td class="align-right">${escapeHtml(item.quantity)}</td>
          <td class="align-right">${formatCurrency(item.unit_price)}</td>
          <td class="align-right">${formatCurrency(item.total_amount)}</td>
        </tr>
      `
    )
    .join("");

  const clientLines = [
    client.fullName ? `<p><strong>Cliente:</strong> ${escapeHtml(client.fullName)}</p>` : "",
    client.companyName ? `<p><strong>Empresa / razón social:</strong> ${escapeHtml(client.companyName)}</p>` : "",
    client.phone ? `<p><strong>Teléfono:</strong> ${escapeHtml(client.phone)}</p>` : "",
    client.email ? `<p><strong>Email:</strong> ${escapeHtml(client.email)}</p>` : ""
  ]
    .filter(Boolean)
    .join("");

  const eventLines = [
    context?.eventName ? `<p><strong>Nombre del evento:</strong> ${escapeHtml(context.eventName)}</p>` : "",
    context?.eventDate ? `<p><strong>Fecha del evento:</strong> ${escapeHtml(formatDisplayDate(context.eventDate))}</p>` : "",
    context?.guestCount ? `<p><strong>Número de personas:</strong> ${escapeHtml(context.guestCount)}</p>` : "",
    context?.startTime || context?.endTime
      ? `<p><strong>Horario:</strong> ${escapeHtml(context?.startTime ? String(context.startTime).slice(0, 5) : "--:--")} - ${escapeHtml(
          context?.endTime ? String(context.endTime).slice(0, 5) : "--:--"
        )}</p>`
      : "",
    `<p><strong>Fecha de cotización:</strong> ${escapeHtml(quoteDate)}</p>`
  ]
    .filter(Boolean)
    .join("");

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(quoteTitle)}</title>
        <style>
          @page { size: Letter portrait; margin: 12mm; }
          body { color: #17211d; font-family: Arial, sans-serif; margin: 0; background: #f2f5f8; }
          .sheet { width: 100%; max-width: 7.5in; min-height: 10in; margin: 0 auto; background: #ffffff; padding: 0.45in; }
          .document-header { display: flex; justify-content: space-between; gap: 18px; align-items: start; margin-bottom: 24px; padding-bottom: 18px; border-bottom: 2px solid #dbe7f3; }
          .brand-title { margin: 0; color: #0e2a47; font-size: 28px; line-height: 1.05; }
          .brand-copy { margin: 6px 0 0; color: #45607a; font-size: 14px; }
          .quote-meta { min-width: 220px; border: 1px solid #d8e0dc; border-radius: 8px; background: #f8fbff; padding: 14px 16px; }
          .quote-meta p { margin: 6px 0; }
          .header { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start; }
          h1 { margin-bottom: 6px; text-align: center; }
          h2 { font-size: 15px; margin: 0 0 10px; }
          p { color: #52615a; margin: 4px 0; }
          .quote-subtitle { margin: 0; color: #40566f; font-size: 14px; font-weight: 700; }
          .card { border: 1px solid #d8e0dc; border-radius: 8px; background: #fbfdfc; padding: 16px; }
          table { border-collapse: collapse; margin-top: 24px; width: 100%; }
          th, td { border-bottom: 1px solid #d8e0dc; padding: 10px; text-align: left; }
          th { background: #eef4f1; font-size: 12px; text-transform: uppercase; letter-spacing: 0.02em; }
          .align-right { text-align: right; white-space: nowrap; }
          .service-cell { width: 24%; font-weight: 700; color: #163453; }
          .totals { width: 320px; margin-left: auto; margin-top: 24px; }
          .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #d8e0dc; }
          .totals-row strong { color: #17211d; }
          .total { font-size: 20px; font-weight: 800; margin-top: 8px; text-align: right; }
          .terms { display: grid; gap: 6px; margin-top: 28px; border-top: 1px solid #d8e0dc; padding-top: 16px; }
          .terms h3 { margin: 0 0 4px; font-size: 14px; color: #163453; }
          .terms p { margin: 0; font-size: 13px; }
          .footer { margin-top: 20px; font-size: 13px; }
          .toolbar { display: flex; justify-content: flex-end; margin: 18px auto 0; width: 100%; max-width: 7.5in; }
          @media (max-width: 900px) { .sheet { padding: 24px; } .document-header, .header { grid-template-columns: 1fr; display: grid; } .totals { width: 100%; } .quote-meta { min-width: 0; } }
          @media print { button { display: none; } body { background: #ffffff; } .toolbar { display: none; } .sheet { max-width: none; min-height: auto; padding: 0; } }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <button onclick="window.print()">Guardar como PDF</button>
        </div>
        <main class="sheet">
          <section class="document-header">
            <div>
              <h1 class="brand-title">Centro de Eventos Piedra Tajada</h1>
              <p class="brand-copy">Cotización comercial para reserva de evento y servicios asociados.</p>
            </div>
            <aside class="quote-meta">
              <p><strong>N° cotización:</strong> ${escapeHtml(quoteNumber)}</p>
              <p><strong>Fecha de emisión:</strong> ${escapeHtml(quoteDate)}</p>
              <p class="quote-subtitle">${escapeHtml(quoteTitle)}</p>
            </aside>
          </section>
          <div class="header">
            <section class="card">
              <h2>Datos del cliente</h2>
              ${clientLines || `<p>Cliente por definir.</p>`}
            </section>
            <section class="card">
              <h2>Datos del evento</h2>
              ${eventLines}
            </section>
            <section class="card">
              <h2>Datos de la empresa</h2>
              <p><strong>Nombre comercial:</strong> Centro de Eventos Piedra Tajada</p>
              <p><strong>Razón social:</strong> ${escapeHtml(companyInfo.legalName)}</p>
            </section>
          </div>
          <table>
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Detalle</th>
                <th>Cantidad</th>
                <th>Valor unitario c/IVA</th>
                <th>Total c/IVA</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="5">Sin servicios valorizados.</td></tr>`}</tbody>
          </table>
          <section class="totals">
            <div class="totals-row"><span>Neto</span><strong>${formatCurrency(net)}</strong></div>
            <div class="totals-row"><span>IVA 19%</span><strong>${formatCurrency(vat)}</strong></div>
            <p class="total">Total con IVA: ${formatCurrency(gross)}</p>
          </section>
          <section class="terms">
            <h3>Condiciones comerciales</h3>
            <p>La presente cotización está sujeta a disponibilidad de fecha, espacios y servicios al momento de la confirmación.</p>
            <p>Los valores informados consideran IVA incluido. La reserva se considera válida una vez confirmado el evento y registrado el abono acordado.</p>
            <p>Los ajustes de servicios, cantidades o condiciones económicas pueden generar una nueva cotización actualizada.</p>
          </section>
          <p class="footer">Contacto comercial: ${escapeHtml(companyInfo.phone)} · ${escapeHtml(companyInfo.email)} · ${escapeHtml(companyInfo.legalName)}</p>
        </main>
      </body>
    </html>
  `;
}

export function RequestQuoteItems({
  requestId,
  eventId,
  quoteTitle = "Cotización Piedra Tajada SpA",
  client,
  context,
  onTotalChange
}: {
  requestId?: string;
  eventId?: string;
  quoteTitle?: string;
  client?: QuoteClient;
  context?: QuoteContext;
  onTotalChange?: (total: number) => void;
}) {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    service_name: "Salón de eventos",
    description: "",
    quantity: "1",
    unit_price: ""
  });

  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.total_amount || 0), 0), [items]);
  const totalsBreakdown = useMemo(() => calculateVatBreakdown(total), [total]);

  async function loadItems() {
    const query = supabase.from("quote_items").select("*").order("sort_order");
    const { data, error } = eventId ? await query.eq("event_id", eventId) : await query.eq("request_id", requestId ?? "");

    if (error) {
      setMessage(`No se pudo cargar la cotización: ${error.message}`);
      return;
    }

    const nextItems = data ?? [];
    setItems(nextItems);
    onTotalChange?.(nextItems.reduce((sum, item) => sum + Number(item.total_amount || 0), 0));
  }

  useEffect(() => {
    loadItems();
  }, [requestId, eventId]);

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Agregando servicio...");

    const { error } = await supabase.from("quote_items").insert({
      request_id: requestId ?? null,
      event_id: eventId ?? null,
      service_name: form.service_name,
      description: form.description.trim() || null,
      quantity: Number(form.quantity || 1),
      unit_price: Number(form.unit_price || 0),
      sort_order: items.length + 1
    });

    if (error) {
      setMessage(`No se pudo agregar: ${error.message}`);
      return;
    }

    setForm({ service_name: "Salón de eventos", description: "", quantity: "1", unit_price: "" });
    setMessage("");
    await loadItems();
  }

  async function deleteItem(id: string) {
    setMessage("Eliminando servicio...");
    const { error } = await supabase.from("quote_items").delete().eq("id", id);

    if (error) {
      setMessage(`No se pudo eliminar: ${error.message}`);
      return;
    }

    setMessage("");
    await loadItems();
  }

  async function saveQuoteDocument(html: string) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const fileName = `${quoteTitle.replace(/[^a-zA-Z0-9_-]/g, "-")}-${new Date().toISOString().slice(0, 10)}.html`;
    const ownerType = eventId ? "events" : "requests";
    const ownerId = eventId ?? requestId;
    const filePath = `quotes/${ownerType}/${ownerId}/${Date.now()}-${fileName}`;
    const { data: userData } = await supabase.auth.getUser();

    const { error: uploadError } = await supabase.storage.from("event-documents").upload(filePath, blob, {
      cacheControl: "3600",
      contentType: "text/html;charset=utf-8",
      upsert: false
    });

    if (uploadError) {
      setMessage(`No se pudo guardar la cotización como documento: ${uploadError.message}`);
      return false;
    }

    const { error: documentError } = await supabase.from("documents").insert({
      related_type: eventId ? "event" : "event_request",
      related_id: ownerId ?? "",
      file_name: fileName,
      file_path: filePath,
      mime_type: "text/html",
      file_size: blob.size,
      uploaded_by: userData.user?.id ?? null
    });

    if (documentError) {
      setMessage(`Cotización subida, pero no se pudo registrar en documentos: ${documentError.message}`);
      return false;
    }

    setMessage("Cotización guardada en documentos.");
    return true;
  }

  function buildCurrentQuoteHtml() {
    return buildQuoteHtml({
      items,
      total,
      quoteTitle,
      client: client ?? { fullName: "Cliente" },
      context
    });
  }

  async function saveCurrentQuote() {
    const html = buildCurrentQuoteHtml();
    await saveQuoteDocument(html);
  }

  async function openPrintableQuote() {
    const html = buildCurrentQuoteHtml();
    const saved = await saveQuoteDocument(html);

    if (!saved) {
      return;
    }

    const popup = window.open("", "_blank", "width=900,height=700");

    if (!popup) {
      setMessage("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para descargar la cotización.");
      return;
    }

    popup.document.write(html);
    popup.document.close();
    popup.focus();
  }

  return (
    <section className="panel">
      <div className="list-item-header">
        <div>
          <h2>Cotización por servicios</h2>
          <p className="muted">Agrega cantidad y valor a cada servicio solicitado.</p>
        </div>
        <div>
          <strong>{formatCurrency(totalsBreakdown.gross)}</strong>
          <p className="muted">
            Neto {formatCurrency(totalsBreakdown.net)} · IVA {formatCurrency(totalsBreakdown.vat)}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button className="secondary-button" type="button" onClick={saveCurrentQuote}>
              Guardar cotización
            </button>
            <button className="secondary-button" type="button" onClick={openPrintableQuote}>
              Guardar PDF
            </button>
          </div>
        </div>
      </div>

      <form className="edit-form" onSubmit={addItem}>
        <div className="form-grid-2">
          <label>
            Servicio
            <select value={form.service_name} onChange={(event) => setForm((current) => ({ ...current, service_name: event.target.value }))}>
              {serviceOptions.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </label>
          <label>
            Detalle
            <input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Ej: 4 horas, menú adulto, temática..."
            />
          </label>
        </div>
        <div className="form-grid-2">
          <label>
            Cantidad
            <input
              min={0.01}
              required
              step={0.01}
              type="number"
              value={form.quantity}
              onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
            />
          </label>
          <label>
            Valor unitario con IVA
            <input
              inputMode="numeric"
              min={0}
              required
              step={1}
              type="number"
              value={form.unit_price}
              onChange={(event) => setForm((current) => ({ ...current, unit_price: event.target.value }))}
            />
          </label>
        </div>
        <button className="primary-button" type="submit">
          Agregar servicio
        </button>
      </form>

      <div className="list" style={{ marginTop: 14 }}>
        {items.length === 0 && <p className="muted">Aún no hay servicios valorizados.</p>}
        {items.map((item) => (
          <article className="list-item" key={item.id}>
            <div className="list-item-header">
              <div>
                <h3>{item.service_name}</h3>
                <p className="muted">{item.description || "Sin detalle"}</p>
              </div>
              <strong>{formatCurrency(item.total_amount)}</strong>
            </div>
            <div className="meta-grid">
              <div className="meta-block">
                <span>Cantidad</span>
                {item.quantity}
              </div>
              <div className="meta-block">
                <span>Valor unitario c/IVA</span>
                {formatCurrency(item.unit_price)}
              </div>
            </div>
            <button className="secondary-button" type="button" onClick={() => deleteItem(item.id)}>
              Eliminar
            </button>
          </article>
        ))}
      </div>
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
