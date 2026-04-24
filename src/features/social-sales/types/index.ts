export type ProductStatus = "en_evaluacion" | "aprobado" | "publicado" | "descartado";
export type RiskLevel = "bajo" | "medio" | "alto";
export type LeadStatus = "nuevo" | "respondio" | "interesado" | "seguimiento" | "cerrado" | "perdido";
export type SocialChannel = "Instagram" | "Facebook" | "TikTok" | "WhatsApp";

export type CommercialEvaluation = {
  marginScore: number;
  visualAppeal: number;
  socialSellability: number;
  returnRisk: number;
  deliveryTime: number;
  impulsePotential: number;
  marketSaturation: number;
  finalScore: number;
  verdict: "alto_potencial" | "prometedor" | "riesgoso";
};

export type Product = {
  id: string;
  name: string;
  category: string;
  supplier: string;
  cost: number;
  suggestedPrice: number;
  estimatedMargin: number;
  estimatedDeliveryDays: number;
  riskLevel: RiskLevel;
  shortDescription: string;
  status: ProductStatus;
  evaluation: CommercialEvaluation;
  createdAt: string;
  updatedAt: string;
};

export type Lead = {
  id: string;
  name: string;
  sourceChannel: SocialChannel;
  productId: string;
  status: LeadStatus;
  contactDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Sale = {
  id: string;
  productId: string;
  channel: SocialChannel;
  salePrice: number;
  cost: number;
  margin: number;
  date: string;
  customerName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductDraft = Omit<Product, "id" | "createdAt" | "updatedAt" | "estimatedMargin" | "evaluation"> & {
  evaluation: Omit<CommercialEvaluation, "finalScore" | "verdict">;
};

export type LeadDraft = Omit<Lead, "id" | "createdAt" | "updatedAt">;
export type SaleDraft = Omit<Sale, "id" | "createdAt" | "updatedAt" | "margin">;

export type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
};

export type GeneratedContent = {
  instagramShort: string;
  facebookLong: string;
  whatsappPromo: string;
  tiktokScript: string;
  callToAction: string;
  faq: string[];
  objections: string[];
};
