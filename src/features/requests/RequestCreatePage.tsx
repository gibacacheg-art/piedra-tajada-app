"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequestForm } from "./RequestForm";

export function RequestCreatePage() {
  return (
    <>
      <PageHeader
        eyebrow="Ventas"
        title="Nueva reserva"
        description="Entrada secundaria de apoyo. El camino madre del caso ahora parte desde Reservas."
      />

      <section className="content-grid">
        <RequestForm />

        <section className="panel">
          <h2>Qué sigue después</h2>
          <div className="dashboard-list">
            <article className="dashboard-mini-item">
              <strong>1. La entrada principal vive en Reservas</strong>
              <p className="muted">Si quieres seguir el caso desde su origen natural, vuelve a Reservas y crea la reserva desde ahí.</p>
            </article>
            <article className="dashboard-mini-item">
              <strong>2. Hacer seguimiento</strong>
              <p className="muted">Desde la ficha de la reserva podrás asignar responsable comercial y registrar el avance del cierre.</p>
            </article>
            <article className="dashboard-mini-item">
              <strong>3. Pasar a evento</strong>
              <p className="muted">Cuando el cliente avance, eliges si pasa a evento como pre-reserva o confirmado y ahí comienza la coordinación operativa.</p>
            </article>
          </div>

          <div className="button-row" style={{ marginTop: 14 }}>
            <Link className="primary-button" href="/reservations?new=1">
              Ir a Reservas
            </Link>
            <Link className="secondary-button" href="/requests">
              Ver seguimiento comercial
            </Link>
          </div>
        </section>
      </section>
    </>
  );
}
