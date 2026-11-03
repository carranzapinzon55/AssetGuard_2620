import type { UserRole } from "@/lib/auth";

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Director de Logística",
  INSPECTOR: "Encargado de Bodega",
  TECHNICIAN: "Técnico de Campo",
};

const statusLabels: Record<string, string> = {
  AVAILABLE: "Disponible",
  LOANED: "En préstamo",
  ON_LOAN: "En préstamo",
  UNDER_MAINTENANCE: "En mantenimiento",
  LOST: "Perdido",
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  RETURNED: "Devuelto",
  GOOD: "En buen estado",
  DAMAGED: "Dañado",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  UNKNOWN: "Estado no disponible",
};

export const GENERIC_ERROR_MESSAGE =
  "Ocurrió un inconveniente al procesar la operación. Por favor, inténtalo de nuevo más tarde.";

export function roleLabel(role: UserRole): string {
  return roleLabels[role];
}

export function statusLabel(value?: string | null): string {
  if (!value) return statusLabels.UNKNOWN;
  const normalized = value.toUpperCase();
  return statusLabels[normalized] ?? statusLabels.UNKNOWN;
}