"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FileSpreadsheet, FileText, Filter, RotateCcw, Search, ShieldCheck } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "@/components/auth-provider";
import { Combobox } from "@/components/workspace/combobox";
import { AUDIT_QUERY, USERS_QUERY } from "@/lib/operations";
import {
  Button,
  CopyButton,
  DataTable,
  Dialog,
  DonutChart,
  EmptyState,
  Feedback,
  FormField,
  HorizontalBarChart,
  InsightCard,
  LoadingRows,
  ModalKpiGrid,
  PageTitle,
  PaginationControls,
  SelectInput,
  StatusTag,
  TextInput,
} from "@/components/workspace/ui";
import { statusLabel } from "@/lib/localization";
import { matchesSearch } from "@/lib/utils";
import { errorMessage, queryGraphQL, type LoanItem, type UserItem } from "@/lib/workspace";

type AuditResult = { auditLogs: { loans: LoanItem[]; totalElements: number; page: number; limit: number; totalPages: number } };
type UsersResult = { users: UserItem[] };
const allowedLimits = [10, 25, 50] as const;

function getLocalTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const auditExportHeaders = ["Fecha", "Activo", "Técnico", "Días de Mora", "Condición", "Estado"];

function getAuditExportRows(loans: LoanItem[]) {
  return loans.map((loan) => [
    loan.requestDate?.replace("T", " ").slice(0, 16) ?? "",
    loan.asset.serialNumber,
    loan.user?.fullName || loan.user?.email || "",
    loan.delayDays ?? "",
    loan.returnCondition ? statusLabel(loan.returnCondition) : "",
    statusLabel(loan.status),
  ]);
}

