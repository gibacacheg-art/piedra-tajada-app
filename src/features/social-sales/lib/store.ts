"use client";

import { seedLeads, seedProducts, seedSales } from "@/features/social-sales/data/seed";
import type { CommercialEvaluation, Lead, LeadDraft, Product, ProductDraft, Sale, SaleDraft } from "@/features/social-sales/types";

const STORAGE_KEY = "social-sales-hub:v1";

export type MvpStore = {
  products: Product[];
  leads: Lead[];
  sales: Sale[];
};

export const defaultStore: MvpStore = {
  products: seedProducts,
  leads: seedLeads,
  sales: seedSales
};

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function readStore(): MvpStore {
  if (typeof window === "undefined") {
    return defaultStore;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultStore));
    return defaultStore;
  }

  try {
    return JSON.parse(stored) as MvpStore;
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultStore));
    return defaultStore;
  }
}

export function writeStore(store: MvpStore) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

function roundScore(value: number) {
  return Number(value.toFixed(1));
}

export function buildEvaluation(evaluation: ProductDraft["evaluation"]): CommercialEvaluation {
  const positiveSubtotal =
    evaluation.marginScore +
    evaluation.visualAppeal +
    evaluation.socialSellability +
    evaluation.deliveryTime +
    evaluation.impulsePotential;
  const riskPenalty = evaluation.returnRisk + evaluation.marketSaturation;
  const finalScore = roundScore((positiveSubtotal - riskPenalty + 20) / 5);

  if (finalScore >= 8) {
    return { ...evaluation, finalScore, verdict: "alto_potencial" };
  }

  if (finalScore >= 6.5) {
    return { ...evaluation, finalScore, verdict: "prometedor" };
  }

  return { ...evaluation, finalScore, verdict: "riesgoso" };
}

export function buildProduct(input: ProductDraft, existingId?: string, createdAt?: string): Product {
  const now = new Date().toISOString();
  return {
    ...input,
    id: existingId ?? createId("prod"),
    estimatedMargin: input.suggestedPrice - input.cost,
    evaluation: buildEvaluation(input.evaluation),
    createdAt: createdAt ?? now,
    updatedAt: now
  };
}

export function buildLead(input: LeadDraft, existingId?: string, createdAt?: string): Lead {
  const now = new Date().toISOString();
  return {
    ...input,
    id: existingId ?? createId("lead"),
    createdAt: createdAt ?? now,
    updatedAt: now
  };
}

export function buildSale(input: SaleDraft, existingId?: string, createdAt?: string): Sale {
  const now = new Date().toISOString();
  return {
    ...input,
    id: existingId ?? createId("sale"),
    margin: input.salePrice - input.cost,
    createdAt: createdAt ?? now,
    updatedAt: now
  };
}
