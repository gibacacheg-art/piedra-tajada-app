"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";

export function AdminOverview() {
  const { canAccess } = useAuth();

  return (
    <>
      <PageHeader
        eyebrow="Control interno"
        title="Administración"
        description="Desde aquí se concentran los ajustes internos, la recuperación de eliminados y la gestión básica del equipo."
      />

      <section className="content-grid">
        {canAccess("/admin/users") ? (
          <article className="panel">
            <h2>Usuarios y roles</h2>
            <p className="muted">
              Administra accesos, activa o desactiva perfiles y define quién puede vender, coordinar o trabajar por área.
            </p>
            <div className="button-row" style={{ marginTop: 14 }}>
              <Link className="primary-button" href="/admin/users">
                Abrir usuarios
              </Link>
            </div>
          </article>
        ) : null}

        {canAccess("/trash") ? (
          <article className="panel">
            <h2>Papelera</h2>
            <p className="muted">
              Recupera solicitudes, eventos y documentos enviados por error a papelera o elimínalos definitivamente cuando ya no hagan falta.
            </p>
            <div className="button-row" style={{ marginTop: 14 }}>
              <Link className="primary-button" href="/trash">
                Abrir papelera
              </Link>
            </div>
          </article>
        ) : null}

        <article className="panel">
          <h2>Manual de usuario</h2>
          <p className="muted">Descarga la guía rápida para reservas, eventos, cobros, documentos, perfiles y criterio de uso.</p>
          <div className="button-row" style={{ marginTop: 14 }}>
            <a className="secondary-button" href="/manual-usuario-piedra-tajada.html" target="_blank" rel="noreferrer">
              Abrir manual
            </a>
            <a className="primary-button" href="/manual-usuario-piedra-tajada.html" download>
              <svg aria-hidden="true" className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v11" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Descargar manual
            </a>
          </div>
        </article>

        <article className="panel">
          <h2>Criterio de uso</h2>
          <ul className="detail-copy">
            <li>Usa archivar cuando quieras sacar algo del día a día sin perderlo.</li>
            <li>Usa papelera cuando fue un error y quieres la opción de recuperarlo.</li>
            <li>Usa borrado definitivo solo cuando ya no deba volver a existir.</li>
          </ul>
        </article>
      </section>
    </>
  );
}
