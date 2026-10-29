"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarClock, Check, CircleAlert, ClipboardList, RotateCcw, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, DataTable, EmptyState, Feedback, FormField, LoadingRows, PageTitle, SelectInput, StatusTag, TextInput } from "@/components/workspace/ui";
import { APPROVE_LOAN, ASSETS_QUERY, LOANS_QUERY, MY_LOAN_HISTORY, REJECT_LOAN, REQUEST_LOAN, RETURN_LOAN } from "@/lib/operations";
import { errorMessage, queryGraphQL, type AssetItem, type LoanItem } from "@/lib/workspace";

type LoansResult = { loans: LoanItem[] };
type HistoryResult = { myLoanHistory: LoanItem[] };
type AssetsResult = { assets: AssetItem[] };
type MutationResult = { requestLoan?: { id: string }; approveLoan?: { id: string }; rejectLoan?: { id: string }; returnLoan?: { id: string } };

export function LoansPage() {
  const { session } = useAuth();
  const role = session?.user.role;
  const technician = role === "TECHNICIAN";
  const inspector = role === "INSPECTOR";
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [availableAssets, setAvailableAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [showRequest, setShowRequest] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [rejecting, setRejecting] = useState<LoanItem | null>(null);
  const [reason, setReason] = useState("");
  const [returning, setReturning] = useState<LoanItem | null>(null);
  const [condition, setCondition] = useState<"GOOD" | "DAMAGED" | "LOST">("GOOD");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!role) return;
    let active = true;
    const dataRequest = technician
      ? Promise.all([queryGraphQL<HistoryResult>(MY_LOAN_HISTORY), queryGraphQL<AssetsResult>(ASSETS_QUERY)])
          .then(([history, assets]) => {
            if (!active) return;
            setLoans(history.myLoanHistory);
            setAvailableAssets(assets.assets.filter((asset) => asset.status === "AVAILABLE"));
          })
      : queryGraphQL<LoansResult>(LOANS_QUERY).then((result) => { if (active) setLoans(result.loans); });
    dataRequest
      .catch((error: unknown) => { if (active) setFeedback({ error: errorMessage(error) }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, technician, session?.token, refresh]);

  const overdue = loans.some((loan) => loan.status === "APPROVED" && (loan.delayDays ?? 0) > 0);
  const pending = useMemo(() => loans.filter((loan) => loan.status === "PENDING"), [loans]);
  const rows = inspector ? pending : loans;

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (overdue) return;
    setSaving(true); setFeedback({});
    try {
      await queryGraphQL<MutationResult>(REQUEST_LOAN, { input: { assetId, dueDate } });
      setShowRequest(false); setAssetId(""); setDueDate(""); setFeedback({ success: "Solicitud enviada para revisión." }); setRefresh((value) => value + 1);
    } catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setSaving(false); }
  }

  async function approve(loan: LoanItem) {
    setSaving(true); setFeedback({});
    try { await queryGraphQL<MutationResult>(APPROVE_LOAN, { input: { loanId: loan.id } }); setFeedback({ success: `Solicitud de ${loan.asset.serialNumber} aprobada.` }); setRefresh((value) => value + 1); }
    catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setSaving(false); }
  }

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!rejecting) return;
    setSaving(true); setFeedback({});
    try { await queryGraphQL<MutationResult>(REJECT_LOAN, { input: { loanId: rejecting.id, reason } }); setRejecting(null); setReason(""); setFeedback({ success: "Solicitud rechazada." }); setRefresh((value) => value + 1); }
    catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setSaving(false); }
  }

  async function returnLoan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!returning) return;
    setSaving(true); setFeedback({});
    try { await queryGraphQL<MutationResult>(RETURN_LOAN, { input: { loanId: returning.id, condition } }); setReturning(null); setFeedback({ success: `Devolución registrada: ${condition}.` }); setRefresh((value) => value + 1); }
    catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setSaving(false); }
  }

  const title = technician ? "Mis préstamos" : inspector ? "Bandeja de préstamos" : "Préstamos";
  return (
    <div className="work-page">
      <PageTitle eyebrow={technician ? "CUSTODIAS · TÉCNICO" : inspector ? "OPERACIONES · INSPECCIÓN" : "OPERACIONES · CUSTODIAS"} title={title} description={technician ? "Solicita equipos y sigue el estado de tus custodias." : inspector ? "Revisa solicitudes pendientes y registra devoluciones físicas." : "Consulta el ciclo de vida de solicitudes y custodias."} action={technician ? <Button onClick={() => setShowRequest(true)} disabled={overdue}><CalendarClock size={16} /> Solicitar préstamo</Button> : undefined} />
      {overdue && <div className="work-feedback error"><CircleAlert size={16} /><span>Tienes una devolución vencida. No puedes solicitar nuevos préstamos hasta regularizarla.</span></div>}
      <Feedback {...feedback} />
      <section className="work-section">
        <div className="section-toolbar"><div className="toolbar-title"><ClipboardList size={17} /><strong>{inspector ? "Solicitudes pendientes" : technician ? "Historial de préstamos" : "Todos los préstamos"}</strong><span>{rows.length}</span></div><span className="toolbar-note">{inspector ? "Las devoluciones aprobadas están disponibles en préstamos activos." : "ORDENADOS POR ACTIVIDAD RECIENTE"}</span></div>
        {loading ? <LoadingRows label="Cargando préstamos" /> : rows.length === 0 ? <EmptyState title={inspector ? "Bandeja al día" : "Sin préstamos registrados"} detail={inspector ? "No hay solicitudes pendientes de revisión." : "Las solicitudes aparecerán aquí."} /> : <DataTable headings={technician ? ["Activo", "Solicitud", "Vencimiento", "Devolución", "Mora", "Estado", "Acción"] : ["Activo", "Técnico", "Solicitud", "Vencimiento", "Condición", "Estado", "Acciones"]}>
          {rows.map((loan) => <tr key={loan.id}>
            <td><span className="table-primary mono-cell">{loan.asset.serialNumber}</span><small className="table-secondary">{loan.asset.model || "Activo"}</small></td>
            {!technician && <td>{loan.user?.fullName || loan.user?.email || "—"}</td>}
            <td>{loan.requestDate?.slice(0, 10) ?? "—"}</td><td>{loan.dueLocalDate ?? "—"}</td>
            {technician ? <><td>{loan.returnDateTime?.slice(0, 10) ?? "—"}{(loan.delayDays ?? 0) > 0 && <small className="table-secondary overdue-copy">{loan.delayDays} días tarde</small>}</td><td><StatusTag value={loan.status} /></td><td>{loan.status === "APPROVED" ? <Button variant="secondary" onClick={() => setReturning(loan)}><RotateCcw size={14} /> Devolver</Button> : "—"}</td></> : <><td>{loan.returnCondition ?? "—"}</td><td><StatusTag value={loan.status} /></td><td><div className="inline-actions">{inspector && loan.status === "PENDING" && <><button className="table-action approve-action" title="Aprobar" aria-label="Aprobar" disabled={saving} onClick={() => approve(loan)}><Check size={16} /></button><button className="table-action reject-action" title="Rechazar" aria-label="Rechazar" onClick={() => { setRejecting(loan); setReason(""); }}><X size={16} /></button></>}{inspector && loan.status === "APPROVED" && <Button variant="secondary" onClick={() => setReturning(loan)}><RotateCcw size={14} /> Registrar devolución</Button>}</div></td></>}
          </tr>)}
        </DataTable>}
      </section>
      {showRequest && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowRequest(false); }}><section className="work-modal" role="dialog" aria-modal="true" aria-labelledby="loan-request-title"><div className="modal-heading"><div><p className="work-eyebrow">NUEVA CUSTODIA</p><h2 id="loan-request-title">Solicitar préstamo</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setShowRequest(false)}><X size={17} /></button></div><form className="work-form" onSubmit={submitRequest}><FormField label="Activo disponible"><SelectInput value={assetId} onChange={(event) => setAssetId(event.target.value)} required><option value="">Selecciona un equipo</option>{availableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.serialNumber} · {asset.model}</option>)}</SelectInput></FormField><FormField label="Fecha prevista de devolución"><TextInput type="date" min={new Date().toISOString().slice(0, 10)} value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></FormField><p className="form-hint">La solicitud quedará pendiente hasta la aprobación de un inspector.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setShowRequest(false)}>Cancelar</Button><Button type="submit" disabled={saving || overdue}>{saving ? "Enviando…" : "Enviar solicitud"}</Button></div></form></section></div>}
      {rejecting && <div className="modal-backdrop" role="presentation"><section className="work-modal" role="dialog" aria-modal="true" aria-labelledby="reject-title"><div className="modal-heading"><div><p className="work-eyebrow">REVISIÓN</p><h2 id="reject-title">Rechazar solicitud</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setRejecting(null)}><X size={17} /></button></div><form className="work-form" onSubmit={reject}><p className="form-hint">Activo {rejecting.asset.serialNumber} · {rejecting.user?.fullName || rejecting.user?.email}</p><FormField label="Motivo del rechazo"><TextInput value={reason} onChange={(event) => setReason(event.target.value)} required /></FormField><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setRejecting(null)}>Cancelar</Button><Button variant="danger" type="submit" disabled={saving}>Confirmar rechazo</Button></div></form></section></div>}
      {returning && <div className="modal-backdrop" role="presentation"><section className="work-modal" role="dialog" aria-modal="true" aria-labelledby="return-title"><div className="modal-heading"><div><p className="work-eyebrow">DEVOLUCIÓN FÍSICA</p><h2 id="return-title">{technician ? "Devolver activo" : "Registrar devolución"}</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setReturning(null)}><X size={17} /></button></div><form className="work-form" onSubmit={returnLoan}><p className="form-hint">Activo {returning.asset.serialNumber} · vencía el {returning.dueLocalDate ?? "sin fecha"}</p><FormField label="Condición al devolver"><SelectInput value={condition} onChange={(event) => setCondition(event.target.value as typeof condition)}><option value="GOOD">GOOD · En buen estado</option><option value="DAMAGED">DAMAGED · Dañado</option><option value="LOST">LOST · No localizado</option></SelectInput></FormField><p className="form-hint">GOOD libera el activo; DAMAGED lo envía a mantenimiento; LOST lo registra como merma.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setReturning(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Registrando…" : "Registrar devolución"}</Button></div></form></section></div>}
    </div>
  );
}