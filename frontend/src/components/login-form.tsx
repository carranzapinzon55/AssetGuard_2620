"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Mail, PackageCheck, ShieldCheck } from "lucide-react";
import { landingPath, type AuthSession, type UserRole } from "@/lib/auth";
import { createGraphQLClient, LOGIN_MUTATION } from "@/lib/graphql";
import { useAuth } from "@/components/auth-provider";

type LoginResponse = {
  login: {
    token: string;
  };
};

// Función auxiliar para decodificar el token JWT de forma segura
function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return {};
  }
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

      // Extraemos la información del usuario directamente desde el token JWT
      const jwtPayload = parseJwt(result.login.token);
      const userEmail = jwtPayload.sub || email.trim();
      const userRole = (jwtPayload.role || jwtPayload.roles || "ADMIN") as UserRole;

      if (!["ADMIN", "INSPECTOR", "TECHNICIAN"].includes(userRole)) {
        throw new Error("El usuario no tiene un rol habilitado.");
      }

      const user = {
        id: jwtPayload.id || 1,
        email: userEmail,
        fullName: jwtPayload.fullName || "Administrador",
        role: userRole,
        status: true,
      };

      signIn({ token: result.login.token, user });
      router.replace("/workspace/dashboard");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "No se pudo iniciar sesión.";
      setError(message.includes("fetch failed") || message.includes("Failed to fetch")
        ? "No hay conexión con AssetGuard. Comprueba que el backend esté activo."
        : message || "Credenciales incorrectas o cuenta inactiva.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-aside" aria-label="AssetGuard">
        <div className="login-aside-top">
          <div className="brand-lockup login-brand">
            <span className="brand-symbol"><PackageCheck size={20} strokeWidth={2.2} /></span>
            <span className="brand-name">Asset<span>Guard</span></span>
          </div>
          <span className="edition-label">CONTROL DE ACTIVOS <i>·</i> 2620</span>
        </div>

        <div className="login-aside-content">
          <p className="eyebrow-light"><span /> PLATAFORMA DE OPERACIONES</p>
          <h1>Custodia clara.<br /><em>Control preciso.</em></h1>
          <p className="aside-description">Un único lugar para gestionar el inventario, las custodias y el ciclo de vida de los activos de GlobalNet.</p>
          <div className="aside-rule" />
          <div className="aside-facts">
            <div><span className="fact-icon"><ShieldCheck size={16} /></span><span><strong>Acceso por rol</strong><small>Permisos para cada equipo</small></span></div>
            <div><span className="fact-icon"><KeyRound size={16} /></span><span><strong>Trazabilidad</strong><small>Registro de cada movimiento</small></span></div>
          </div>
        </div>

        <div className="aside-footer"><span>GLOBALNET</span><span>ASSET OPERATIONS <b>·</b> INTERNAL</span></div>
        <div className="aside-index" aria-hidden="true">AG<span> / </span>01</div>
      </section>

      <section className="login-main">
        <div className="login-main-header"><span>PORTAL DE ACCESO</span><span className="secure-label"><LockKeyhole size={13} /> CONEXIÓN SEGURA</span></div>
        <div className="login-card-wrap">
          <div className="login-card-heading"><p className="eyebrow">BIENVENIDO DE NUEVO</p><h2>Iniciar sesión</h2><p>Introduce tus credenciales para entrar al espacio de trabajo.</p></div>
          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Correo electrónico</label>
            <div className="input-wrap"><Mail size={17} /><input id="email" name="email" type="email" autoComplete="username" placeholder="nombre@globalnet.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
            <div className="password-label-row"><label htmlFor="password">Contraseña</label></div>
            <div className="input-wrap"><LockKeyhole size={17} /><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Introduce tu contraseña" value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="reveal-button" type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="submit-button" type="submit" disabled={submitting || !ready}>
              <span>{submitting ? "Verificando acceso…" : "Entrar al sistema"}</span><ArrowRight size={17} />
            </button>
          </form>
          <div className="login-card-footer"><span><span className="small-status-dot" /> ACCESO MONITORIZADO</span><span>¿Problemas de acceso? Contacta a soporte</span></div>
        </div>
        <footer className="login-main-footer"><span>© 2026 GLOBALNET</span><span>ASSETGUARD <b>·</b> 2620</span></footer>
      </section>
    </main>
  );
}