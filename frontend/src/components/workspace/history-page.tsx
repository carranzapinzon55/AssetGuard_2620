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
  const [view, setView] = useState("ALL");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [returning, setReturning] = useState<LoanItem | null>(null);
  const [returnCondition, setReturnCondition] = useState<"GOOD" | "DAMAGED" | "LOST">("GOOD");
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
    const matchesText = `${loan.asset.serialNumber} ${loan.asset.model ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const current = loan.status === "APPROVED" || loan.status === "PENDING";
    const matchesView = view === "ALL" || (view === "CURRENT" ? current : !current);
    return matchesText && matchesView;
  }), [loans, query, view]);
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  async function submitReturn() {
    if (!returning) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await queryGraphQL<{ returnLoan: { id: string } }>(RETURN_LOAN, {
        input: { loanId: returning.id, condition: returnCondition },
      });
      const result = await queryGraphQL<HistoryResult>(MY_LOAN_HISTORY);
      setLoans(result.myLoanHistory);
      setReturning(null);
      setPage(0);
      setSuccess(`Devolución registrada para ${returning.asset.serialNumber}.`);
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
      <section className="work-section"><div className="section-toolbar"><div className="toolbar-title"><Activity size={17} /><strong>Movimientos personales</strong><span>{filtered.length}</span></div><div className="toolbar-controls"><label className="search-control"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Buscar activo" aria-label="Buscar activo" /></label><SelectInput className="filter-select" value={view} onChange={(event) => { setView(event.target.value); setPage(0); }} aria-label="Filtrar movimientos"><option value="ALL">Todos</option><option value="CURRENT">Activos</option><option value="CLOSED">Cerrados</option></SelectInput></div></div>
        {loading ? <LoadingRows label="Cargando historial" /> : filtered.length === 0 ? <EmptyState title={loans.length === 0 ? "Sin custodias registradas" : "Sin coincidencias"} detail={loans.length === 0 ? "Actualmente no hay solicitudes de préstamo pendientes ni activas." : "No se encontraron movimientos para estos filtros."} /> : <DataTable headings={["Activo", "Solicitud", "Vencimiento", "Devolución", "Días de mora", "Condición", "Estado", "Acciones"]}>{visible.map((loan) => <tr key={loan.id}><td><span className="copy-value"><span className="table-primary mono-cell telemetry-value font-mono">{loan.asset.serialNumber}</span><CopyButton text={loan.asset.serialNumber} label={`Copiar serie ${loan.asset.serialNumber}`} /></span><small className="table-secondary">{loan.asset.model || "Activo"}</small><small className="table-secondary">Estado del activo: <StatusTag value={loan.asset.status} /></small><small className="table-secondary id-copy-line font-mono">ID <span>{loan.id}</span><CopyButton className="inline-copy" text={loan.id} label={`Copiar ID del préstamo de ${loan.asset.serialNumber}`} /></small></td><td className="telemetry-value font-mono">{loan.requestDate?.slice(0, 10) ?? "—"}</td><td className="telemetry-value font-mono">{loan.dueLocalDate ?? "—"}</td><td className="telemetry-value font-mono">{loan.returnDateTime?.slice(0, 10) ?? "—"}</td><td className="telemetry-value font-mono">{loan.delayDays != null ? <span className={loan.delayDays > 0 ? "overdue-copy" : ""}>{loan.delayDays}</span> : "—"}</td><td>{loan.returnCondition ? <StatusTag value={loan.returnCondition} /> : "—"}</td><td><StatusTag value={loan.status} /></td><td>{loan.status === "APPROVED" ? <Button variant="secondary" className="history-return-button" type="button" onClick={() => { setReturnCondition("GOOD"); setReturning(loan); }}><RotateCcw size={14} /> Devolver</Button> : loan.status === "REJECTED" ? <button type="button" className="view-reason-button" onClick={() => setSelectedRejection(loan)}>Ver motivo</button> : "—"}</td></tr>)}</DataTable>}
        <PaginationControls currentPage={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(0); }} loading={loading} itemLabel="movimientos" />
      </section>
      {returning && <Dialog open title="Registrar devolución" eyebrow={`CUSTODIA · ${returning.asset.serialNumber}`} onClose={() => { if (!saving) setReturning(null); }}>
        <div className="work-form">
          <FormField label="Condición al devolver">
            <SelectInput value={returnCondition} onChange={(event) => setReturnCondition(event.target.value as typeof returnCondition)}>
              <option value="GOOD">En buen estado</option><option value="DAMAGED">Dañado</option><option value="LOST">No localizado</option>
            </SelectInput>
          </FormField>
          <p className="form-hint">{returnCondition === "DAMAGED" ? "El activo se marcará para mantenimiento." : returnCondition === "LOST" ? "La devolución se registrará como activo no localizado." : "El activo quedará disponible al registrar su devolución."}</p>
          <div className="modal-actions"><Button variant="secondary" type="button" disabled={saving} onClick={() => setReturning(null)}>Cancelar</Button><Button loading={saving} onClick={() => void submitReturn()}>Registrar devolución</Button></div>
        </div>
      </Dialog>}
      {selectedRejection && <Dialog open title="Motivo del rechazo" eyebrow={`SOLICITUD · ${selectedRejection.asset.serialNumber}`} onClose={() => setSelectedRejection(null)}><p className="legal-notice-copy">{selectedRejection.rejectionReason?.trim() || "El inspector no registró una justificación para esta solicitud."}</p></Dialog>}
    </div>
  );
}