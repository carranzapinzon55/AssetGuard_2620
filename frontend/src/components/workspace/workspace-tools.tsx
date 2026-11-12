"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Boxes, Command, Moon, Search, Sun, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useCurrency } from "@/components/currency-provider";
import { ASSETS_QUERY, USERS_QUERY } from "@/lib/operations";
import { errorMessage, queryGraphQL, type AssetItem, type UserItem } from "@/lib/workspace";
import { useModalFocus } from "@/components/workspace/ui";

type PaletteResult = { label: string; detail: string; href: string; kind: "Activo" | "Técnico" };

export function WorkspaceTools() {
  const { session } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [technicians, setTechnicians] = useState<UserItem[]>([]);
  const [selected, setSelected] = useState(0);
  const themeTransitionTimer = useRef<number | null>(null);
  const paletteRef = useModalFocus(open);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const stored = localStorage.getItem("assetguard-theme");
    const initial = stored === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  function openPalette() {
    setQuery("");
    setSelected(0);
    setError("");
    setLoading(true);
    setOpen(true);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || !session) return;
    let active = true;
    const assetRequest = queryGraphQL<{ assets: AssetItem[] }>(ASSETS_QUERY)
      .then((result) => { if (active) setAssets(result.assets); })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); });
    const technicianRequest = session.user.role === "ADMIN"
      ? queryGraphQL<{ users: UserItem[] }>(USERS_QUERY)
          .then((result) => { if (active) setTechnicians(result.users.filter((user) => user.role === "TECHNICIAN")); })
          .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      : Promise.resolve();
    Promise.all([assetRequest, technicianRequest]).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, session]);

  const normalizedQuery = query.trim().toLowerCase();
  const results: PaletteResult[] = normalizedQuery.length < 2 ? [] : [
    ...assets
      .filter((asset) => `${asset.serialNumber} ${asset.model ?? ""}`.toLowerCase().includes(normalizedQuery))
      .map((asset) => ({
        label: asset.serialNumber,
        detail: asset.model || "Activo",
        href: `/workspace/assets?search=${encodeURIComponent(asset.serialNumber)}`,
        kind: "Activo" as const,
      })),
    ...technicians
      .filter((user) => `${user.fullName ?? ""} ${user.email}`.toLowerCase().includes(normalizedQuery))
      .map((user) => ({
        label: user.fullName || user.email,
        detail: user.email,
        href: `/workspace/users?search=${encodeURIComponent(user.fullName || user.email)}`,
        kind: "Técnico" as const,
      })),
  ].slice(0, 8);

  function selectResult(index: number) {
    const result = results[index];
    if (!result) return;
    setOpen(false);
    router.push(result.href);
  }

  function toggleTheme() {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    document.documentElement.classList.add("theme-transition");
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("assetguard-theme", next);
    if (themeTransitionTimer.current) window.clearTimeout(themeTransitionTimer.current);
    themeTransitionTimer.current = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
      themeTransitionTimer.current = null;
    }, 320);
  }

  return <>
    <div className="currency-switch" role="group" aria-label="Moneda de visualización" title="Tasa referencial: 1 USD = 4.000 COP">
      <button type="button" aria-pressed={currency === "USD"} onClick={() => setCurrency("USD")}>USD</button>
      <button type="button" aria-pressed={currency === "COP"} onClick={() => setCurrency("COP")}>COP</button>
    </div>
    <button type="button" className="workspace-tool-button" onClick={openPalette} aria-label="Búsqueda global" title="Búsqueda global (Ctrl+K)">
      <Search size={15} /><span>Buscar</span><kbd><Command size={10} /> K</kbd>
    </button>
    <button type="button" className="workspace-tool-button theme-toggle" onClick={toggleTheme} aria-label="Cambiar tema claro u oscuro" title="Cambiar tema claro u oscuro">
      <Moon size={16} className="dark:hidden" /><Sun size={16} className="hidden dark:block" />
    </button>
    {open && <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 pt-[12vh] backdrop-blur-sm dark:bg-black/65" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={paletteRef} tabIndex={-1} className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-label="Búsqueda global">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }} onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setSelected((value) => Math.min(value + 1, results.length - 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setSelected((value) => Math.max(value - 1, 0)); }
            if (event.key === "Enter") { event.preventDefault(); selectResult(selected); }
          }} placeholder="Buscar por serie o técnico…" className="h-14 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100" aria-label="Buscar activos o técnicos" />
          <kbd className="rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400">ESC</kbd>
        </div>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2" aria-live="polite">
          {loading ? <p className="px-3 py-8 text-center text-sm text-slate-500">Buscando en el inventario…</p>
            : error ? <p role="alert" className="px-3 py-8 text-center text-sm text-rose-700 dark:text-rose-300">{error}</p>
              : normalizedQuery.length < 2 ? <p className="px-3 py-8 text-center text-sm text-slate-500">Escribe al menos 2 caracteres para buscar.</p>
                : results.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">Sin resultados para esta búsqueda.</p>
                  : results.map((result, index) => <button key={`${result.kind}-${result.href}`} type="button" className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors duration-150 ${index === selected ? "bg-blue-50 text-blue-950 dark:bg-slate-800 dark:text-white" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"}`} onMouseEnter={() => setSelected(index)} onClick={() => selectResult(index)}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{result.kind === "Activo" ? <Boxes size={16} /> : <UserRound size={16} />}</span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{result.label}</strong><small className="block truncate text-xs text-slate-500 dark:text-slate-400">{result.detail}</small></span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{result.kind}</span>
                  </button>)}
        </div>
        <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400"><span>ACTIVOS{session?.user.role === "ADMIN" ? " · TÉCNICOS" : ""}</span><span>↑ ↓ navegar · ↵ abrir</span></footer>
      </section>
    </div>}
  </>;
}