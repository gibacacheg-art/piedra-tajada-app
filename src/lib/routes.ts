export type RoleCode = "admin_general" | "ventas" | "coordinador_evento" | "responsable_area" | "consulta_disponibilidad";

type RouteRule = {
  href: string;
  label?: string;
  allowedRoles?: RoleCode[];
};

const allRoles: RoleCode[] = ["admin_general", "ventas", "coordinador_evento", "responsable_area", "consulta_disponibilidad"];
const operationalRoles: RoleCode[] = ["admin_general", "ventas", "coordinador_evento", "responsable_area"];
const readOnlyViewerRoles: RoleCode[] = ["consulta_disponibilidad"];
const operationalAndViewerRoles: RoleCode[] = [...operationalRoles, ...readOnlyViewerRoles];

export const appRoutes: RouteRule[] = [
  { href: "/dashboard", label: "Inicio", allowedRoles: operationalAndViewerRoles },
  { href: "/reservations", label: "Reservas", allowedRoles: operationalAndViewerRoles },
  { href: "/calendar", label: "Calendario", allowedRoles: allRoles },
  { href: "/clients", label: "Clientes", allowedRoles: ["admin_general", "ventas", "coordinador_evento", "consulta_disponibilidad"] },
  { href: "/requests", label: "Solicitudes", allowedRoles: ["admin_general", "ventas", "coordinador_evento", "consulta_disponibilidad"] },
  { href: "/events", label: "Eventos", allowedRoles: ["admin_general", "ventas", "coordinador_evento", "responsable_area", "consulta_disponibilidad"] },
  { href: "/payments", label: "Cobros y facturación", allowedRoles: ["admin_general", "ventas", "coordinador_evento", "consulta_disponibilidad"] },
  { href: "/documents", label: "Documentos", allowedRoles: operationalAndViewerRoles },
  { href: "/admin", label: "Administración", allowedRoles: operationalRoles },
  { href: "/profile", label: "Mi perfil", allowedRoles: allRoles }
];

const routePermissions: RouteRule[] = [
  { href: "/admin", allowedRoles: operationalRoles },
  { href: "/admin/users", allowedRoles: ["admin_general"] },
  { href: "/clients/new", allowedRoles: ["admin_general", "ventas"] },
  { href: "/clients", allowedRoles: ["admin_general", "ventas", "coordinador_evento", "consulta_disponibilidad"] },
  { href: "/reservations", allowedRoles: operationalAndViewerRoles },
  { href: "/requests/new", allowedRoles: ["admin_general", "ventas"] },
  { href: "/requests", allowedRoles: ["admin_general", "ventas", "coordinador_evento", "consulta_disponibilidad"] },
  { href: "/payments", allowedRoles: ["admin_general", "ventas", "coordinador_evento", "consulta_disponibilidad"] },
  { href: "/events", allowedRoles: operationalAndViewerRoles },
  { href: "/calendar", allowedRoles: allRoles },
  { href: "/documents", allowedRoles: operationalAndViewerRoles },
  { href: "/trash", allowedRoles: ["admin_general"] },
  { href: "/my-tasks", allowedRoles: operationalRoles },
  { href: "/profile", allowedRoles: allRoles },
  { href: "/dashboard", allowedRoles: operationalAndViewerRoles }
];

export function hasAnyAllowedRole(userRoles: string[], allowedRoles?: RoleCode[]) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.some((role) => userRoles.includes(role));
}

export function canAccessPath(pathname: string, userRoles: string[]) {
  if (userRoles.length === 0) {
    return pathname === "/dashboard" || pathname === "/profile" || pathname.startsWith("/profile/");
  }

  const matchedRule = routePermissions.find((rule) => pathname === rule.href || pathname.startsWith(`${rule.href}/`));
  if (!matchedRule) return true;
  return hasAnyAllowedRole(userRoles, matchedRule.allowedRoles);
}

export function defaultPathForRoles(userRoles: string[]) {
  if (userRoles.length === 1 && userRoles.includes("consulta_disponibilidad")) {
    return "/calendar";
  }

  return "/dashboard";
}
