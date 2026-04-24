"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/features/social-sales/constants/options";

export function MvpShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mvp-shell">
      <aside className="mvp-sidebar">
        <div className="mvp-brand-block">
          <p className="mvp-kicker">MVP Interno</p>
          <h1>Social Sales Hub</h1>
          <p className="mvp-subtle">Operación simple para validar productos, leads, ventas y contenido de redes.</p>
        </div>

        <nav className="mvp-nav" aria-label="Navegación principal del MVP">
          {navigationItems.map((item) => (
            <Link className={pathname === item.href ? "mvp-nav-link active" : "mvp-nav-link"} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mvp-sidebar-card">
          <p className="mvp-kicker">Estrategia de datos</p>
          <strong>Local-first</strong>
          <p className="mvp-subtle">Persistencia en localStorage con estructura pensada para migrar luego a Supabase.</p>
        </div>
      </aside>

      <div className="mvp-main">{children}</div>
    </div>
  );
}
