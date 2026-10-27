"use client";

import Link from "next/link";
import { ArrowUpRight, Boxes, ClipboardCheck, FileClock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

const shortcuts = [
  { href: "/assets", title: "Catálogo de activos", detail: "Consulta el inventario registrado.", icon: Boxes, roles: ["ADMIN", "INSPECTOR", "TECHNICIAN"] },
  { href: "/loans", title: "Préstamos", detail: "Revisa solicitudes y custodias.", icon: ClipboardCheck, roles: ["ADMIN", "INSPECTOR", "TECHNICIAN"] },
  { href: "/history", title: "Mi historial", detail: "Tus movimientos de custodia.", icon: FileClock, roles: ["TECHNICIAN"] },
  { href: "/audit", title: "Auditoría global", detail: "Consulta movimientos con filtros.", icon: ShieldCheck, roles: ["ADMIN", "INSPECTOR"] },
] as const;

export default function DashboardPage() {
  const { session } = useAuth();
  const role = session?.user.role;
  const roleName = role === "ADMIN" ? "Administrador" : role === "INSPECTOR" ? "Inspector" : "Técnico";
  const items = shortcuts.filter((item) => role && item.roles.some((allowedRole) => allowedRole === role));

  return (
    <div className="dashboard-page">
      <section className="page-heading">
        <div><p className="eyebrow">ESPACIO DE TRABAJO <span>·</span> {roleName.toUpperCase()}</p><h1>Buenos días, {session?.user.fullName?.split(" ")[0] || "equipo"}</h1><p className="page-subtitle">Tu operación de activos, en un solo lugar.</p></div>
        <div className="date-stamp"><span>CUENTA ACTIVA</span><strong>{session?.user.email}</strong></div>
      </section>

      <section className="dashboard-band">
        <div className="dashboard-band-title"><div><span className="band-index">01</span><h2>Acceso rápido</h2></div><span className="band-note">MÓDULOS DISPONIBLES PARA TU PERFIL</span></div>
        <div className="shortcut-list">
          {items.map(({ href, title, detail, icon: Icon }, index) => (
            <Link href={href} className="shortcut-row" key={href}>
              <span className="shortcut-number">0{index + 1}</span><span className="shortcut-icon"><Icon size={19} strokeWidth={1.8} /></span><span className="shortcut-copy"><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight size={17} className="shortcut-arrow" />
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-footer-note"><span className="note-mark">AG</span><p><strong>AssetGuard 2620</strong><br />Control de activos y custodias de GlobalNet.</p><span className="version-label">PLATAFORMA INTERNA <b>·</b> V1.0</span></section>
    </div>
  );
}