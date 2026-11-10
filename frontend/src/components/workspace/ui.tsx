import { useEffect, useRef, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { statusLabel } from "@/lib/localization";

export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, onEscape]);
}

export function useModalFocus(active: boolean) {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !dialogRef.current) return;
    const dialog = dialogRef.current;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    function getFocusableElements() {
      return Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0);
    }

    function trapTab(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusableElements = getFocusableElements();
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener("keydown", trapTab);
    (getFocusableElements()[0] ?? dialog).focus();
    return () => {
      dialog.removeEventListener("keydown", trapTab);
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    };
  }, [active]);

  return dialogRef;
}

export function PageTitle({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="work-page-heading">
      <div><p className="work-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
      {action && <div className="work-heading-action">{action}</div>}
    </header>
  );
}

export function Button({ children, variant = "primary", loading = false, className = "", disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger"; loading?: boolean }) {
  return (
    <button className={`work-button ${variant} ${className}`.trim()} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function StatusTag({ value }: { value?: string | null }) {
  const normalized = value?.toUpperCase() ?? "UNKNOWN";
  const category = normalized.includes("AVAILABLE") || normalized === "GOOD" || normalized === "ACTIVE" || normalized === "APPROVED"
    ? "good"
    : normalized === "UNDER_MAINTENANCE" || normalized === "MAINTENANCE" || normalized === "PENDING"
      ? "maintenance"
      : normalized === "ON_LOAN" || normalized === "LOANED" || normalized === "REJECTED" || normalized === "LOST" || normalized === "INACTIVE" || normalized === "OVERDUE" || normalized === "PAST_DUE"
        ? "bad"
        : "neutral";
  return <span className={`status-tag ${category}`}>{statusLabel(normalized)}</span>;
}

export function Feedback({ error, success }: { error?: string; success?: string }) {
  if (error) return <div className="work-feedback error" role="alert"><AlertCircle size={16} />{error}</div>;
  if (success) return <div className="work-feedback success" role="status"><CheckCircle2 size={16} />{success}</div>;
  return null;
}

export function LoadingRows({ label = "Cargando datos" }: { label?: string }) {
  return (
    <div className="loading-rows" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="w-full space-y-3 px-4 py-4" aria-hidden="true">
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="grid grid-cols-4 gap-4 animate-pulse border-b border-slate-100 py-3 dark:border-slate-700">
            <span className="h-3 rounded-sm bg-slate-200 dark:bg-slate-700" />
            <span className="h-3 rounded-sm bg-slate-100 dark:bg-slate-800" />
            <span className="h-3 rounded-sm bg-slate-100 dark:bg-slate-800" />
            <span className="h-3 rounded-sm bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-state-mark" /><strong>{title}</strong><p>{detail}</p></div>;
}

export function DataTable({ children, headings }: { children: ReactNode; headings: string[] }) {
  return (
    <div className="table-scroll"><table className="data-table"><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
  );
}

export function FormField({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`work-field ${className}`}><span>{label}</span>{children}</label>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="work-input" {...props} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="work-input" {...props} />;
}

export function InlineActions({ children }: { children: ReactNode }) {
  return <div className="inline-actions">{children}</div>;
}