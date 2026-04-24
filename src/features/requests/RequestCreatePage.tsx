"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequestForm } from "./RequestForm";

export function RequestCreatePage() {
  return (
    <>
      <PageHeader
        eyebrow="Ventas"
        title="Nueva solicitud de evento"
        description="Crea una nueva solicitud en una página separada para que el ingreso comercial sea más limpio y enfocado."
      />

      <section className="content-grid">
        <RequestForm />

        <section className="panel">
          <h2>Qué sigue después</h2>
          <div className="dashboard-list">
            <article className="dashboard-mini-item">
              <strong>1. Valorar servicios desde el inicio</strong>
              <p className="muted">Ya en esta pantalla puedes marcar servicios, asignarles valor o dejarlos sin costo para crear la cotización base.</p>
            </article>
            <article className="dashboard-mini-item">
              <strong>2. Hacer seguimiento</strong>
              <p className="muted">Desde la ficha de la solicitud podrás asignar responsable comercial y registrar el avance del cierre.</p>
            </article>
            <article className="dashboard-mini-item">
              <strong>3. Pasar a evento</strong>
              <p className="muted">Cuando el cliente avance, eliges si pasa a evento como pre-reserva o confirmado y ahí comienza la coordinación operativa.</p>
            </article>
          </div>

          <div className="button-row" style={{ marginTop: 14 }}>
            <Link className="secondary-button" href="/requests">
              Volver al listado
            </Link>
          </div>
        </section>
      </section>
    </>
  );
}
