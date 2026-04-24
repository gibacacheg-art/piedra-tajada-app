"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { appRoutes, defaultPathForRoles } from "@/lib/routes";

const roleLabels: Record<string, string> = {
  admin_general: "Administrador general",
  ventas: "Ventas",
  coordinador_evento: "Coordinador de evento",
  responsable_area: "Responsable de área",
  consulta_disponibilidad: "Consulta general"
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, roles, loading, signOut, canAccess } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const displayName = profile?.full_name || user?.email || "Usuario";
  const visibleRoutes = useMemo(() => appRoutes.filter((route) => route.label && canAccess(route.href)), [canAccess]);
  const roleSummary = roles.length > 0 ? roles.map((role) => roleLabels[role] ?? role).join(" · ") : "Sin rol asignado";
  const fallbackPath = defaultPathForRoles(roles);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (loading) {
    return <main className="loading-screen">Cargando sesión...</main>;
  }

  if (!user) {
    return <main className="loading-screen">Redirigiendo...</main>;
  }

  if (profile && !profile.is_active) {
    return (
      <div className="app-layout">
        <aside className="sidebar">
          <div>
            <p className="eyebrow">Piedra Tajada</p>
            <h2>Reservas</h2>
          </div>
        </aside>
        <div className="main-column">
          <section className="panel">
            <h2>Acceso desactivado</h2>
            <p className="muted">Tu perfil está desactivado. Un administrador general debe volver a habilitar tu acceso.</p>
            <div className="button-row" style={{ marginTop: 14 }}>
              <button className="secondary-button" onClick={signOut} type="button">
                Cerrar sesión
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!canAccess(pathname)) {
    return (
      <div className="app-layout">
        <aside className={`sidebar${mobileNavOpen ? " is-open" : ""}`}>
          <div>
            <p className="eyebrow">Piedra Tajada</p>
            <h2>Reservas</h2>
          </div>
          <nav aria-label="Navegación principal">
            {visibleRoutes.map((route) => (
              <Link className={pathname.startsWith(route.href) ? "nav-link active" : "nav-link"} href={route.href} key={route.href}>
                {route.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="main-column">
          <header className="topbar">
            <div>
              <p className="eyebrow">Sesión activa</p>
              <strong>{displayName}</strong>
              <p className="muted">{roleSummary}</p>
            </div>
            <div className="button-row topbar-actions">
              <button
                aria-expanded={mobileNavOpen}
                aria-label={mobileNavOpen ? "Cerrar menú" : "Abrir menú"}
                className="secondary-button mobile-nav-toggle"
                onClick={() => setMobileNavOpen((current) => !current)}
                type="button"
              >
                {mobileNavOpen ? "Cerrar menú" : "Menú"}
              </button>
              <button className="secondary-button" onClick={signOut} type="button">
                Cerrar sesión
              </button>
            </div>
          </header>

          <section className="panel">
            <h2>Sin permiso para esta sección</h2>
            <p className="muted">Tu rol actual no tiene acceso a esta pantalla. Usa el menú para ir a una sección permitida.</p>
            <div className="button-row" style={{ marginTop: 14 }}>
              <Link className="primary-button" href={fallbackPath}>
                Ir a tu sección principal
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className={`sidebar${mobileNavOpen ? " is-open" : ""}`}>
        <div>
          <p className="eyebrow">Piedra Tajada</p>
          <h2>Reservas</h2>
        </div>
        <nav aria-label="Navegación principal">
          {visibleRoutes.map((route) => (
            <Link className={pathname.startsWith(route.href) ? "nav-link active" : "nav-link"} href={route.href} key={route.href}>
              {route.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="main-column" key={pathname}>
        <header className="topbar">
          <div>
            <p className="eyebrow">Sesión activa</p>
            <strong>{displayName}</strong>
            <p className="muted">{roleSummary}</p>
          </div>
          <div className="button-row topbar-actions">
            <button
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? "Cerrar menú" : "Abrir menú"}
              className="secondary-button mobile-nav-toggle"
              onClick={() => setMobileNavOpen((current) => !current)}
              type="button"
            >
              {mobileNavOpen ? "Cerrar menú" : "Menú"}
            </button>
            <button className="secondary-button" onClick={signOut} type="button">
              Cerrar sesión
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
