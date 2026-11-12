"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { landingPath, type UserRole } from "@/lib/auth";
import { createGraphQLClient, LOGIN_MUTATION } from "@/lib/graphql";
import { useAuth } from "@/components/auth-provider";
import { CorporateFooter } from "@/components/corporate-footer";

type LoginResponse = {
  login: {
    token: string;
  };
};

type JwtClaims = Record<string, unknown>;
const userRoles: readonly UserRole[] = ["ADMIN", "INSPECTOR", "TECHNICIAN"];

function parseJwt(token: string): JwtClaims {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const claims: unknown = JSON.parse(jsonPayload);
    return claims !== null && typeof claims === "object" && !Array.isArray(claims)
      ? (claims as JwtClaims)
      : {};
  } catch {
    return {};
  }
}

function parseRole(value: unknown): UserRole | null {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const normalized = candidate.replace(/^ROLE_/, "").trim();
      const matched = userRoles.find((role) => role === normalized);
      if (matched) return matched;
    }
  }
  return null;
}

export function LoginForm() {
  const { session, ready, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@globalnet.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && session) router.replace(landingPath(session.user.role));
  }, [ready, session, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const client = createGraphQLClient();
      const result = await client.request<LoginResponse>(LOGIN_MUTATION, {
        input: { email: email.trim(), password },
      });

      if (!result.login?.token) {
        throw new Error("El servidor no devolvió un token de acceso válido.");
      }

      const jwtPayload = parseJwt(result.login.token);
      const userEmail = typeof jwtPayload.sub === "string" ? jwtPayload.sub : email.trim();
      const userRole = parseRole(jwtPayload.role) ?? parseRole(jwtPayload.roles) ?? parseRole(jwtPayload.authorities);
      if (!userRole) {
        throw new Error("El usuario no tiene un rol habilitado.");
      }

      const user = {
        id: String(jwtPayload.id ?? ""),
        email: userEmail,
        fullName: typeof jwtPayload.fullName === "string" ? jwtPayload.fullName : userEmail,
        role: userRole,
        status: true,
      };

      localStorage.setItem("token", result.login.token);

      signIn({ token: result.login.token, user });
      router.replace(landingPath(userRole));
    } catch {
      setError("No se pudo iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-aside" aria-label="AssetGuard">
        <div className="login-aside-top">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-[#060b14] p-1 shadow-md">
              <Image
                src="/AssetGuard_2620_isotipo_app.png"
                alt="AssetGuard 2620"
                width={36}
                height={36}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                AssetGuard<span className="font-bold text-emerald-600 dark:text-emerald-400">_2620</span>
              </span>
              <span className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-400">
                Activos bajo control
              </span>
            </div>
          </div>
          <span className="edition-label">CONTROL DE ACTIVOS <i>·</i> 2620</span>
        </div>

        <div className="login-aside-content">
          <p className="eyebrow-light"><span /> PLATAFORMA DE OPERACIONES</p>
          <h1>Custodia clara.<br /><em>Control preciso.</em></h1>
          <p className="aside-description">
            Un único lugar para gestionar el inventario, las custodias y el ciclo de vida de los activos de GlobalNet.
          </p>
          <div className="aside-rule" />
          <div className="aside-facts">
            <div>
              <span className="fact-icon"><ShieldCheck size={17} /></span>
              <span><strong>Acceso por rol</strong><small>Permisos para cada equipo</small></span>
            </div>
            <div>
              <span className="fact-icon"><KeyRound size={17} /></span>
              <span><strong>Trazabilidad</strong><small>Registro de cada movimiento</small></span>
            </div>
          </div>
        </div>

        <div className="aside-footer">
          <span>GLOBALNET TELECOM</span>
          <span>OPERACIONES DE ACTIVOS <b>·</b> INTERNO</span>
        </div>
        <div className="aside-index" aria-hidden="true">AG<span> / </span>01</div>
      </section>

      <section className="login-main">
        <div className="login-main-header">
          <span>PORTAL DE ACCESO</span>
          <span className="secure-label"><LockKeyhole size={13} /> CONEXIÓN SEGURA</span>
        </div>

        <div className="login-card-wrap login-card-surface">
          <div className="login-card-heading">
            <p className="eyebrow">BIENVENIDO DE NUEVO</p>
            <h2>Iniciar sesión</h2>
            <p>Introduce tus credenciales para entrar al espacio de trabajo.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Correo electrónico</label>
            <div className="input-wrap">
              <Mail size={17} />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="nombre@globalnet.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="password-label-row">
              <label htmlFor="password">Contraseña</label>
            </div>
            <div className="input-wrap">
              <LockKeyhole size={17} />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Introduce tu contraseña"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="reveal-button"
                type="button"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="submit-button" type="submit" disabled={submitting || !ready} aria-busy={submitting}>
              <span>{submitting ? "Verificando acceso…" : "Entrar al sistema"}</span>
              {submitting ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowRight size={17} />}
            </button>
          </form>

          <div className="login-card-footer">
            <span><span className="small-status-dot" /> ACCESO MONITORIZADO</span>
            <span>¿Problemas de acceso? Contacta con soporte</span>
          </div>
        </div>

        <CorporateFooter className="login-corporate-footer" />
      </section>
    </main>
  );
}