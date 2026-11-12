"use client";

import Image from "next/image";
import { useAuth } from "@/components/auth-provider";
import { PageTitle } from "@/components/workspace/ui";
import { roleLabel } from "@/lib/localization";

export default function AboutPage() {
  const { session } = useAuth();
  const user = session?.user;

  let sessionStartedAt = "No disponible";
  try {
    const tokenPayload = session?.token.split(".")[1];
    if (!tokenPayload) throw new Error("Token sin payload");
    const base64Payload = tokenPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, "=");
    const payloadBytes = Uint8Array.from(atob(paddedPayload), (character) => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(payloadBytes)) as { iat?: unknown };
    if (typeof claims.iat === "number" && Number.isFinite(claims.iat)) {
      sessionStartedAt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(claims.iat * 1000));
    }
  } catch {
    sessionStartedAt = "No disponible";
  }

  return (
    <div className="work-page">
      <PageTitle
        eyebrow="GLOBALNET · INFORMACIÓN INSTITUCIONAL"
        title="GlobalNet y AssetGuard"
        description="Contexto de la organización, la plataforma y el perfil operativo activo."
      />

      <div className="grid gap-5">
        <section className="work-section p-5 sm:p-6" aria-labelledby="operational-profile-title">
          <p className="work-eyebrow">PERFIL OPERATIVO ACTIVO</p>
          <h2 id="operational-profile-title" className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Información personal</h2>
          <div className="mt-5 flex flex-wrap items-center gap-4 border-b border-slate-200 pb-5 dark:border-slate-700">
            <Image
              src="/AssetGuard_2620_isotipo_app.png"
              alt="Isotipo de AssetGuard"
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="break-words text-base font-semibold text-slate-900 dark:text-slate-100">{user?.fullName || "No disponible"}</p>
              <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-300">{user?.email || "No disponible"}</p>
            </div>
          </div>
          <dl className="grid gap-x-8 gap-y-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="work-eyebrow">ROL EN EL SISTEMA</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{user ? roleLabel(user.role) : "No disponible"}</dd>
            </div>
            <div>
              <dt className="work-eyebrow">INICIO DE SESIÓN</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{sessionStartedAt}</dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <dt className="work-eyebrow">ORGANIZACIÓN</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">GlobalNet Telecom · Operaciones</dd>
            </div>
          </dl>
        </section>

        <section className="work-section p-5 sm:p-6" aria-labelledby="globalnet-title">
          <p className="work-eyebrow">GLOBALNET TELECOM</p>
          <h2 id="globalnet-title" className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Sobre GlobalNet Telecom</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700 dark:text-slate-300">
            GlobalNet Telecom despliega, mantiene y brinda soporte a infraestructura de conectividad y telecomunicaciones. Sus cuadrillas técnicas trabajan en campo con equipamiento especializado para instalar, diagnosticar y mantener los servicios y la infraestructura de sus clientes.
          </p>
        </section>

        <section className="work-section p-5 sm:p-6" aria-labelledby="assetguard-title">
          <p className="work-eyebrow">PLATAFORMA · ASSETGUARD 2620</p>
          <h2 id="assetguard-title" className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Sobre AssetGuard 2620</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700 dark:text-slate-300">
            AssetGuard 2620 es el sistema centralizado para gestionar los activos tecnológicos y controlar su custodia, desde el inventario hasta cada movimiento operativo.
          </p>
          <ol className="mt-5 grid gap-4 border-t border-slate-200 pt-5 dark:border-slate-700 md:grid-cols-3">
            <li className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">1</span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Inventario valorizado</h3>
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">Registro de activos con seriales autogenerados y valores en moneda bimodal USD/COP.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">2</span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ciclo de custodia</h3>
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">Gestión completa de préstamos y devoluciones con control de mora.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">3</span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Trazabilidad operativa</h3>
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">Registro inalterable de auditoría y mantenimiento para preservar el historial de cada activo.</p>
              </div>
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}