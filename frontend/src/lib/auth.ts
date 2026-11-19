export type UserRole = "ADMIN" | "INSPECTOR" | "TECHNICIAN";

export type AuthUser = {
  id: string;
  fullName: string | null;
  email: string;
  role: UserRole;
  status: boolean;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

const SESSION_KEY = "assetguard.session";

export function getDisplayUserName(user: { fullName?: string | null; email: string }): string {
  const trimmed = user.fullName?.trim();
  if (trimmed && trimmed.toLowerCase() !== user.email.trim().toLowerCase()) {
    return trimmed;
  }
  const alias = user.email.split("@")[0]?.trim();
  return alias || "Usuario";
}

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session.token || !session.user?.role || !session.user?.email) return null;
    if (!["ADMIN", "INSPECTOR", "TECHNICIAN"].includes(session.user.role)) return null;
    session.user.fullName = getDisplayUserName(session.user);
    return session;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export const getSession = readSession;

export function saveSession(session: AuthSession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

export function landingPath(role: UserRole): string {
  if (role === "TECHNICIAN") return "/workspace/history";
  if (role === "INSPECTOR") return "/workspace/loans";
  return "/workspace/dashboard";
}
