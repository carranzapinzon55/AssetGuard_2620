"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, RotateCcw, Search } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, CopyButton, DataTable, Dialog, EmptyState, Feedback, FormField, LoadingRows, PageTitle, PaginationControls, SelectInput, StatusTag } from "@/components/workspace/ui";
import { MY_LOAN_HISTORY, RETURN_LOAN } from "@/lib/operations";
import { errorMessage, queryGraphQL, type LoanItem } from "@/lib/workspace";

type HistoryResult = { myLoanHistory: LoanItem[] };

export function HistoryPage() {
  const { session } = useAuth();
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [conditionFilter, setConditionFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("REQUEST_DATE_DESC");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [returning, setReturning] = useState<LoanItem | null>(null);
  const [returnCondition, setReturnCondition] = useState<"GOOD" | "DAMAGED" | "LOST">("GOOD");
  const [damageDescription, setDamageDescription] = useState("");
  const [selectedRejection, setSelectedRejection] = useState<LoanItem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    queryGraphQL<HistoryResult>(MY_LOAN_HISTORY)
      .then((result) => { if (active) setLoans(result.myLoanHistory); })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token]);

  const filtered = useMemo(() => loans.filter((loan) => {
    const text = `${loan.asset.serialNumber} ${loan.asset.model ?? ""}`.toLowerCase();
    const matchesText = text.includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === "ALL" || loan.status === statusFilter;
    const matchesCondition = conditionFilter === "ALL" || loan.returnCondition === conditionFilter;
    return matchesText && matchesStatus && matchesCondition;
  }), [loans, query, statusFilter, conditionFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "REQUEST_DATE_DESC":
          return (b.requestDate ?? "").localeCompare(a.requestDate ?? "");
        case "REQUEST_DATE_ASC":
          return (a.requestDate ?? "").localeCompare(b.requestDate ?? "");
        case "DUE_DATE_ASC":
          return (a.dueLocalDate ?? "").localeCompare(b.dueLocalDate ?? "");
        case "DUE_DATE_DESC":
          return (b.dueLocalDate ?? "").localeCompare(a.dueLocalDate ?? "");
        case "DELAY_DAYS_DESC":
          return (b.delayDays ?? 0) - (a.delayDays ?? 0);
        case "ASSET_ASC":
          return (a.asset.model || a.asset.serialNumber).localeCompare(b.asset.model || b.asset.serialNumber);
        default:
          return 0;
      }
    });
  }, [filtered, sortBy]);

  const visible = sorted.slice(page * pageSize, (page + 1) * pageSize);

  async function submitReturn() {
    if (!returning) return;
    if (returnCondition === "DAMAGED" && damageDescription.trim().length < 10) {
      setError("La descripción de la falla debe tener al menos 10 caracteres.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await queryGraphQL<{ returnLoan: { id: string } }>(RETURN_LOAN, {
        input: {
          loanId: returning.id,
          condition: returnCondition,
          damageDescription: (returnCondition === "DAMAGED" || returnCondition === "LOST") && damageDescription.trim() ? damageDescription.trim() : null,
        },
      });
      const result = await queryGraphQL<HistoryResult>(MY_LOAN_HISTORY);
      setLoans(result.myLoanHistory);
      setReturning(null);
      setDamageDescription("");
      setPage(0);
      setSuccess(`Devolución registrada para ${returning.asset.serialNumber}.`);
      window.dispatchEvent(new CustomEvent("loans-updated"));
      if (returnCondition === "LOST") {
        window.dispatchEvent(new CustomEvent("lost-reports-updated"));
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="work-page">
      <PageTitle eyebrow="CUSTODIAS · TÉCNICO" title="Mis custodias" description="Historial personal de solicitudes, entregas y devoluciones vinculadas a tu cuenta." />
      <Feedback error={error} success={success} />
      <section className="work-section"><div className="section-toolbar"><div className="toolbar-title"><Activity size={17} /><strong>Movimientos personales</strong><span>{sorted.length}</span></div><div className="toolbar-controls"><label className="search-control"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Buscar activo o serie" aria-label="Buscar activo o serie" /></label><SelectInput className="filter-select" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }} aria-label="Filtrar por estado"><option value="ALL">Todos los estados</option><option value="PENDING">Pendiente</option><option value="APPROVED">Aprobado</option><option value="REJECTED">Rechazado</option><option value="RETURNED">Devuelto</option></SelectInput><SelectInput className="filter-select" value={conditionFilter} onChange={(event) => { setConditionFilter(event.target.value); setPage(0); }} aria-label="Filtrar por condición"><option value="ALL">Todas las condiciones</option><option value="GOOD">En buen estado</option><option value="DAMAGED">Dañado</option><option value="LOST">No localizado</option></SelectInput><SelectInput className="filter-select" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(0); }} aria-label="Ordenar custodias por"><option value="REQUEST_DATE_DESC">Fecha solicitud (Reciente)</option><option value="REQUEST_DATE_ASC">Fecha solicitud (Antigua)</option><option value="DUE_DATE_ASC">Vencimiento (Próximo)</option><option value="DUE_DATE_DESC">Vencimiento (Lejano)</option><option value="DELAY_DAYS_DESC">Días de mora (Mayor)</option><option value="ASSET_ASC">Activo (A-Z)</option></SelectInput></div></div>
        {loading ? <LoadingRows label="Cargando historial" /> : sorted.length === 0 ? <EmptyState title={loans.length === 0 ? "Sin custodias registradas" : "Sin coincidencias"} detail={loans.length === 0 ? "Actualmente no hay solicitudes de préstamo pendientes ni activas." : "No se encontraron movimientos para estos filtros."} /> : <DataTable headings={["Activo", "Solicitud", "Vencimiento", "Devolución", "Días de mora", "Condición", "Estado", "Acciones"]}>{visible.map((loan) => <tr key={loan.id}><td><span className="copy-value"><span className="table-primary mono-cell telemetry-value font-mono">{loan.asset.serialNumber}</span><CopyButton text={loan.asset.serialNumber} label={`Copiar serie ${loan.asset.serialNumber}`} /></span><small className="table-secondary">{loan.asset.model || "Activo"}</small><small className="table-secondary">Estado del activo: <StatusTag value={loan.asset.status} /></small><small className="table-secondary id-copy-line font-mono">ID <span>{loan.id}</span><CopyButton className="inline-copy" text={loan.id} label={`Copiar ID del préstamo de ${loan.asset.serialNumber}`} /></small></td><td className="telemetry-value font-mono">{loan.requestDate?.slice(0, 10) ?? "—"}</td><td className="telemetry-value font-mono">{loan.dueLocalDate ?? "—"}</td><td className="telemetry-value font-mono">{loan.returnDateTime?.slice(0, 10) ?? "—"}</td><td className="telemetry-value font-mono">{loan.delayDays != null ? <span className={loan.delayDays > 0 ? "overdue-copy" : ""}>{loan.delayDays}</span> : "—"}</td><td>{loan.returnCondition ? <StatusTag value={loan.returnCondition} /> : "—"}</td><td><StatusTag value={loan.status} /></td><td>{loan.status === "APPROVED" ? <Button variant="secondary" className="history-return-button" type="button" onClick={() => { setReturnCondition("GOOD"); setReturning(loan); }}><RotateCcw size={14} /> Devolver</Button> : loan.status === "REJECTED" ? <button type="button" className="view-reason-button" onClick={() => setSelectedRejection(loan)}>Ver motivo</button> : "—"}</td></tr>)}</DataTable>}
        <PaginationControls currentPage={page} totalItems={sorted.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(0); }} loading={loading} itemLabel="movimientos" />
      </section>
      {returning && <Dialog open title="Registrar devolución" eyebrow={`CUSTODIA · ${returning.asset.serialNumber}`} onClose={() => { if (!saving) setReturning(null); }}>
        <div className="work-form">
          <FormField label="Condición al devolver">
            <SelectInput value={returnCondition} onChange={(event) => setReturnCondition(event.target.value as typeof returnCondition)}>
              <option value="GOOD">En buen estado</option><option value="DAMAGED">Dañado</option><option value="LOST">No localizado</option>
            </SelectInput>
          </FormField>
          {(returnCondition === "DAMAGED" || returnCondition === "LOST") && (
            <div className="traceability-info-banner" style={{ background: "var(--surface-muted, #f8fafc)", border: "1px solid var(--border-color, #e2e8f0)", borderRadius: "6px", padding: "0.75rem", fontSize: "0.8125rem", lineHeight: "1.4" }}>
              <span style={{ fontWeight: 600, display: "block", marginBottom: "0.25rem", color: "var(--text-primary, #0f172a)" }}>
                Trazabilidad de responsabilidad:
              </span>
              {returning.user ? (
                <p style={{ margin: 0, color: "var(--text-secondary, #475569)" }}>
                  Responsable identificado automáticamente: <strong>{returning.user.fullName || returning.user.email}</strong> ({returning.user.email}) · Préstamo #{returning.id}
                </p>
              ) : (
                <p style={{ margin: 0, color: "var(--text-secondary, #475569)" }}>
                  Sin préstamo previo registrado: la novedad quedará asignada al usuario operativo que registra el reporte.
                </p>
              )}
            </div>
          )}
          {returnCondition === "DAMAGED" && (
            <FormField label="Descripción de la falla (obligatorio)">
              <textarea
                className="work-input work-textarea"
                value={damageDescription}
                onChange={(event) => setDamageDescription(event.target.value)}
                placeholder="Describe la falla, golpe, daño o avería presentada en el equipo..."
                rows={3}
                minLength={10}
                required
              />
              <small className={`character-counter ${damageDescription.trim().length >= 10 ? "met" : ""}`}>
                {damageDescription.length} caracteres · Mínimo 10
              </small>
            </FormField>
          )}
          {returnCondition === "LOST" && (
            <FormField label="Observaciones sobre la pérdida (opcional)">
              <textarea
                className="work-input work-textarea"
                value={damageDescription}
                onChange={(event) => setDamageDescription(event.target.value)}
                placeholder="Indica circunstancias del extravío o detalles relevantes..."
                rows={2}
              />
            </FormField>
          )}
          <p className="form-hint">{returnCondition === "DAMAGED" ? "El activo se marcará para mantenimiento y se abrirá una orden técnica pendiente vinculada a tu custodia." : returnCondition === "LOST" ? "La devolución se registrará como activo no localizado y se generará un reporte formal vinculado a tu custodia." : "El activo quedará disponible al registrar su devolución."}</p>
          <div className="modal-actions"><Button variant="secondary" type="button" disabled={saving} onClick={() => setReturning(null)}>Cancelar</Button><Button loading={saving} onClick={() => void submitReturn()}>Registrar devolución</Button></div>
        </div>
      </Dialog>}
      {selectedRejection && <Dialog open title="Motivo del rechazo" eyebrow={`SOLICITUD · ${selectedRejection.asset.serialNumber}`} onClose={() => setSelectedRejection(null)}><p className="legal-notice-copy">{selectedRejection.rejectionReason?.trim() || "El inspector no registró una justificación para esta solicitud."}</p></Dialog>}
    </div>
  );
}