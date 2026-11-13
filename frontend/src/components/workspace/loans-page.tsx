"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { CalendarClock, Check, CircleAlert, ClipboardList, RotateCcw, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Combobox } from "@/components/workspace/combobox";
import { Button, ConfirmDialog, CopyButton, DataTable, EmptyState, Feedback, FormField, LoadingRows, PageTitle, SelectInput, StatusTag, TextInput, useEscapeKey, useModalFocus } from "@/components/workspace/ui";
import { APPROVE_LOAN, ASSETS_CATALOG_QUERY, LOANS_QUERY, MY_LOAN_HISTORY, REJECT_LOAN, REQUEST_LOAN, RETURN_LOAN } from "@/lib/operations";
import { statusLabel } from "@/lib/localization";
import { errorMessage, queryGraphQL, type AssetItem, type LoanItem } from "@/lib/workspace";

type LoansResult = { loans: LoanItem[] };
type HistoryResult = { myLoanHistory: LoanItem[] };
type AssetsResult = { assets: AssetItem[] };
type MutationResult = { requestLoan?: { id: string }; approveLoan?: { id: string }; rejectLoan?: { id: string }; returnLoan?: { id: string } };

function getLocalTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function LoansPage() {
  const { session } = useAuth();
  const pathname = usePathname();
  const today = getLocalTodayIso();
  const role = session?.user.role;
  const technician = role === "TECHNICIAN";
  const inspector = role === "INSPECTOR";
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [availableAssets, setAvailableAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [showRequest, setShowRequest] = useState(false);
  const [requestConfirmationOpen, setRequestConfirmationOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [rejecting, setRejecting] = useState<LoanItem | null>(null);
  const [reason, setReason] = useState("");
  const [returning, setReturning] = useState<LoanItem | null>(null);
  const [returnConfirmationOpen, setReturnConfirmationOpen] = useState(false);
  const [condition, setCondition] = useState<"GOOD" | "DAMAGED" | "LOST">("GOOD");
  const [saving, setSaving] = useState(false);

  useEscapeKey(!saving && (showRequest || rejecting !== null || (returning !== null && !returnConfirmationOpen)), () => {
    setShowRequest(false);
    setRejecting(null);
    setReturning(null);
  });
  const requestDialogRef = useModalFocus(showRequest);
  const rejectDialogRef = useModalFocus(rejecting !== null);
  const returnDialogRef = useModalFocus(returning !== null);

  useEffect(() => {
    setShowRequest(false);
    setRequestConfirmationOpen(false);
    setRejecting(null);
    setReturning(null);
    setReturnConfirmationOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!role) return;
    let active = true;
    const dataRequest = technician
      ? Promise.all([queryGraphQL<HistoryResult>(MY_LOAN_HISTORY), queryGraphQL<AssetsResult>(ASSETS_CATALOG_QUERY)])
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
  const rows = loans;
  const isAdmin = role === "ADMIN";
  const assetOptions = availableAssets.map((asset) => ({
    value: asset.id,
    label: `${asset.serialNumber} · ${asset.model ?? "Activo"}`,
  }));
  const selectedAsset = availableAssets.find((asset) => asset.id === assetId);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (overdue) return;
    if (!assetId) {
      setFeedback({ error: "Debes seleccionar un equipo disponible." });
      return;
    }
    if (!dueDate || dueDate < getLocalTodayIso()) {
      setFeedback({ error: "La fecha prevista de devolución no puede ser anterior a hoy." });
      return;
    }
    setShowRequest(false);
    setRequestConfirmationOpen(true);
  }

  async function confirmRequest() {
    setSaving(true); setFeedback({});
    try {
      await queryGraphQL<MutationResult>(REQUEST_LOAN, { input: { assetId, dueDate } });
      setRequestConfirmationOpen(false); setAssetId(""); setDueDate(""); setFeedback({ success: "Solicitud enviada para revisión." }); setRefresh((value) => value + 1);
    } catch (error) {
      setRequestConfirmationOpen(false);
      setShowRequest(true);
      setFeedback({ error: errorMessage(error) });
    }
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
    setReturnConfirmationOpen(true);
  }

  async function confirmReturn() {
    if (!returning) return;
    setSaving(true); setFeedback({});
    try { await queryGraphQL<MutationResult>(RETURN_LOAN, { input: { loanId: returning.id, condition } }); setReturning(null); setFeedback({ success: `Devolución registrada: ${statusLabel(condition).toLowerCase()}.` }); setRefresh((value) => value + 1); }
    catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setReturnConfirmationOpen(false); setSaving(false); }
  }

  const title = technician ? "Mis préstamos" : inspector ? "Bandeja de préstamos" : "Préstamos";
  return (
    <div className="work-page">
      <PageTitle eyebrow={technician ? "CUSTODIAS · TÉCNICO" : inspector ? "OPERACIONES · INSPECCIÓN" : "OPERACIONES · CUSTODIAS"} title={title} description={technician ? "Solicita equipos y sigue el estado de tus custodias." : inspector ? "Revisa solicitudes pendientes y registra devoluciones físicas." : "Consulta el ciclo de vida de solicitudes y custodias."} action={technician ? <Button onClick={() => setShowRequest(true)} disabled={overdue}><CalendarClock size={16} /> Solicitar préstamo</Button> : undefined} />
      {overdue && <div className="work-feedback error" role="alert"><CircleAlert size={16} /><span>Tienes una devolución vencida. No puedes solicitar nuevos préstamos hasta regularizarla.</span></div>}
      <Feedback {...feedback} />
      <section className="work-section">
        <div className="section-toolbar"><div className="toolbar-title"><ClipboardList size={17} /><strong>{inspector ? "Préstamos" : technician ? "Historial de préstamos" : "Todos los préstamos"}</strong><span>{rows.length}</span></div><span className="toolbar-note">{inspector ? "Revisa solicitudes pendientes y registra devoluciones aprobadas." : "ORDENADOS POR ACTIVIDAD RECIENTE"}</span></div>
        {loading ? <LoadingRows label="Cargando préstamos" /> : rows.length === 0 ? <EmptyState title="Sin préstamos registrados" detail={technician ? "Actualmente no tienes solicitudes de préstamo pendientes ni activas." : "Actualmente no hay solicitudes de préstamo pendientes ni activas."} /> : <DataTable headings={technician ? ["Activo", "Solicitud", "Vencimiento", "Devolución", "Días de mora", "Estado", "Acción"] : ["Activo", "Técnico", "Solicitud", "Vencimiento", "Condición", "Estado", "Acciones"]}>
          {rows.map((loan) => <tr key={loan.id}>
            <td><span className="copy-value"><span className="table-primary mono-cell telemetry-value">{loan.asset.serialNumber}</span><CopyButton text={loan.asset.serialNumber} label={`Copiar serie ${loan.asset.serialNumber}`} /></span><small className="table-secondary">{loan.asset.model || "Activo"}</small></td>
            {!technician && <td>{loan.user?.fullName || loan.user?.email || "—"}</td>}
            <td>{loan.requestDate?.slice(0, 10) ?? "—"}</td><td>{loan.dueLocalDate ?? "—"}{loan.status === "APPROVED" && (loan.delayDays ?? 0) > 0 && <span className="status-tag bad overdue-badge">Vencido · {loan.delayDays} d</span>}</td>
            {technician ? <><td>{loan.returnDateTime?.slice(0, 10) ?? "—"}{(loan.delayDays ?? 0) > 0 && <small className="table-secondary overdue-copy">{loan.delayDays} días tarde</small>}</td><td><StatusTag value={loan.status} /></td><td>{loan.status === "APPROVED" ? <button className="table-action" type="button" title="Registrar devolución" aria-label="Registrar devolución" onClick={() => { setCondition("GOOD"); setReturning(loan); }}><RotateCcw size={15} /></button> : <span className="actions-placeholder">—</span>}</td></> : <><td><StatusTag value={loan.returnCondition} /></td><td><StatusTag value={loan.status} /></td><td><div className="inline-actions">{inspector && loan.status === "PENDING" && <><button className="table-action approve-action" type="button" title="Aprobar solicitud" aria-label="Aprobar solicitud" disabled={saving} onClick={() => approve(loan)}><Check size={16} /></button><button className="table-action reject-action" type="button" title="Rechazar solicitud" aria-label="Rechazar solicitud" disabled={saving} onClick={() => { setRejecting(loan); setReason(""); }}><X size={16} /></button></>}{(isAdmin || inspector) && loan.status === "APPROVED" && <button className="table-action" type="button" title="Registrar devolución" aria-label="Registrar devolución" onClick={() => { setCondition("GOOD"); setReturning(loan); }}><RotateCcw size={15} /></button>}{!(inspector && loan.status === "PENDING") && !((isAdmin || inspector) && loan.status === "APPROVED") && <span className="actions-placeholder">—</span>}</div></td></>}
          </tr>)}
        </DataTable>}
      </section>
      {showRequest && !requestConfirmationOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowRequest(false); }}><section ref={requestDialogRef} tabIndex={-1} className="work-modal" role="dialog" aria-modal="true" aria-labelledby="loan-request-title"><div className="modal-heading"><div><p className="work-eyebrow">NUEVA CUSTODIA</p><h2 id="loan-request-title">Solicitar préstamo</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setShowRequest(false)}><X size={17} /></button></div><form className="work-form" onSubmit={submitRequest}><div className="work-field"><span>Activo disponible</span><div className="asset-combobox-row"><Combobox value={assetId} onValueChange={setAssetId} options={assetOptions} placeholder="Selecciona un equipo" searchPlaceholder="Buscar por serie o modelo" emptyMessage="No hay equipos disponibles." required />{selectedAsset && <CopyButton text={selectedAsset.serialNumber} label={`Copiar serie ${selectedAsset.serialNumber}`} />}</div></div><FormField label="Fecha prevista de devolución"><TextInput type="date" min={today} value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></FormField><p className="form-hint">La solicitud quedará pendiente hasta la aprobación de un inspector.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setShowRequest(false)}>Cancelar</Button><Button type="submit" loading={saving} disabled={overdue}>Enviar solicitud</Button></div></form></section></div>}
      {rejecting && <div className="modal-backdrop" role="presentation"><section ref={rejectDialogRef} tabIndex={-1} className="work-modal" role="dialog" aria-modal="true" aria-labelledby="reject-title"><div className="modal-heading"><div><p className="work-eyebrow">REVISIÓN</p><h2 id="reject-title">Rechazar solicitud</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setRejecting(null)}><X size={17} /></button></div><form className="work-form" onSubmit={reject}><p className="form-hint copy-value">Activo <span className="telemetry-value">{rejecting.asset.serialNumber}</span><CopyButton text={rejecting.asset.serialNumber} label={`Copiar serie ${rejecting.asset.serialNumber}`} /> · {rejecting.user?.fullName || rejecting.user?.email}</p><FormField label="Motivo del rechazo"><textarea className="work-input work-textarea" value={reason} onChange={(event) => setReason(event.target.value)} minLength={15} maxLength={255} required /><small className="form-hint">Mínimo 15 caracteres · máximo 255</small></FormField><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setRejecting(null)}>Cancelar</Button><Button variant="danger" type="submit" loading={saving}>Confirmar rechazo</Button></div></form></section></div>}
      {returning && !returnConfirmationOpen && <div className="modal-backdrop" role="presentation"><section ref={returnDialogRef} tabIndex={-1} className="work-modal" role="dialog" aria-modal="true" aria-labelledby="return-title"><div className="modal-heading"><div><p className="work-eyebrow">DEVOLUCIÓN FÍSICA</p><h2 id="return-title">{technician ? "Devolver activo" : "Registrar devolución"}</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setReturning(null)}><X size={17} /></button></div><form className="work-form" onSubmit={returnLoan}><p className="form-hint copy-value">Activo <span className="telemetry-value">{returning.asset.serialNumber}</span><CopyButton text={returning.asset.serialNumber} label={`Copiar serie ${returning.asset.serialNumber}`} /> · vencía el <span className="telemetry-value">{returning.dueLocalDate ?? "sin fecha"}</span></p><FormField label="Condición al devolver"><SelectInput value={condition} onChange={(event) => setCondition(event.target.value as typeof condition)}><option value="GOOD">En buen estado</option><option value="DAMAGED">Dañado</option><option value="LOST">No localizado</option></SelectInput></FormField><p className="form-hint">{condition === "DAMAGED" ? "Confirmas que el equipo está dañado y pasará a mantenimiento." : condition === "LOST" ? "Confirmas que el equipo no está localizado y se registrará como merma." : "El equipo quedará disponible al registrar su devolución."}</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setReturning(null)}>Cancelar</Button><Button type="submit" loading={saving}>{condition === "DAMAGED" ? "Confirmar devolución con daño" : condition === "LOST" ? "Confirmar activo no localizado" : "Registrar devolución"}</Button></div></form></section></div>}
      <ConfirmDialog
        open={requestConfirmationOpen}
        title="Confirmar solicitud de préstamo"
        message={<span className="copy-value">¿Deseas solicitar <span className="telemetry-value">{selectedAsset?.serialNumber ?? "el equipo seleccionado"}</span>{selectedAsset && <CopyButton text={selectedAsset.serialNumber} label={`Copiar serie ${selectedAsset.serialNumber}`} />} con devolución prevista para <span className="telemetry-value">{dueDate}</span>?</span>}
        confirmLabel="Enviar solicitud"
        loading={saving}
        onCancel={() => { setRequestConfirmationOpen(false); setShowRequest(true); }}
        onConfirm={() => { void confirmRequest(); }}
      />
      <ConfirmDialog
        open={returnConfirmationOpen}
        title="Confirmar devolución"
        message={<span className="copy-value">¿Confirmas la devolución de <span className="telemetry-value">{returning?.asset.serialNumber ?? "este equipo"}</span>{returning?.asset.serialNumber && <CopyButton text={returning.asset.serialNumber} label={`Copiar serie ${returning.asset.serialNumber}`} />} en condición {statusLabel(condition).toLowerCase()}?</span>}
        confirmLabel="Registrar devolución"
        confirmVariant={condition === "LOST" ? "danger" : "primary"}
        loading={saving}
        onCancel={() => setReturnConfirmationOpen(false)}
        onConfirm={() => { void confirmReturn(); }}
      />
    </div>
  );
}