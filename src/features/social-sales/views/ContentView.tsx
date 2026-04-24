"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/features/social-sales/components/EmptyState";
import { PageIntro } from "@/features/social-sales/components/PageIntro";
import { StatusPill } from "@/features/social-sales/components/StatusPill";
import { generateProductContent } from "@/features/social-sales/lib/content";
import { useMvpStore } from "@/features/social-sales/providers/MvpStoreProvider";

export function ContentView() {
  const { products } = useMvpStore();
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? products[0],
    [products, selectedProductId]
  );

  const content = selectedProduct ? generateProductContent(selectedProduct) : null;

  return (
    <div className="mvp-page-stack">
      <PageIntro
        eyebrow="Etapa 6"
        title="Módulo de contenido"
        description="Plantillas internas listas para publicar, con arquitectura simple para conectar IA real más adelante."
      />

      {!selectedProduct || !content ? (
        <EmptyState title="Sin productos" description="Necesitas al menos un producto para generar contenido base." />
      ) : (
        <>
          <section className="mvp-panel-card">
            <div className="mvp-section-head">
              <div>
                <p className="mvp-kicker">Generador interno</p>
                <h3>Contenido desde datos del producto</h3>
              </div>
            </div>
            <div className="mvp-toolbar single">
              <select onChange={(event) => setSelectedProductId(event.target.value)} value={selectedProduct.id}>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mvp-summary-strip">
              <span>{selectedProduct.category}</span>
              <StatusPill value={selectedProduct.status} />
              <span>Score {selectedProduct.evaluation.finalScore}</span>
            </div>
          </section>

          <section className="mvp-content-grid">
            <ContentCard title="Copy corto para Instagram" value={content.instagramShort} />
            <ContentCard title="Copy largo para Facebook" value={content.facebookLong} />
            <ContentCard title="Texto promocional para WhatsApp" value={content.whatsappPromo} />
            <ContentCard title="Idea de guion para TikTok/Reel" value={content.tiktokScript} />
            <ContentCard title="Llamado a la acción" value={content.callToAction} />
            <article className="mvp-panel-card">
              <h3>Preguntas frecuentes</h3>
              <ul className="mvp-bullet-list">
                {content.faq.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="mvp-panel-card">
              <h3>Respuestas a objeciones</h3>
              <ul className="mvp-bullet-list">
                {content.objections.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="mvp-panel-card mvp-note-card">
              <p className="mvp-kicker">Preparado para Fase 2</p>
              <h3>Conector futuro de IA</h3>
              <p className="mvp-subtle">
                El contenido se genera hoy con reglas internas sobre `Product`. Más adelante esta misma entrada puede delegarse a un servicio de IA sin tocar la UI.
              </p>
            </article>
          </section>
        </>
      )}
    </div>
  );
}

function ContentCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="mvp-panel-card">
      <h3>{title}</h3>
      <p className="mvp-subtle">{value}</p>
    </article>
  );
}
