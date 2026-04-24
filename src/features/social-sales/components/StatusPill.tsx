import { leadStatusOptions, productStatusOptions, riskLevelOptions } from "@/features/social-sales/constants/options";
import type { LeadStatus, ProductStatus, RiskLevel } from "@/features/social-sales/types";

const labelEntries: Array<[ProductStatus | LeadStatus | RiskLevel, string]> = [
  ...productStatusOptions.map((item) => [item.value, item.label] as [ProductStatus | LeadStatus | RiskLevel, string]),
  ...leadStatusOptions.map((item) => [item.value, item.label] as [ProductStatus | LeadStatus | RiskLevel, string]),
  ...riskLevelOptions.map((item) => [item.value, item.label] as [ProductStatus | LeadStatus | RiskLevel, string])
];

const labelMap = new Map<ProductStatus | LeadStatus | RiskLevel, string>(labelEntries);

export function StatusPill({ tone, value }: { tone?: "neutral" | "success" | "warning" | "danger"; value: ProductStatus | LeadStatus | RiskLevel }) {
  const resolvedTone = tone ?? inferTone(value);
  return <span className={`mvp-pill ${resolvedTone}`}>{labelMap.get(value) ?? value}</span>;
}

function inferTone(value: string) {
  if (value === "publicado" || value === "aprobado" || value === "cerrado" || value === "bajo") {
    return "success";
  }

  if (value === "en_evaluacion" || value === "seguimiento" || value === "interesado" || value === "medio") {
    return "warning";
  }

  if (value === "descartado" || value === "perdido" || value === "alto") {
    return "danger";
  }

  return "neutral";
}
