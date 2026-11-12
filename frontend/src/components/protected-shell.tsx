"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { WorkspaceTools } from "@/components/workspace/workspace-tools";
import { CorporateFooter } from "@/components/corporate-footer";
import { Button, useEscapeKey, useModalFocus } from "@/components/workspace/ui";
import { landingPath } from "@/lib/auth";
import { roleLabel } from "@/lib/localization";

const navigation = [
  { href: "/workspace/dashboard", label: "Resumen", icon: LayoutDashboard, roles: ["ADMIN"] },
  { href: "/workspace/assets", label: "Activos", icon: Boxes, roles: ["ADMIN", "INSPECTOR", "TECHNICIAN"] },
  { href: "/workspace/loans", label: "Préstamos", icon: ClipboardList, roles: ["INSPECTOR", "TECHNICIAN"] },
  { href: "/workspace/maintenance", label: "Mantenimiento", icon: Wrench, roles: ["ADMIN", "INSPECTOR"] },
  { href: "/workspace/history", label: "Mis custodias", icon: FileClock, roles: ["TECHNICIAN"] },
  { href: "/workspace/audit", label: "Auditoría", icon: ShieldCheck, roles: ["ADMIN"] },
  { href: "/workspace/users", label: "Usuarios", icon: ClipboardCheck, roles: ["ADMIN"] },
  { href: "/workspace/bulk-upload", label: "Carga masiva", icon: Upload, roles: ["ADMIN"] },
] as const;

const sectionTitles: Record<string, string> = {
  dashboard: "Panel de control y métricas",
  assets: "Inventario de activos",
  loans: "Gestión de préstamos",
  maintenance: "Mantenimiento técnico",
  history: "Mis custodias",
  audit: "Registro de auditoría",
  users: "Gestión de usuarios",
  "bulk-upload": "Carga masiva de activos",
};

