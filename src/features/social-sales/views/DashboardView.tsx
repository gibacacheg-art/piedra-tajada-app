"use client";

import { PageIntro } from "@/features/social-sales/components/PageIntro";
import { MetricCard } from "@/features/social-sales/components/MetricCard";
import { StatusPill } from "@/features/social-sales/components/StatusPill";
import { formatCurrency, formatDate, formatDateTime } from "@/features/social-sales/lib/format";
import { buildDashboardMetrics, getHighlightedProducts, getRecentLeads, getRecentSales } from "@/features/social-sales/lib/metrics";
import { useMvpStore } from "@/features/social-sales/providers/MvpStoreProvider";

export function DashboardView() {
  const { leads, products, resetDemoData, sales } = useMvpStore();
  const metrics = buildDashboardMetrics(products, leads, sales);
  const highlightedProducts = getHighlightedProducts(products);
  const recentLeads = getRecentLeads(leads);
  const recentSales = getRecentSales(sales);
  const estimatedMarginTotal = products.reduce((sum, product) => sum + product.estimatedMargin, 0);

  return (
    <div className="mvp-page-stack">
      <PageIntro
        eyebrow="Etapa 2"
        title="Dashboard operativo"
        description="Resumen de catálogo, leads y ventas para tomar decisiones rápidas sin salir del panel."
        actions={
          <button className="mvp-secondary-button" onClick={resetDemoData} type="button">
            Restablecer demo
          </button>
        }
      />

      <section className="mvp-metric-grid">
        {metrics.map((metric) => (
          <MetricCard helper={metric.helper} key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </section>

      <section className="mvp-highlight-banner">
        <div>
          <p className="mvp-kicker">Margen estimado total</p>
          <strong>{formatCurrency(estimatedMarginTotal)}</strong>
        </div>
        <p className="mvp-subtle">Suma del margen potencial de todo el catálogo cargado, útil para priorizar publicaciones.</p>
      </section>

      <section className="mvp-two-column">
        <article className="mvp-panel-card">
          <div className="mvp-section-head">
            <div>
              <p className="mvp-kicker">Productos destacados</p>
              <h3>Mejor potencial comercial</h3>
            </div>
          </div>
          <div className="mvp-list">
            {highlightedProducts.map((product) => (
              <div className="mvp-list-item" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <p className="mvp-subtle">{product.shortDescription}</p>
                </div>
                <div className="mvp-list-meta">
                  <StatusPill value={product.status} />
                  <span>Score {product.evaluation.finalScore}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="mvp-panel-card">
          <div className="mvp-section-head">
            <div>
              <p className="mvp-kicker">Leads recientes</p>
              <h3>Últimos contactos</h3>
            </div>
          </div>
          <div className="mvp-list">
            {recentLeads.map((lead) => {
              const product = products.find((item) => item.id === lead.productId);

              return (
                <div className="mvp-list-item" key={lead.id}>
                  <div>
                    <strong>{lead.name}</strong>
                    <p className="mvp-subtle">
                      {lead.sourceChannel} · {product?.name ?? "Sin producto"}
                    </p>
                  </div>
                  <div className="mvp-list-meta">
                    <StatusPill value={lead.status} />
                    <span>{formatDateTime(lead.updatedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="mvp-panel-card">
        <div className="mvp-section-head">
          <div>
            <p className="mvp-kicker">Ventas recientes</p>
            <h3>Últimos cierres manuales</h3>
          </div>
        </div>

        <div className="mvp-table-wrap">
          <table className="mvp-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Canal</th>
                <th>Fecha</th>
                <th>Venta</th>
                <th>Margen</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((sale) => {
                const product = products.find((item) => item.id === sale.productId);

                return (
                  <tr key={sale.id}>
                    <td>{product?.name ?? "Producto eliminado"}</td>
                    <td>{sale.channel}</td>
                    <td>{formatDate(sale.date)}</td>
                    <td>{formatCurrency(sale.salePrice)}</td>
                    <td>{formatCurrency(sale.margin)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
