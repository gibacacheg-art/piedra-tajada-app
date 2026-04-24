export type RoleCode = "admin_general" | "ventas" | "coordinador_evento" | "responsable_area" | "consulta_disponibilidad";

type RouteRule = {
  href: string;
  label?: string;
  allowedRoles?: RoleCode[];
};

const allRoles: RoleCode[] = ["admin_general", "ventas", "coordinador_evento", "responsable_area", "consulta_disponibilidad"];
const operationalRoles: RoleCode[] = ["admin_general", "ventas", "coordinador_evento", "responsable_area"];

export const appRoutes: RouteRule[] = [
  { href: "/dashboard", label: "Inicio", allowedRoles: operationalRoles },
  { href: "/reservations", label: "Reservas", allowedRoles: operationalRoles },
  { href: "/calendar", label: "Calendario", allowedRoles: allRoles },
  { href: "/clients", label: "Clientes", allowedRoles: ["admin_general", "ventas", "coordinador_evento"] },
  { href: "/payments", label: "Cobros y facturación", allowedRoles: ["admin_general", "ventas", "coordinador_evento"] },
  { href: "/documents", label: "Documentos", allowedRoles: operationalRoles },
  { href: "/admin", label: "Administración", allowedRoles: operationalRoles },
  { href: "/profile", label: "Mi perfil", allowedRoles: allRoles }
];

const routePermissions: RouteRule[] = [
  { href: "/admin", allowedRoles: operationalRoles },
  { href: "/admin/users", allowedRoles: ["admin_general"] },
  { href: "/clients/new", allowedRoles: ["admin_general", "ventas"] },
  { href: "/clients", allowedRoles: ["admin_general", "ventas", "coordinador_evento"] },
  { href: "/reservations", allowedRoles: operationalRoles },
  { href: "/requests/new", allowedRoles: ["admin_general", "ventas"] },
  { href: "/requests", allowedRoles: ["admin_general", "ventas", "coordinador_evento"] },
  { href: "/payments", allowedRoles: ["admin_general", "ventas", "coordinador_evento"] },
  { href: "/events", allowedRoles: operationalRoles },
  { href: "/calendar", allowedRoles: allRoles },
  { href: "/documents", allowedRoles: operationalRoles },
  { href: "/trash", allowedRoles: ["admin_general"] },
  { href: "/my-tasks", allowedRoles: operationalRoles },
  { href: "/profile", allowedRoles: allRoles },
  { href: "/dashboard", allowedRoles: operationalRoles }
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