export function ProtectedShell({ children }: { children: ReactNode }) {
  const { session, ready, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const section = pathname.split("/")[2] || "dashboard";
  const allowedRoles = navigation.find((item) => item.href === `/workspace/${section}`)?.roles;
  const hasRouteAccess = !allowedRoles || allowedRoles.some((role) => role === session?.user.role);
  const profileDialogRef = useModalFocus(profileOpen || logoutConfirmOpen);

  useEscapeKey(profileOpen || logoutConfirmOpen, () => {
    setProfileOpen(false);
    setLogoutConfirmOpen(false);
  });

  // Cierra cualquier modal abierto si cambia la ruta o el usuario autenticado
  useEffect(() => {
    setProfileOpen(false);
    setLogoutConfirmOpen(false);
  }, [pathname, session?.user.id]);

  useEffect(() => {
    if (ready && !session) router.replace("/login");
    if (ready && session && !hasRouteAccess) router.replace(landingPath(session.user.role));
  }, [ready, session, router, hasRouteAccess]);

  if (!ready || !session || !hasRouteAccess) {
    return <main className="session-check" aria-label="Comprobando sesión"><span className="loading-mark" /></main>;
  }

  const visibleNavigation = navigation.filter((item) => item.roles.some((role) => role === session.user.role));
  const title = sectionTitles[section] ?? "AssetGuard";

  let sessionStartedAt = "No disponible";
  try {
    const encodedPayload = session.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payloadBytes = Uint8Array.from(atob(encodedPayload), (character) => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(payloadBytes)) as { iat?: unknown };
    if (typeof claims.iat === "number" && Number.isFinite(claims.iat)) {
      sessionStartedAt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(claims.iat * 1000));
    }
  } catch {
    sessionStartedAt = "No disponible";
  }

  function confirmSignOut() {
    setLogoutConfirmOpen(false);
    setProfileOpen(false);
    signOut();
    router.replace("/login");
  }

  return (
    <div className="workspace min-h-screen">
      <aside className="sidebar backdrop-blur-xl">
        <Link
          className="brand-lockup flex items-center gap-3 px-3 py-4 border-b border-slate-200/80 dark:border-slate-800/80 text-decoration-none transition-opacity hover:opacity-95"
          href={landingPath(session.user.role)}
          aria-label="AssetGuard, inicio"
        >
          <div className="relative flex shrink-0 items-center justify-center">
            <Image
              src="/AssetGuard_2620_isotipo_app.png"
              alt="AssetGuard"
              width={38}
              height={38}
              className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]"
              priority
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5 leading-none">
              AssetGuard
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold tracking-normal">
                2620
              </span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide mt-1 truncate">
              GlobalNet Telecom
            </span>
          </div>
        </Link>

        <div className="workspace-switcher mt-3">
          <span className="workspace-monogram">GN</span>
          <span className="workspace-copy"><strong>GlobalNet</strong><small>Operaciones</small></span>
          <ArrowUpRight size={14} className="muted-icon" />
        </div>

        <p className="nav-caption">ESPACIO DE TRABAJO</p>
        <nav className="main-nav" aria-label="Navegación principal">
          {visibleNavigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
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
          <button
            className="profile-trigger"
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label={`Ver perfil de ${session.user.fullName || session.user.email}`}
          >
            <span className="avatar">
              <Image src="/AssetGuard_2620_isotipo_app.png" alt="" width={24} height={24} className="object-contain" />
            </span>
            <span className="profile-copy">
              <strong>{session.user.fullName || session.user.email}</strong>
              <small>{roleLabel(session.user.role)}</small>
            </span>
          </button>
          <button
            className="icon-button logout-button"
            type="button"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            onClick={() => setLogoutConfirmOpen(true)}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>GlobalNet</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <WorkspaceTools />
            <span className="environment-pill"><span /> SISTEMA ACTIVO</span>
            <span className="topbar-date">AssetGuard 2620</span>
          </div>
        </header>

        <main className="page-content" key={pathname}>{children}</main>
        <CorporateFooter className="workspace-corporate-footer" />
      </div>

      {profileOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProfileOpen(false);
          }}
        >
          <section
            ref={profileDialogRef}
            className="work-modal profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            tabIndex={-1}
          >
            <div className="modal-heading">
              <div>
                <p className="work-eyebrow">CUENTA · GLOBALNET</p>
                <h2 id="profile-title">Mi Perfil</h2>
              </div>
              <button type="button" className="table-action" aria-label="Cerrar perfil" onClick={() => setProfileOpen(false)}>
                <X size={17} />
              </button>
            </div>

            <div className="profile-summary">
              <span className="avatar">
                <Image src="/AssetGuard_2620_isotipo_app.png" alt="" width={34} height={34} className="object-contain" />
              </span>
              <div>
                <strong>{session.user.fullName || session.user.email}</strong>
                <span>{session.user.email}</span>
              </div>
            </div>

            <dl className="profile-details">
              <div>
                <dt>Rol en el sistema</dt>
                <dd>{roleLabel(session.user.role)}</dd>
              </div>
              <div>
                <dt>Inicio de sesión</dt>
                <dd>{sessionStartedAt}</dd>
              </div>
              <div>
                <dt>Estado de sesión</dt>
                <dd>
                  <span className="profile-session-status"><span /> Activa</span>
                </dd>
              </div>
            </dl>

            <section className="institution-card" aria-labelledby="institution-title">
              <p className="work-eyebrow">GLOBALNET TELECOM</p>
              <h3 id="institution-title">Sobre GlobalNet Telecom &amp; AssetGuard 2620</h3>
              <p>
                AssetGuard 2620 centraliza el inventario tecnológico y la custodia de equipos para mantener trazabilidad desde la asignación hasta su devolución o mantenimiento.
              </p>
            </section>
          </section>
        </div>
      )}

      {logoutConfirmOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLogoutConfirmOpen(false);
          }}
        >
          <section
            ref={profileDialogRef}
            className="work-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-description"
            tabIndex={-1}
          >
            <div className="modal-heading">
              <div>
                <p className="work-eyebrow">SESIÓN</p>
                <h2 id="logout-title">Cerrar sesión</h2>
              </div>
              <button type="button" className="table-action" aria-label="Cancelar" onClick={() => setLogoutConfirmOpen(false)}>
                <X size={17} />
              </button>
            </div>
            <p id="logout-description" className="legal-notice-copy">
              ¿Deseas cerrar tu sesión actual en AssetGuard?
            </p>
            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => setLogoutConfirmOpen(false)}>
                Seguir en AssetGuard
              </Button>
              <Button variant="danger" type="button" onClick={confirmSignOut}>
                Cerrar sesión
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}