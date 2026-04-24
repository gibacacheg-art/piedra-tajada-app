import { format } from "date-fns";
import { es } from "date-fns/locale";

export function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return format(new Date(`${value}T00:00:00`), "dd MMM yyyy", { locale: es });
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    request_received: "Nueva solicitud",
    quoted: "Cotización enviada",
    pre_reserved: "Pre-reserva",
    confirmed: "Confirmada",
    executed: "Realizada",
    cancelled: "Cancelada",
    lost: "Perdida"
  };

  return labels[status] ?? status;
}
