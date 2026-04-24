"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/features/social-sales/components/EmptyState";
import { PageIntro } from "@/features/social-sales/components/PageIntro";
import { socialChannelOptions } from "@/features/social-sales/constants/options";
import { formatCurrency, formatDate } from "@/features/social-sales/lib/format";
import { useMvpStore } from "@/features/social-sales/providers/MvpStoreProvider";
import type { Sale, SaleDraft } from "@/features/social-sales/types";

const baseSaleDraft: SaleDraft = {
  productId: "",
  channel: "Instagram",
  salePrice: 0,
  cost: 0,
  date: new Date().toISOString().slice(0, 10),
  customerName: "",
  notes: ""
};

export function SalesView() {
  const { createSale, deleteSale, products, sales, updateSale } = useMvpStore();
  const [query, setQuery] = useState("");
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const editingSale = sales.find((sale) => sale.id === editingSaleId);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const product = products.find((item) => item.id === sale.productId);
      const search = query.toLowerCase();

      return (
        sale.channel.toLowerCase().includes(search) ||
        (sale.customerName ?? "").toLowerCase().includes(search) ||
        (product?.name.toLowerCase().includes(search) ?? false)
      );
    });
  }, [products, query, sales]);

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.salePrice, 0);
  const totalMargin = sales.reduce((sum, sale) => sum + sale.margin, 0);

  return (
    <div className="mvp-page-stack">
      <PageIntro
        eyebrow="Etapa 5"
        title="Módulo de ventas"
        description="Registro manual de cierres para entender qué producto, canal y margen realmente están funcionando."
      />

      <section className="mvp-mini-metrics">
        <div className="mvp-panel-card compact">
          <p className="mvp-subtle">Ingresos registrados</p>
          <strong>{formatCurrency(totalRevenue)}</strong>
        </div>
        <div className="mvp-panel-card compact">
          <p className="mvp-subtle">Margen total</p>
          <strong>{formatCurrency(totalMargin)}</strong>
        </div>
        <div className="mvp-panel-card compact">
          <p className="mvp-subtle">Resumen simple</p>
          <strong>{sales.length} ventas</strong>
        </div>
      </section>

      <section className="mvp-two-column feature-layout">
        <article className="mvp-panel-card">
          <div className="mvp-toolbar single">
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por producto, cliente o canal" value={query} />
          </div>

          {filteredSales.length === 0 ? (
            <EmptyState title="Sin ventas" description="Carga una venta manual para empezar a medir tracción." />
          ) : (
            <div className="mvp-table-wrap">
              <table className="mvp-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Canal</th>
                    <th>Fecha</th>
                    <th>Venta</th>
                    <th>Margen</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => {
                    const product = products.find((item) => item.id === sale.productId);

                    return (
                      <tr key={sale.id}>
                        <td>
                          <strong>{product?.name ?? "Sin producto"}</strong>
                          <div className="mvp-table-subtext">{sale.customerName || "Cliente no informado"}</div>
                        </td>
                        <td>{sale.channel}</td>
                        <td>{formatDate(sale.date)}</td>
                        <td>{formatCurrency(sale.salePrice)}</td>
                        <td>{formatCurrency(sale.margin)}</td>
                        <td>
                          <div className="mvp-inline-actions">
                            <button className="mvp-inline-button" onClick={() => setEditingSaleId(sale.id)} type="button">
                              Editar
                            </button>
                            <button className="mvp-inline-button danger" onClick={() => deleteSale(sale.id)} type="button">
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

        <SaleForm
          key={editingSale?.id ?? "new-sale"}
          initialValue={editingSale ? mapSaleToDraft(editingSale) : { ...baseSaleDraft, productId: products[0]?.id ?? "" }}
          onCancel={() => setEditingSaleId(null)}
          onSubmit={(draft) => {
            if (editingSale) {
              updateSale(editingSale.id, draft);
            } else {
              createSale(draft);
            }

            setEditingSaleId(null);
          }}
          products={products.map((product) => ({ id: product.id, name: product.name, cost: product.cost }))}
          title={editingSale ? "Editar venta" : "Registrar venta"}
        />
      </section>
    </div>
  );
}

function SaleForm({
  initialValue,
  onCancel,
  onSubmit,
  products,
  title
}: {
  initialValue: SaleDraft;
  onCancel: () => void;
  onSubmit: (draft: SaleDraft) => void;
  products: { id: string; name: string; cost: number }[];
  title: string;
}) {
  const [form, setForm] = useState<SaleDraft>(initialValue);

  function patch<K extends keyof SaleDraft>(key: K, value: SaleDraft[K]) {
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
          Producto
          <select
            onChange={(event) => {
              const selected = products.find((product) => product.id === event.target.value);
              setForm((current) => ({
                ...current,
                productId: event.target.value,
                cost: selected?.cost ?? current.cost
              }));
            }}
            required
            value={form.productId}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mvp-form-grid">
          <label>
            Canal
            <select onChange={(event) => patch("channel", event.target.value as SaleDraft["channel"])} value={form.channel}>
              {socialChannelOptions.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha
            <input onChange={(event) => patch("date", event.target.value)} required type="date" value={form.date} />
          </label>
          <label>
            Precio de venta
            <input min={0} onChange={(event) => patch("salePrice", Number(event.target.value))} required type="number" value={form.salePrice} />
          </label>
          <label>
            Costo
            <input min={0} onChange={(event) => patch("cost", Number(event.target.value))} required type="number" value={form.cost} />
          </label>
        </div>
        <label>
          Nombre del cliente
          <input onChange={(event) => patch("customerName", event.target.value)} placeholder="Opcional" value={form.customerName ?? ""} />
        </label>
        <label>
          Observaciones
          <textarea onChange={(event) => patch("notes", event.target.value)} rows={4} value={form.notes ?? ""} />
        </label>
        <div className="mvp-summary-strip">
          <span>Margen calculado al guardar: {formatCurrency(form.salePrice - form.cost)}</span>
        </div>
        <div className="mvp-actions">
          <button className="mvp-primary-button" type="submit">
            Guardar venta
          </button>
          <button className="mvp-secondary-button" onClick={onCancel} type="button">
            Limpiar
          </button>
        </div>
      </form>
    </article>
  );
}

function mapSaleToDraft(sale: Sale): SaleDraft {
  return {
    productId: sale.productId,
    channel: sale.channel,
    salePrice: sale.salePrice,
    cost: sale.cost,
    date: sale.date,
    customerName: sale.customerName ?? "",
    notes: sale.notes ?? ""
  };
}
