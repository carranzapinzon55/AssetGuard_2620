"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Download, Filter, RotateCcw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, DataTable, EmptyState, Feedback, FormField, LoadingRows, PageTitle, SelectInput, StatusTag, TextInput } from "@/components/workspace/ui";
import { AUDIT_QUERY } from "@/lib/operations";
import { errorMessage, queryGraphQL, type LoanItem } from "@/lib/workspace";

type AuditResult = { auditLogs: { loans: LoanItem[]; totalElements: number; page: number; limit: number; totalPages: number } };

function csvField(value: string) {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function AuditPage() {
  const { session } = useAuth();
  const [filters, setFilters] = useState({ serialNumber: "", technicianId: "", startDate: "", endDate: "", status: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<AuditResult["auditLogs"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const limit = 20;

  useEffect(() => {
    let active = true;
    queryGraphQL<AuditResult>(AUDIT_QUERY, {
      serialNumber: applied.serialNumber.trim() || null,
      technicianId: applied.technicianId.trim() || null,
      startDate: applied.startDate || null,
      endDate: applied.endDate || null,
      status: applied.status || null,
      page,
      limit,
    }).then((result) => { if (active) { setData(result.auditLogs); setError(""); } })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token, applied, page]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPage(0); setApplied(filters);
  }

  function resetFilters() {
    const empty = { serialNumber: "", technicianId: "", startDate: "", endDate: "", status: "" };
    setFilters(empty); setApplied(empty); setPage(0);
  }

  function exportReport() {
    if (!data?.loans.length) return;
    const rows = [
      ["Fecha", "Activo", "Tecnico", "Estado", "Vencimiento", "Devolucion", "Condicion", "Inspector"],
      ...data.loans.map((loan) => [
        loan.requestDate?.replace("T", " ").slice(0, 16) ?? "",
        loan.asset.serialNumber,
        loan.user?.fullName || loan.user?.email || "",
        loan.status,
        loan.dueLocalDate || "",
        loan.returnDateTime?.slice(0, 10) ?? "",
        loan.returnCondition || "",
        loan.inspector?.fullName || "",
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `assetguard-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="work-page">
      <PageTitle eyebrow="CONTROL · TRAZABILIDAD" title="Auditoría global" description="Filtra los movimientos de custodia por activo, técnico, estado y periodo." />
      <Feedback error={error} />
      <section className="work-section">
        <form className="audit-filter-grid" onSubmit={applyFilters}>
          <FormField label="Número de serie"><TextInput value={filters.serialNumber} onChange={(event) => setFilters({ ...filters, serialNumber: event.target.value })} placeholder="AG-0000" /></FormField>
          <FormField label="ID de técnico"><TextInput inputMode="numeric" value={filters.technicianId} onChange={(event) => setFilters({ ...filters, technicianId: event.target.value })} placeholder="Cualquier técnico" /></FormField>
          <FormField label="Desde"><TextInput type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} /></FormField>
          <FormField label="Hasta"><TextInput type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} /></FormField>
          <FormField label="Estado"><SelectInput value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Todos</option><option value="PENDING">Pendiente</option><option value="APPROVED">Aprobado</option><option value="REJECTED">Rechazado</option><option value="RETURNED">Devuelto</option></SelectInput></FormField>
          <div className="filter-actions"><Button type="submit"><Filter size={15} /> Aplicar</Button><Button type="button" variant="quiet" onClick={resetFilters}><RotateCcw size={15} /> Limpiar</Button></div>
        </form>
      </section>
      <section className="work-section"><div className="section-toolbar"><div className="toolbar-title"><ShieldCheck size={17} /><strong>Movimientos registrados</strong><span>{data?.totalElements ?? 0}</span></div><div className="audit-export-actions"><span className="toolbar-note">PÁGINA {page + 1} DE {Math.max(data?.totalPages ?? 1, 1)}</span><Button variant="secondary" onClick={exportReport} disabled={loading || !data?.loans.length}><Download size={14} /> Exportar CSV</Button></div></div>
        {loading ? <LoadingRows label="Consultando auditoría" /> : !data?.loans.length ? <EmptyState title="No hay movimientos" detail="Cambia los filtros para consultar otros registros." /> : <DataTable headings={["Fecha", "Activo", "Técnico", "Estado", "Vencimiento", "Devolución", "Inspector"]}>{data.loans.map((loan) => <tr key={loan.id}><td>{loan.requestDate?.replace("T", " ").slice(0, 16) ?? "—"}</td><td><span className="table-primary mono-cell">{loan.asset.serialNumber}</span><small className="table-secondary">{loan.asset.model}</small></td><td>{loan.user?.fullName || loan.user?.email || "—"}</td><td><StatusTag value={loan.status} /></td><td>{loan.dueLocalDate || "—"}</td><td>{loan.returnDateTime?.slice(0, 10) ?? "—"}{loan.returnCondition && <small className="table-secondary"><StatusTag value={loan.returnCondition} /></small>}</td><td>{loan.inspector?.fullName || "—"}</td></tr>)}</DataTable>}
        <div className="table-footer"><span>{data?.totalElements ?? 0} resultados</span><div className="pagination"><button type="button" className="table-action" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>{page + 1} / {Math.max(data?.totalPages ?? 1, 1)}</span><button type="button" className="table-action" disabled={loading || page + 1 >= (data?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)} aria-label="Página siguiente"><ChevronRight size={16} /></button></div></div>
      </section>
    </div>
  );
}