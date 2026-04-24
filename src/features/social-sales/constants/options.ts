import type { LeadStatus, ProductStatus, RiskLevel, SocialChannel } from "@/features/social-sales/types";

export const productStatusOptions: { value: ProductStatus; label: string }[] = [
  { value: "en_evaluacion", label: "En evaluación" },
  { value: "aprobado", label: "Aprobado" },
  { value: "publicado", label: "Publicado" },
  { value: "descartado", label: "Descartado" }
];

export const riskLevelOptions: { value: RiskLevel; label: string }[] = [
  { value: "bajo", label: "Bajo" },
  { value: "medio", label: "Medio" },
  { value: "alto", label: "Alto" }
];

export const leadStatusOptions: { value: LeadStatus; label: string }[] = [
  { value: "nuevo", label: "Nuevo" },
  { value: "respondio", label: "Respondió" },
  { value: "interesado", label: "Interesado" },
  { value: "seguimiento", label: "Seguimiento" },
  { value: "cerrado", label: "Cerrado" },
  { value: "perdido", label: "Perdido" }
];

export const socialChannelOptions: SocialChannel[] = ["Instagram", "Facebook", "TikTok", "WhatsApp"];

export const navigationItems = [
  { href: "/mvp", label: "Dashboard" },
  { href: "/mvp/products", label: "Productos" },
  { href: "/mvp/leads", label: "Leads" },
  { href: "/mvp/sales", label: "Ventas" },
  { href: "/mvp/content", label: "Contenido" }
];
