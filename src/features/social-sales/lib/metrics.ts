import { formatCurrency } from "@/features/social-sales/lib/format";
import type { DashboardMetric, Lead, Product, Sale } from "@/features/social-sales/types";

export function buildDashboardMetrics(products: Product[], leads: Lead[], sales: Sale[]): DashboardMetric[] {
  const approvedProducts = products.filter((product) => product.status === "aprobado").length;
  const publishedProducts = products.filter((product) => product.status === "publicado").length;
  const totalMargin = sales.reduce((sum, sale) => sum + sale.margin, 0);
  const averageMargin =
    sales.length > 0 ? formatCurrency(Math.round(totalMargin / sales.length)) : formatCurrency(0);

  return [
    { label: "Total productos", value: String(products.length), helper: "Base actual del catálogo interno" },
    { label: "Productos aprobados", value: String(approvedProducts), helper: "Listos para preparar oferta" },
    { label: "Productos publicados", value: String(publishedProducts), helper: "Ya activos en redes" },
    { label: "Leads registrados", value: String(leads.length), helper: "Interesados acumulados" },
    { label: "Ventas registradas", value: String(sales.length), helper: "Cierres manuales del MVP" },
    { label: "Margen promedio", value: averageMargin, helper: "Ganancia promedio por venta" }
  ];
}

export function getHighlightedProducts(products: Product[]) {
  return [...products]
    .sort((a, b) => b.evaluation.finalScore - a.evaluation.finalScore)
    .slice(0, 3);
}

export function getRecentLeads(leads: Lead[]) {
  return [...leads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
}

export function getRecentSales(sales: Sale[]) {
  return [...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
}
