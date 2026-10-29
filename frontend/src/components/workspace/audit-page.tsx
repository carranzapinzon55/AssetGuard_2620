"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Filter, RotateCcw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, DataTable, EmptyState, Feedback, FormField, LoadingRows, PageTitle, SelectInput, StatusTag, TextInput } from "@/components/workspace/ui";
import { AUDIT_QUERY } from "@/lib/operations";
import { errorMessage, queryGraphQL, type LoanItem } from "@/lib/workspace";

type AuditResult = { auditLogs: { loans: LoanItem[]; totalElements: number; page: number; limit: number; totalPages: number } };

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
          <FormField label="Estado"><SelectInput value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Todos</option><option value="PENDING">PENDING</option><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option><option value="RETURNED">RETURNED</option></SelectInput></FormField>
          <div className="filter-actions"><Button type="submit"><Filter size={15} /> Aplicar</Button><Button type="button" variant="quiet" onClick={resetFilters}><RotateCcw size={15} /> Limpiar</Button></div>
        </form>
      </section>
      <section className="work-section"><div className="section-toolbar"><div className="toolbar-title"><ShieldCheck size={17} /><strong>Movimientos registrados</strong><span>{data?.totalElements ?? 0}</span></div><span className="toolbar-note">PÁGINA {page + 1} DE {Math.max(data?.totalPages ?? 1, 1)}</span></div>
        {loading ? <LoadingRows label="Consultando auditoría" /> : !data?.loans.length ? <EmptyState title="No hay movimientos" detail="Cambia los filtros para consultar otros registros." /> : <DataTable headings={["Fecha", "Activo", "Técnico", "Estado", "Vencimiento", "Devolución", "Inspector"]}>{data.loans.map((loan) => <tr key={loan.id}><td>{loan.requestDate?.replace("T", " ").slice(0, 16) ?? "—"}</td><td><span className="table-primary mono-cell">{loan.asset.serialNumber}</span><small className="table-secondary">{loan.asset.model}</small></td><td>{loan.user?.fullName || loan.user?.email || "—"}</td><td><StatusTag value={loan.status} /></td><td>{loan.dueLocalDate || "—"}</td><td>{loan.returnDateTime?.slice(0, 10) ?? "—"}{loan.returnCondition && <small className="table-secondary">{loan.returnCondition}</small>}</td><td>{loan.inspector?.fullName || "—"}</td></tr>)}</DataTable>}
        <div className="table-footer"><span>{data?.totalElements ?? 0} resultados</span><div className="pagination"><button type="button" className="table-action" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>{page + 1} / {Math.max(data?.totalPages ?? 1, 1)}</span><button type="button" className="table-action" disabled={loading || page + 1 >= (data?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)} aria-label="Página siguiente"><ChevronRight size={16} /></button></div></div>
      </section>
    </div>
  );
}