"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { landingPath, type UserRole } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";

const navigation = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard, roles: ["ADMIN", "INSPECTOR", "TECHNICIAN"] },
  { href: "/assets", label: "Activos", icon: Boxes, roles: ["ADMIN", "INSPECTOR", "TECHNICIAN"] },
  { href: "/loans", label: "Préstamos", icon: ClipboardList, roles: ["ADMIN", "INSPECTOR", "TECHNICIAN"] },
  { href: "/history", label: "Mi historial", icon: Activity, roles: ["TECHNICIAN"] },
  { href: "/audit", label: "Auditoría", icon: ShieldCheck, roles: ["ADMIN", "INSPECTOR"] },
  { href: "/metrics", label: "Indicadores", icon: Activity, roles: ["ADMIN"] },
] as const;

const sectionTitles: Record<string, string> = {
  dashboard: "Resumen operativo",
  assets: "Inventario de activos",
  loans: "Gestión de préstamos",
  history: "Mi historial de custodia",
  audit: "Registro de auditoría",
  metrics: "Indicadores de gestión",
};

function roleLabel(role: UserRole) {
  return role === "ADMIN" ? "Administrador" : role === "INSPECTOR" ? "Inspector" : "Técnico";
}

export function ProtectedShell({ children }: { children: ReactNode }) {
  const { session, ready, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const section = pathname.split("/")[1] || "dashboard";

  useEffect(() => {
    if (ready && !session) router.replace("/login");
    if (ready && session && section !== "dashboard") {
      const allowed = navigation.find((item) => item.href === `/${section}`)?.roles;
      if (allowed && !allowed.some((allowedRole) => allowedRole === session.user.role)) {
        router.replace(landingPath(session.user.role));
      }
    }
  }, [ready, session, router, section]);

  if (!ready || !session) {
    return (
      <main className="session-check" aria-label="Comprobando sesión">
        <span className="loading-mark" />
      </main>
    );
  }

  const visibleNavigation = navigation.filter((item) =>
    item.roles.some((allowedRole) => allowedRole === session.user.role),
  );
  const title = sectionTitles[section] ?? "AssetGuard";
  const initials = (session.user.fullName || session.user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/dashboard" aria-label="AssetGuard, resumen">
          <span className="brand-symbol"><PackageSearch size={20} strokeWidth={2.2} /></span>
          <span className="brand-name">Asset<span>Guard</span></span>
        </Link>

        <div className="workspace-switcher">
          <span className="workspace-monogram">GN</span>
          <span className="workspace-copy"><strong>GlobalNet</strong><small>Operaciones</small></span>
          <ArrowUpRight size={14} className="muted-icon" />
        </div>

        <p className="nav-caption">ESPACIO DE TRABAJO</p>
        <nav className="main-nav" aria-label="Navegación principal">
          {visibleNavigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <Link key={href} href={href} className={`nav-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
                {active && <span className="nav-active-indicator" />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-status"><span className="status-dot" /> Servicios conectados</div>
        <div className="profile-row">
          <span className="avatar">{initials || <UserRound size={16} />}</span>
          <span className="profile-copy"><strong>{session.user.fullName || session.user.email}</strong><small>{roleLabel(session.user.role)}</small></span>
          <button className="icon-button logout-button" type="button" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => { signOut(); router.replace("/login"); }}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb"><span>GlobalNet</span><span className="breadcrumb-separator">/</span><strong>{title}</strong></div>
          <div className="topbar-right"><span className="environment-pill"><span /> SISTEMA ACTIVO</span><span className="topbar-date">AssetGuard 2620</span></div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}