export function AuditPage() {
  const { session } = useAuth();
  const [technicians, setTechnicians] = useState<UserItem[]>([]);
  const [filters, setFilters] = useState({ serialNumber: "", technicianId: "", startDate: "", endDate: "", status: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState<(typeof allowedLimits)[number]>(10);
  const [auditSortBy, setAuditSortBy] = useState("DATE_DESC");
  const [data, setData] = useState<AuditResult["auditLogs"] | null>(null);
  const [allLoans, setAllLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [auditModalKey, setAuditModalKey] = useState<"ALL" | "PAGE" | "ACTIVE" | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalStatusFilter, setModalStatusFilter] = useState("ALL");
  const today = getLocalTodayIso();
  const endDateRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);

  const sortedLoans = useMemo(() => {
    if (!data?.loans) return [];
    return [...data.loans].sort((a, b) => {
      switch (auditSortBy) {
        case "DATE_DESC":
          return (b.requestDate ?? "").localeCompare(a.requestDate ?? "");
        case "DATE_ASC":
          return (a.requestDate ?? "").localeCompare(b.requestDate ?? "");
        case "DELAY_DESC":
          return (b.delayDays ?? 0) - (a.delayDays ?? 0);
        case "DELAY_ASC":
          return (a.delayDays ?? 0) - (b.delayDays ?? 0);
        case "ASSET_ASC":
          return a.asset.serialNumber.localeCompare(b.asset.serialNumber);
        default:
          return 0;
      }
    });
  }, [data?.loans, auditSortBy]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    queryGraphQL<UsersResult>(USERS_QUERY, { limit: 5000 })
      .then((result) => {
        if (active) {
          const technicianUsers = (result.users || [])
            .filter((user) => user.role === "TECHNICIAN")
            .sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email));
          setTechnicians(technicianUsers);
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(requestError));
      });
    return () => { active = false; };
  }, [session]);

  const technicianOptions = useMemo(() => [
    { value: "", label: "Todos los técnicos" },
    ...technicians.map((technician) => ({
      value: String(technician.id),
      label: technician.fullName ? `${technician.fullName} (${technician.email})` : technician.email,
    })),
  ], [technicians]);

  useEffect(() => {
    let active = true;
    queryGraphQL<AuditResult>(AUDIT_QUERY, {
      serialNumber: applied.serialNumber.trim() || null,
      technicianId: applied.technicianId ? Number(applied.technicianId) : null,
      startDate: applied.startDate || null,
      endDate: applied.endDate || null,
      status: applied.status || null,
      page,
      limit,
    }).then((result) => { if (active) { setData(result.auditLogs); setError(""); } })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token, applied, page, limit]);

  useEffect(() => {
    let active = true;
    queryGraphQL<AuditResult>(AUDIT_QUERY, {
      serialNumber: applied.serialNumber.trim() || null,
      technicianId: applied.technicianId ? Number(applied.technicianId) : null,
      startDate: applied.startDate || null,
      endDate: applied.endDate || null,
      status: applied.status || null,
      page: 0,
      limit: 5000,
    }).then((result) => {
      if (active) setAllLoans(result.auditLogs.loans);
    }).catch(() => {
      // Silencioso; usa data.loans como respaldo
    });
    return () => { active = false; };
  }, [session?.token, applied]);

  function openAuditModal(key: "ALL" | "PAGE" | "ACTIVE") {
    setAuditModalKey(key);
    setModalSearch("");
    setModalStatusFilter("ALL");
  }

  const modalBaseLoans = useMemo(() => {
    const pool = allLoans.length > 0 ? allLoans : (data?.loans ?? []);
    if (auditModalKey === "PAGE") {
      return data?.loans ?? [];
    }
    if (auditModalKey === "ACTIVE") {
      return pool.filter((loan) => loan.status === "APPROVED");
    }
    return pool;
  }, [auditModalKey, allLoans, data?.loans]);

  const modalApprovedCount = useMemo(() => modalBaseLoans.filter((l) => l.status === "APPROVED").length, [modalBaseLoans]);
  const modalReturnedCount = useMemo(() => modalBaseLoans.filter((l) => l.status === "RETURNED").length, [modalBaseLoans]);
  const modalPendingCount = useMemo(() => modalBaseLoans.filter((l) => l.status === "PENDING").length, [modalBaseLoans]);
  const modalRejectedCount = useMemo(() => modalBaseLoans.filter((l) => l.status === "REJECTED").length, [modalBaseLoans]);
  const modalApprovalRate = modalBaseLoans.length > 0 ? ((modalApprovedCount / modalBaseLoans.length) * 100).toFixed(0) : "0";
  const modalReturnRate = modalBaseLoans.length > 0 ? ((modalReturnedCount / modalBaseLoans.length) * 100).toFixed(0) : "0";
  const modalUniqueTechniciansCount = useMemo(() => {
    return new Set(modalBaseLoans.map((l) => l.user?.id || l.user?.email).filter(Boolean)).size;
  }, [modalBaseLoans]);

  const modalTechnicianCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const loan of modalBaseLoans) {
      const name = loan.user?.fullName || loan.user?.email || "Sin asignar";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({
        label,
        value,
        percentage: modalBaseLoans.length > 0 ? (value / modalBaseLoans.length) * 100 : 0,
        formattedValue: `${value} mov.`,
        color: "#0f766e",
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [modalBaseLoans]);

  const modalFilteredLoans = useMemo(() => {
    return modalBaseLoans.filter((loan) => {
      if (modalStatusFilter !== "ALL" && loan.status !== modalStatusFilter) return false;
      const term = modalSearch.trim();
      if (!term) return true;
      const haystack = `${loan.asset.serialNumber} ${loan.asset.model} ${loan.user?.fullName ?? ""} ${loan.user?.email ?? ""} ${loan.status} ${loan.id}`;
      return matchesSearch(haystack, term);
    });
  }, [modalBaseLoans, modalStatusFilter, modalSearch]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentToday = getLocalTodayIso();
    if ((filters.startDate && filters.startDate > currentToday) || (filters.endDate && filters.endDate > currentToday)) {
      setError("Las fechas de auditoría no pueden ser posteriores a hoy.");
      return;
    }
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      setError("La fecha 'Desde' no puede ser posterior a 'Hasta'.");
      return;
    }
    setError("");
    setLoading(true);
    setPage(0);
    setApplied(filters);
  }

  function resetFilters() {
    const empty = { serialNumber: "", technicianId: "", startDate: "", endDate: "", status: "" };
    setError("");
    setLoading(true);
    setFilters(empty);
    setApplied(empty);
    setPage(0);
  }

  function handleExportExcel() {
    if (!data?.loans.length) return;
    const worksheet = XLSX.utils.aoa_to_sheet([auditExportHeaders, ...getAuditExportRows(data.loans)]);
    worksheet["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 16 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Auditoría");
    XLSX.writeFile(workbook, `assetguard-auditoria-${getLocalTodayIso()}.xlsx`);
  }

  function handleExportPDF() {
    if (!data?.loans.length) return;
    const document = new jsPDF({ orientation: "landscape" });
    autoTable(document, {
      head: [auditExportHeaders],
      body: getAuditExportRows(data.loans).map((row) => row.map(String)),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 75, 58] },
      margin: { left: 12, right: 12 },
    });
    document.save(`assetguard-auditoria-${getLocalTodayIso()}.pdf`);
  }

  return (
    <div className="work-page">
      <PageTitle eyebrow="CONTROL · TRAZABILIDAD" title="Auditoría global" description="Filtra los movimientos de custodia por activo, técnico, estado y periodo." />
      <Feedback error={error} />
      <section className="insight-grid" aria-label="Indicadores de auditoría">
        <InsightCard
          label="MOVIMIENTOS ENCONTRADOS"
          value={data?.totalElements ?? 0}
          description="Resultados del periodo y filtros aplicados."
          progress={data?.totalElements ? Math.min((data.totalElements / 50) * 100, 100) : 0}
          detail={`La consulta actual contiene ${data?.totalElements ?? 0} movimientos.`}
          onClick={() => openAuditModal("ALL")}
        />
        <InsightCard
          label="REGISTROS EN PÁGINA"
          value={data?.loans.length ?? 0}
          description="Movimientos mostrados en esta página."
          progress={((data?.loans.length ?? 0) / limit) * 100}
          detail={`${data?.loans.length ?? 0} de hasta ${limit} registros se muestran en la página actual.`}
          onClick={() => openAuditModal("PAGE")}
        />
        <InsightCard
          label="PRÉSTAMOS ACTIVOS"
          value={data?.loans.filter((loan) => loan.status === "APPROVED").length ?? 0}
          description="Préstamos aprobados en esta página."
          progress={((data?.loans.filter((loan) => loan.status === "APPROVED").length ?? 0) / limit) * 100}
          detail="Conteo de préstamos aprobados dentro de la página visible, sujeto a filtros."
          onClick={() => openAuditModal("ACTIVE")}
        />
      </section>
      <section className="work-section">
        <form className="audit-filter-grid" onSubmit={applyFilters}>
          <FormField label="Número de serie"><TextInput value={filters.serialNumber} onChange={(event) => setFilters({ ...filters, serialNumber: event.target.value })} placeholder="AG-0000" /></FormField>
          <FormField label="Técnico">
            <Combobox
              value={filters.technicianId}
              onValueChange={(technicianId) => setFilters({ ...filters, technicianId })}
              options={technicianOptions}
              placeholder="Todos los técnicos"
              searchPlaceholder="Buscar técnico"
              emptyMessage="No se encontraron técnicos."
            />
          </FormField>
          <FormField label="Desde"><TextInput type="date" max={filters.endDate && filters.endDate < today ? filters.endDate : today} value={filters.startDate} onChange={(event) => { setFilters({ ...filters, startDate: event.target.value }); if (event.target.value) endDateRef.current?.focus(); }} /></FormField>
          <FormField label="Hasta"><TextInput inputRef={endDateRef} type="date" min={filters.startDate || undefined} max={today} value={filters.endDate} onChange={(event) => { setFilters({ ...filters, endDate: event.target.value }); if (event.target.value) statusRef.current?.focus(); }} /></FormField>
          <FormField label="Estado"><SelectInput selectRef={statusRef} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Todos</option><option value="PENDING">Pendiente</option><option value="APPROVED">Aprobado</option><option value="REJECTED">Rechazado</option><option value="RETURNED">Devuelto</option></SelectInput></FormField>
          <div className="filter-actions"><Button type="submit"><Filter size={15} /> Aplicar</Button><Button type="button" variant="quiet" onClick={resetFilters}><RotateCcw size={15} /> Limpiar</Button></div>
        </form>
      </section>
      <section className="work-section"><div className="section-toolbar"><div className="toolbar-title"><ShieldCheck size={17} /><strong>Movimientos registrados</strong><span>{data?.totalElements ?? 0}</span></div><div className="audit-export-actions"><SelectInput className="filter-select" value={auditSortBy} onChange={(event) => setAuditSortBy(event.target.value)} aria-label="Ordenar registros de auditoría"><option value="DATE_DESC">Fecha solicitud (Reciente)</option><option value="DATE_ASC">Fecha solicitud (Antigua)</option><option value="DELAY_DESC">Días de mora (Mayor)</option><option value="DELAY_ASC">Días de mora (Menor)</option><option value="ASSET_ASC">Activo (A-Z)</option></SelectInput><span className="toolbar-note">PÁGINA {page + 1} DE {Math.max(data?.totalPages ?? 1, 1)}</span><Button variant="secondary" onClick={handleExportExcel} disabled={loading || !data?.loans.length}><FileSpreadsheet size={14} /> Excel</Button><Button variant="secondary" onClick={handleExportPDF} disabled={loading || !data?.loans.length}><FileText size={14} /> PDF</Button></div></div>
        {loading ? <LoadingRows label="Consultando auditoría" /> : !data?.loans.length ? <EmptyState title="No hay movimientos" detail="Cambia los filtros para consultar otros registros." /> : <DataTable headings={["Fecha", "Activo", "Técnico", "Estado", "Vencimiento", "Devolución", "Inspector"]}>{sortedLoans.map((loan) => <tr key={loan.id}><td className="telemetry-value font-mono">{loan.requestDate?.replace("T", " ").slice(0, 16) ?? "—"}</td><td><span className="copy-value"><span className="table-primary mono-cell telemetry-value font-mono">{loan.asset.serialNumber}</span><CopyButton text={loan.asset.serialNumber} label={`Copiar serie ${loan.asset.serialNumber}`} /></span><small className="table-secondary">{loan.asset.model}</small><small className="table-secondary id-copy-line font-mono">ID <span>{loan.id}</span><CopyButton className="inline-copy" text={loan.id} label={`Copiar ID del préstamo de ${loan.asset.serialNumber}`} /></small></td><td>{loan.user?.fullName || loan.user?.email || "—"}</td><td><StatusTag value={loan.status} /></td><td className="telemetry-value font-mono">{loan.dueLocalDate || "—"}</td><td className="telemetry-value font-mono">{loan.returnDateTime?.slice(0, 10) ?? "—"}{loan.returnCondition && <small className="table-secondary"><StatusTag value={loan.returnCondition} /></small>}</td><td>{loan.inspector?.fullName || "—"}</td></tr>)}</DataTable>}
        <PaginationControls
          currentPage={page}
          totalItems={data?.totalElements ?? 0}
          pageSize={limit}
          loading={loading}
          onPageChange={(nextPage) => { setLoading(true); setPage(nextPage); }}
          onPageSizeChange={(nextLimit) => { setLoading(true); setLimit(nextLimit as (typeof allowedLimits)[number]); setPage(0); }}
          itemLabel="movimientos"
        />
      </section>

      {auditModalKey && (
        <Dialog
          open
          title={
            auditModalKey === "ALL"
              ? "Auditoría: Desglose global de movimientos"
              : auditModalKey === "PAGE"
              ? "Auditoría: Movimientos en página actual"
              : "Auditoría: Préstamos activos en campo"
          }
          eyebrow={
            auditModalKey === "ALL"
              ? "AUDITORÍA · RESULTADOS"
              : auditModalKey === "PAGE"
              ? "AUDITORÍA · PÁGINA"
              : "AUDITORÍA · PRÉSTAMOS ACTIVOS"
          }
          onClose={() => setAuditModalKey(null)}
        >
          <div className="space-y-4">
            <ModalKpiGrid
              items={[
                {
                  label: "Aprobados",
                  value: `${modalApprovedCount} (${modalApprovalRate}%)`,
                  sub: "Tasa de aprobación",
                },
                {
                  label: "Devueltos",
                  value: `${modalReturnedCount} (${modalReturnRate}%)`,
                  sub: "Retornados a bodega",
                },
                {
                  label: "Flujo activo",
                  value: `${modalPendingCount} pend. / ${modalRejectedCount} rech.`,
                  sub: "Pendientes vs rechazados",
                },
                {
                  label: "Técnicos",
                  value: `${modalUniqueTechniciansCount} técnicos`,
                  sub: "Con movimientos en muestra",
                },
              ]}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="modal-chart-card mb-0">
                <div className="modal-chart-title">
                  <span>Distribución por estado</span>
                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    {modalBaseLoans.length} mov.
                  </span>
                </div>
                <DonutChart
                  segments={[
                    {
                      label: "Aprobados / En campo",
                      value: modalApprovedCount,
                      color: "#10b981",
                      formattedValue: `${modalApprovedCount} mov.`,
                    },
                    {
                      label: "Devueltos a bodega",
                      value: modalReturnedCount,
                      color: "#3b82f6",
                      formattedValue: `${modalReturnedCount} mov.`,
                    },
                    {
                      label: "Pendientes",
                      value: modalPendingCount,
                      color: "#f59e0b",
                      formattedValue: `${modalPendingCount} mov.`,
                    },
                    {
                      label: "Rechazados",
                      value: modalRejectedCount,
                      color: "#ef4444",
                      formattedValue: `${modalRejectedCount} mov.`,
                    },
                  ]}
                  centerValue={`${modalBaseLoans.length}`}
                  centerLabel="TOTAL"
                />
              </div>

              <div className="modal-chart-card mb-0">
                <div className="modal-chart-title">
                  <span>Top técnicos con movimientos</span>
                  <span className="font-mono text-xs text-slate-500">
                    {modalTechnicianCounts.length} registrados
                  </span>
                </div>
                <HorizontalBarChart items={modalTechnicianCounts} maxCount={5} />
              </div>
            </div>

            <div>
              <div className="modal-table-controls">
                <label className="search-control">
                  <Search size={14} />
                  <input
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Buscar por serie, modelo o técnico..."
                    aria-label="Buscar en movimientos de auditoría"
                  />
                </label>
                <SelectInput
                  className="filter-select w-44 text-xs"
                  value={modalStatusFilter}
                  onChange={(e) => setModalStatusFilter(e.target.value)}
                  aria-label="Filtrar movimientos por estado"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="APPROVED">Aprobados</option>
                  <option value="RETURNED">Devueltos</option>
                  <option value="PENDING">Pendientes</option>
                  <option value="REJECTED">Rechazados</option>
                </SelectInput>
                <span className="text-[11px] font-mono text-slate-500">
                  {modalFilteredLoans.length} de {modalBaseLoans.length} registros
                </span>
              </div>

              <div className="metric-breakdown-table-wrap">
                <table className="metric-breakdown-table">
                  <thead>
                    <tr>
                      <th className="whitespace-nowrap">Fecha</th>
                      <th className="whitespace-nowrap">Serie / Activo</th>
                      <th>Técnico</th>
                      <th className="whitespace-nowrap">Estado</th>
                      <th className="whitespace-nowrap">Vencimiento / Devolución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalFilteredLoans.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-400 text-xs">
                          No se encontraron movimientos que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      modalFilteredLoans.map((loan) => (
                        <tr key={loan.id}>
                          <td className="font-mono text-slate-500 whitespace-nowrap">
                            {loan.requestDate?.replace("T", " ").slice(0, 16) ?? "—"}
                          </td>
                          <td className="whitespace-nowrap">
                            <span className="flex items-center gap-1 font-mono font-semibold">
                              {loan.asset.serialNumber}
                              <CopyButton
                                text={loan.asset.serialNumber}
                                label={`Copiar serie ${loan.asset.serialNumber}`}
                              />
                            </span>
                            <small className="text-slate-500 block text-[10px]">
                              {loan.asset.model}
                            </small>
                          </td>
                          <td className="whitespace-nowrap">
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {loan.user?.fullName || "—"}
                            </span>
                            {loan.user?.email && (
                              <small className="text-slate-400 block text-[10px] font-mono">
                                {loan.user.email}
                              </small>
                            )}
                          </td>
                          <td className="whitespace-nowrap">
                            <StatusTag value={loan.status} />
                            {loan.returnCondition && (
                              <span className="ml-1.5 inline-block scale-90">
                                <StatusTag value={loan.returnCondition} />
                              </span>
                            )}
                          </td>
                          <td className="font-mono text-slate-500 whitespace-nowrap">
                            {loan.returnDateTime
                              ? `Dev: ${loan.returnDateTime.slice(0, 10)}`
                              : loan.dueLocalDate
                              ? `Vence: ${loan.dueLocalDate}`
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}