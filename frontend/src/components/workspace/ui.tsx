import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { statusLabel } from "@/lib/localization";

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
  const category = normalized.includes("AVAILABLE") || normalized === "RETURNED" || normalized === "GOOD" || normalized === "ACTIVE"
    ? "good"
    : normalized === "UNDER_MAINTENANCE" || normalized === "MAINTENANCE" || normalized === "PENDING"
      ? "maintenance"
      : normalized === "ON_LOAN" || normalized === "LOANED" || normalized === "REJECTED" || normalized === "LOST" || normalized === "INACTIVE"
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