"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/features/social-sales/components/EmptyState";
import { PageIntro } from "@/features/social-sales/components/PageIntro";
import { StatusPill } from "@/features/social-sales/components/StatusPill";
import { productStatusOptions, riskLevelOptions } from "@/features/social-sales/constants/options";
import { formatCurrency } from "@/features/social-sales/lib/format";
import { useMvpStore } from "@/features/social-sales/providers/MvpStoreProvider";
import type { Product, ProductDraft } from "@/features/social-sales/types";

const baseProductDraft: ProductDraft = {
  name: "",
  category: "",
  supplier: "",
  cost: 0,
  suggestedPrice: 0,
  estimatedDeliveryDays: 5,
  riskLevel: "medio",
  shortDescription: "",
  status: "en_evaluacion",
  evaluation: {
    marginScore: 5,
    visualAppeal: 5,
    socialSellability: 5,
    returnRisk: 5,
    deliveryTime: 5,
    impulsePotential: 5,
    marketSaturation: 5
  }
};

export function ProductsView() {
  const { createProduct, deleteProduct, products, updateProduct } = useMvpStore();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | Product["status"]>("todos");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const editingProduct = products.find((product) => product.id === editingProductId);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesStatus = statusFilter === "todos" || product.status === statusFilter;
      const search = query.toLowerCase();
      const matchesQuery =
        product.name.toLowerCase().includes(search) ||
        product.category.toLowerCase().includes(search) ||
        product.supplier.toLowerCase().includes(search);

      return matchesStatus && matchesQuery;
    });
  }, [products, query, statusFilter]);

  return (
    <div className="mvp-page-stack">
      <PageIntro
        eyebrow="Etapa 3"
        title="Módulo de productos"
        description="Registro, evaluación comercial y priorización del catálogo antes de publicar en redes."
      />

      <section className="mvp-two-column feature-layout">
        <article className="mvp-panel-card">
          <div className="mvp-toolbar">
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, categoría o proveedor" value={query} />
            <select onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} value={statusFilter}>
              <option value="todos">Todos los estados</option>
              {productStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {filteredProducts.length === 0 ? (
            <EmptyState title="Sin productos" description="Ajusta los filtros o crea un nuevo producto para empezar." />
          ) : (
            <div className="mvp-table-wrap">
              <table className="mvp-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Estado</th>
                    <th>Margen</th>
                    <th>Score</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        <div className="mvp-table-subtext">
                          {product.category} · {product.supplier}
                        </div>
                      </td>
                      <td>
                        <StatusPill value={product.status} />
                      </td>
                      <td>{formatCurrency(product.estimatedMargin)}</td>
                      <td>{product.evaluation.finalScore}</td>
                      <td>
                        <div className="mvp-inline-actions">
                          <button className="mvp-inline-button" onClick={() => setEditingProductId(product.id)} type="button">
                            Editar
                          </button>
                          <button className="mvp-inline-button danger" onClick={() => deleteProduct(product.id)} type="button">
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <ProductForm
          key={editingProduct?.id ?? "new-product"}
          initialValue={editingProduct ? mapProductToDraft(editingProduct) : baseProductDraft}
          onCancel={() => setEditingProductId(null)}
          onSubmit={(draft) => {
            if (editingProduct) {
              updateProduct(editingProduct.id, draft);
            } else {
              createProduct(draft);
            }

            setEditingProductId(null);
          }}
          title={editingProduct ? "Editar producto" : "Nuevo producto"}
        />
      </section>
    </div>
  );
}

function ProductForm({
  initialValue,
  onCancel,
  onSubmit,
  title
}: {
  initialValue: ProductDraft;
  onCancel: () => void;
  onSubmit: (draft: ProductDraft) => void;
  title: string;
}) {
  const [form, setForm] = useState<ProductDraft>(initialValue);

  function patch<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function patchScore(key: keyof ProductDraft["evaluation"], value: number) {
    setForm((current) => ({
      ...current,
      evaluation: {
        ...current.evaluation,
        [key]: value
      }
    }));
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
        <div className="mvp-form-grid">
          <label>
            Nombre
            <input onChange={(event) => patch("name", event.target.value)} required value={form.name} />
          </label>
          <label>
            Categoría
            <input onChange={(event) => patch("category", event.target.value)} required value={form.category} />
          </label>
          <label>
            Proveedor
            <input onChange={(event) => patch("supplier", event.target.value)} required value={form.supplier} />
          </label>
          <label>
            Estado
            <select onChange={(event) => patch("status", event.target.value as ProductDraft["status"])} value={form.status}>
              {productStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Costo
            <input min={0} onChange={(event) => patch("cost", Number(event.target.value))} required type="number" value={form.cost} />
          </label>
          <label>
            Precio sugerido
            <input
              min={0}
              onChange={(event) => patch("suggestedPrice", Number(event.target.value))}
              required
              type="number"
              value={form.suggestedPrice}
            />
          </label>
          <label>
            Entrega estimada (días)
            <input
              min={1}
              onChange={(event) => patch("estimatedDeliveryDays", Number(event.target.value))}
              required
              type="number"
              value={form.estimatedDeliveryDays}
            />
          </label>
          <label>
            Riesgo
            <select onChange={(event) => patch("riskLevel", event.target.value as ProductDraft["riskLevel"])} value={form.riskLevel}>
              {riskLevelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Descripción breve
          <textarea onChange={(event) => patch("shortDescription", event.target.value)} rows={3} value={form.shortDescription} />
        </label>

        <div className="mvp-score-grid">
          <ScoreField label="Margen" onChange={(value) => patchScore("marginScore", value)} value={form.evaluation.marginScore} />
          <ScoreField label="Atractivo visual" onChange={(value) => patchScore("visualAppeal", value)} value={form.evaluation.visualAppeal} />
          <ScoreField
            label="Facilidad de venta"
            onChange={(value) => patchScore("socialSellability", value)}
            value={form.evaluation.socialSellability}
          />
          <ScoreField
            label="Riesgo de devolución"
            onChange={(value) => patchScore("returnRisk", value)}
            value={form.evaluation.returnRisk}
          />
          <ScoreField label="Tiempo de entrega" onChange={(value) => patchScore("deliveryTime", value)} value={form.evaluation.deliveryTime} />
          <ScoreField
            label="Compra impulsiva"
            onChange={(value) => patchScore("impulsePotential", value)}
            value={form.evaluation.impulsePotential}
          />
          <ScoreField
            label="Saturación aparente"
            onChange={(value) => patchScore("marketSaturation", value)}
            value={form.evaluation.marketSaturation}
          />
        </div>

        <div className="mvp-summary-strip">
          <span>Margen estimado: {formatCurrency(form.suggestedPrice - form.cost)}</span>
          <span>Veredicto se recalcula automáticamente al guardar</span>
        </div>

        <div className="mvp-actions">
          <button className="mvp-primary-button" type="submit">
            Guardar producto
          </button>
          <button className="mvp-secondary-button" onClick={onCancel} type="button">
            Limpiar
          </button>
        </div>
      </form>
    </article>
  );
}

function ScoreField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <label>
      {label}
      <input max={10} min={1} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} />
    </label>
  );
}

function mapProductToDraft(product: Product): ProductDraft {
  return {
    name: product.name,
    category: product.category,
    supplier: product.supplier,
    cost: product.cost,
    suggestedPrice: product.suggestedPrice,
    estimatedDeliveryDays: product.estimatedDeliveryDays,
    riskLevel: product.riskLevel,
    shortDescription: product.shortDescription,
    status: product.status,
    evaluation: {
      marginScore: product.evaluation.marginScore,
      visualAppeal: product.evaluation.visualAppeal,
      socialSellability: product.evaluation.socialSellability,
      returnRisk: product.evaluation.returnRisk,
      deliveryTime: product.evaluation.deliveryTime,
      impulsePotential: product.evaluation.impulsePotential,
      marketSaturation: product.evaluation.marketSaturation
    }
  };
}
