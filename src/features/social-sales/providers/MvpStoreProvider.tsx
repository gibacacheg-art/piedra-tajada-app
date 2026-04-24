"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildLead, buildProduct, buildSale, defaultStore, readStore, writeStore } from "@/features/social-sales/lib/store";
import type { Lead, LeadDraft, Product, ProductDraft, Sale, SaleDraft } from "@/features/social-sales/types";

type MvpStoreContextValue = {
  products: Product[];
  leads: Lead[];
  sales: Sale[];
  hydrated: boolean;
  createProduct: (draft: ProductDraft) => void;
  updateProduct: (id: string, draft: ProductDraft) => void;
  deleteProduct: (id: string) => void;
  createLead: (draft: LeadDraft) => void;
  updateLead: (id: string, draft: LeadDraft) => void;
  deleteLead: (id: string) => void;
  createSale: (draft: SaleDraft) => void;
  updateSale: (id: string, draft: SaleDraft) => void;
  deleteSale: (id: string) => void;
  resetDemoData: () => void;
};

const MvpStoreContext = createContext<MvpStoreContextValue | null>(null);

export function MvpStoreProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(defaultStore.products);
  const [leads, setLeads] = useState<Lead[]>(defaultStore.leads);
  const [sales, setSales] = useState<Sale[]>(defaultStore.sales);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const store = readStore();
    setProducts(store.products);
    setLeads(store.leads);
    setSales(store.sales);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStore({ products, leads, sales });
  }, [hydrated, leads, products, sales]);

  const value = useMemo<MvpStoreContextValue>(
    () => ({
      products,
      leads,
      sales,
      hydrated,
      createProduct: (draft) => {
        setProducts((current) => [buildProduct(draft), ...current]);
      },
      updateProduct: (id, draft) => {
        setProducts((current) =>
          current.map((product) => (product.id === id ? buildProduct(draft, id, product.createdAt) : product))
        );
      },
      deleteProduct: (id) => {
        setProducts((current) => current.filter((product) => product.id !== id));
        setLeads((current) => current.filter((lead) => lead.productId !== id));
        setSales((current) => current.filter((sale) => sale.productId !== id));
      },
      createLead: (draft) => {
        setLeads((current) => [buildLead(draft), ...current]);
      },
      updateLead: (id, draft) => {
        setLeads((current) => current.map((lead) => (lead.id === id ? buildLead(draft, id, lead.createdAt) : lead)));
      },
      deleteLead: (id) => {
        setLeads((current) => current.filter((lead) => lead.id !== id));
      },
      createSale: (draft) => {
        setSales((current) => [buildSale(draft), ...current]);
      },
      updateSale: (id, draft) => {
        setSales((current) => current.map((sale) => (sale.id === id ? buildSale(draft, id, sale.createdAt) : sale)));
      },
      deleteSale: (id) => {
        setSales((current) => current.filter((sale) => sale.id !== id));
      },
      resetDemoData: () => {
        setProducts(defaultStore.products);
        setLeads(defaultStore.leads);
        setSales(defaultStore.sales);
      }
    }),
    [hydrated, leads, products, sales]
  );

  return <MvpStoreContext.Provider value={value}>{children}</MvpStoreContext.Provider>;
}

export function useMvpStore() {
  const context = useContext(MvpStoreContext);

  if (!context) {
    throw new Error("useMvpStore debe usarse dentro de MvpStoreProvider.");
  }

  return context;
}
