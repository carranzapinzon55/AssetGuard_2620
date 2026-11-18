"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { CalendarClock, Check, ChevronDown, CircleAlert, ClipboardList, Laptop, RotateCcw, Search, X } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth-provider";
import { Combobox } from "@/components/workspace/combobox";
import { Button, ConfirmDialog, CopyButton, DataTable, Dialog, EmptyState, Feedback, FormField, LoadingRows, ModalPortal, PageTitle, PaginationControls, SelectInput, StatusTag, TextInput, useEscapeKey, useModalFocus } from "@/components/workspace/ui";
import { APPROVE_LOAN, ASSETS_CATALOG_QUERY, LOANS_QUERY, MY_LOAN_HISTORY, REJECT_LOAN, REQUEST_LOAN, RETURN_LOAN } from "@/lib/operations";
import { statusLabel } from "@/lib/localization";
import { errorMessage, queryGraphQL, type AssetItem, type LoanItem } from "@/lib/workspace";
import { matchesSearch } from "@/lib/utils";

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
  const [catalogAssets, setCatalogAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [showRequest, setShowRequest] = useState(false);
  const [requestConfirmationOpen, setRequestConfirmationOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [loanDate, setLoanDate] = useState(today);
  const [loanTime, setLoanTime] = useState("08:00");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("09:00");
  const [rejecting, setRejecting] = useState<LoanItem | null>(null);
  const [reason, setReason] = useState("");
  const [returning, setReturning] = useState<LoanItem | null>(null);
  const [returnConfirmationOpen, setReturnConfirmationOpen] = useState(false);
  const [condition, setCondition] = useState<"GOOD" | "DAMAGED" | "LOST">("GOOD");
  const [damageDescription, setDamageDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [loanPage, setLoanPage] = useState(0);
  const [loanPageSize, setLoanPageSize] = useState(10);
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogPageSize, setCatalogPageSize] = useState(10);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"ALL" | "AVAILABLE" | "UNAVAILABLE">("ALL");
  const [loanSearch, setLoanSearch] = useState("");
  const [loanStatusFilter, setLoanStatusFilter] = useState("ALL");
  const [loanSortBy, setLoanSortBy] = useState(inspector ? "PENDING_FIRST" : "REQUEST_DATE_DESC");
  const [loansExpanded, setLoansExpanded] = useState(!technician);
  const [selectedRejection, setSelectedRejection] = useState<LoanItem | null>(null);

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
    const assetsRequest = queryGraphQL<AssetsResult>(ASSETS_CATALOG_QUERY);
    const dataRequest = technician
      ? Promise.all([queryGraphQL<HistoryResult>(MY_LOAN_HISTORY), assetsRequest])
          .then(([history, assets]) => {
            if (!active) return;
            setLoans(history.myLoanHistory);
            setCatalogAssets(assets.assets);
          })
      : Promise.all([queryGraphQL<LoansResult>(LOANS_QUERY), assetsRequest]).then(([result, assets]) => {
          if (active) {
            setLoans(result.loans);
            setCatalogAssets(assets.assets);
          }
        });
    dataRequest
      .catch((error: unknown) => { if (active) setFeedback({ error: errorMessage(error) }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, technician, session?.token, refresh]);

  const overdue = loans.some((loan) => loan.status === "APPROVED" && (loan.delayDays ?? 0) > 0);
  const pendingLoans = loans.filter((loan) => loan.status === "PENDING").length;
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      const searchTarget = `${loan.asset.serialNumber} ${loan.asset.model ?? ""} ${loan.user?.fullName ?? ""} ${loan.user?.email ?? ""}`.toLowerCase();
      const matchesText = searchTarget.includes(loanSearch.trim().toLowerCase());
      const matchesStatus = loanStatusFilter === "ALL" || loan.status === loanStatusFilter;
      return matchesText && matchesStatus;
    });
  }, [loans, loanSearch, loanStatusFilter]);

  const rows = useMemo(() => {
    return [...filteredLoans].sort((a, b) => {
      switch (loanSortBy) {
        case "PENDING_FIRST": {
          const aPending = a.status === "PENDING" ? 1 : 0;
          const bPending = b.status === "PENDING" ? 1 : 0;
          if (aPending !== bPending) return bPending - aPending;
          return (b.requestDate ?? "").localeCompare(a.requestDate ?? "");
        }
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
  }, [filteredLoans, loanSortBy]);

  const isAdmin = role === "ADMIN";
  const availableAssets = catalogAssets.filter((asset) => asset.status === "AVAILABLE");
  const filteredCatalogAssets = useMemo(() => catalogAssets.filter((asset) => {
    const matchesText = matchesSearch(`${asset.serialNumber} ${asset.model ?? ""}`, catalogSearch);
    const matchesAvailability = availabilityFilter === "ALL"
      || (availabilityFilter === "AVAILABLE" ? asset.status === "AVAILABLE" : asset.status !== "AVAILABLE");
    return matchesText && matchesAvailability;
  }), [catalogAssets, catalogSearch, availabilityFilter]);
  const visibleCatalogAssets = filteredCatalogAssets.slice(catalogPage * catalogPageSize, (catalogPage + 1) * catalogPageSize);
  const visibleLoans = rows.slice(loanPage * loanPageSize, (loanPage + 1) * loanPageSize);
  const assetOptions = availableAssets.map((asset) => ({
    value: asset.id,
    label: `${asset.serialNumber} · ${asset.model ?? "Activo"}`,
  }));
  const selectedAsset = catalogAssets.find((asset) => asset.id === assetId);

  useEffect(() => {
    if (inspector && pendingLoans > 0) setLoansExpanded(true);
  }, [inspector, pendingLoans]);

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
    if (loanDate < getLocalTodayIso()) {
      setFeedback({ error: "La fecha de inicio del préstamo no puede ser anterior a hoy." });
      return;
    }
    if (dueDate < loanDate) {
      setFeedback({ error: "La fecha de devolución no puede ser anterior a la fecha de inicio." });
      return;
    }
    if (!isOperationalTime(loanTime) || !isOperationalTime(dueTime)) {
      setFeedback({ error: "Las horas de préstamo y devolución deben estar entre 08:00 y 18:00." });
      return;
    }
    const loanStartsAt = new Date(`${loanDate}T${loanTime}:00`).getTime();
    const loanEndsAt = new Date(`${dueDate}T${dueTime}:00`).getTime();
    if (!Number.isFinite(loanStartsAt) || !Number.isFinite(loanEndsAt)
        || loanEndsAt - loanStartsAt < 60 * 60 * 1000) {
      setFeedback({ error: "La duración mínima del préstamo es de una hora." });
      return;
    }
    setShowRequest(false);
    setRequestConfirmationOpen(true);
  }

  async function confirmRequest() {
    setSaving(true); setFeedback({});
    try {
      await queryGraphQL<MutationResult>(REQUEST_LOAN, {
        input: {
          assetId,
          dueDate,
          startDate: loanDate,
          startTime: loanTime,
          endTime: dueTime,
        },
      });
      setRequestConfirmationOpen(false); setAssetId(""); setLoanDate(today); setLoanTime("08:00"); setDueDate(""); setDueTime("09:00"); setLoanPage(0); setFeedback({ success: "Solicitud enviada para revisión." }); setRefresh((value) => value + 1);
    } catch (error) {
      setRequestConfirmationOpen(false);
      setShowRequest(true);
      setFeedback({ error: errorMessage(error) });
    }
    finally { setSaving(false); }
  }

  async function approve(loan: LoanItem) {
    setSaving(true); setFeedback({});
    try { await queryGraphQL<MutationResult>(APPROVE_LOAN, { input: { loanId: loan.id } }); setLoanPage(0); setFeedback({ success: `Solicitud de ${loan.asset.serialNumber} aprobada.` }); setRefresh((value) => value + 1); }
    catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setSaving(false); }
  }

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!rejecting) return;
    const rejectionReason = reason.trim();
    if (rejectionReason.length < 15) {
      setFeedback({ error: "El motivo del rechazo debe tener al menos 15 caracteres." });
      return;
    }
    setSaving(true); setFeedback({});
    try { await queryGraphQL<MutationResult>(REJECT_LOAN, { input: { loanId: rejecting.id, reason: rejectionReason } }); setRejecting(null); setReason(""); setLoanPage(0); setFeedback({ success: "Solicitud rechazada." }); setRefresh((value) => value + 1); }
    catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setSaving(false); }
  }

  async function returnLoan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!returning) return;
    if (condition === "DAMAGED" && damageDescription.trim().length < 10) {
      setFeedback({ error: "La descripción de la falla debe tener al menos 10 caracteres." });
      return;
    }
    setReturnConfirmationOpen(true);
  }

  async function confirmReturn() {
    if (!returning) return;
    setSaving(true); setFeedback({});
    try {
      await queryGraphQL<MutationResult>(RETURN_LOAN, {
        input: {
          loanId: returning.id,
          condition,
          damageDescription: condition === "DAMAGED" ? damageDescription.trim() : null,
        },
      });
      setReturning(null);
      setDamageDescription("");
      setLoanPage(0);
      setFeedback({ success: `Devolución registrada: ${statusLabel(condition).toLowerCase()}.` });
      setRefresh((value) => value + 1);
    }
    catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setReturnConfirmationOpen(false); setSaving(false); }
  }

  const title = technician ? "Mis préstamos" : inspector ? "Bandeja de préstamos" : "Préstamos";
  return (
    <div className="work-page loans-page-layout">
      <PageTitle eyebrow={technician ? "CUSTODIAS · TÉCNICO" : inspector ? "OPERACIONES · INSPECCIÓN" : "OPERACIONES · CUSTODIAS"} title={title} description={technician ? "Explora el catálogo, solicita equipos y sigue el estado de tus custodias." : inspector ? "Revisa solicitudes pendientes y registra devoluciones físicas." : "Consulta el ciclo de vida de solicitudes y custodias."} action={technician ? <Button onClick={() => { setAssetId(""); setShowRequest(true); }} disabled={overdue}><CalendarClock size={16} /> Solicitar préstamo</Button> : undefined} />
      {overdue && <div className="work-feedback error" role="alert"><CircleAlert size={16} /><span>Tienes una devolución vencida. No puedes solicitar nuevos préstamos hasta regularizarla.</span></div>}
      <Feedback {...feedback} />
      <section className="loan-catalog-section" aria-label="Catálogo de activos para préstamos">
        <div className="section-toolbar"><div className="toolbar-title"><Laptop size={17} /><strong>Catálogo de activos</strong><span>{filteredCatalogAssets.length}</span></div><div className="toolbar-controls"><label className="search-control"><Search size={16} /><input value={catalogSearch} onChange={(event) => { setCatalogSearch(event.target.value); setCatalogPage(0); }} placeholder="Buscar por modelo o serie" aria-label="Buscar activos por modelo o número de serie" /></label><SelectInput className="filter-select" value={availabilityFilter} onChange={(event) => { setAvailabilityFilter(event.target.value as typeof availabilityFilter); setCatalogPage(0); }} aria-label="Filtrar por disponibilidad"><option value="ALL">Todos</option><option value="AVAILABLE">Disponible</option><option value="UNAVAILABLE">No disponible</option></SelectInput></div></div>
        {loading ? <LoadingRows label="Cargando catálogo de activos" /> : filteredCatalogAssets.length === 0 ? <EmptyState title={catalogAssets.length === 0 ? "Catálogo vacío" : "Sin coincidencias"} detail={catalogAssets.length === 0 ? "No hay activos disponibles para mostrar." : "Prueba con otro modelo, serie o disponibilidad."} /> : (
          <div className="loan-asset-grid">
            {visibleCatalogAssets.map((asset) => {
              const isAvailable = asset.status === "AVAILABLE";
              const brand = asset.model?.trim().split(/\s+/)[0] || "GlobalNet";
              return (
                <button className="loan-asset-card" type="button" key={asset.id} onClick={() => { setAssetId(asset.id); setShowRequest(true); }}>
                  <span className="asset-card-photo"><Laptop size={34} strokeWidth={1.3} /><span className={`asset-availability ${isAvailable ? "available" : "unavailable"}`}><i />{isAvailable ? "Disponible" : "No disponible"}</span></span>
                  <span className="asset-card-copy"><span className="asset-card-brand">{brand}</span><strong>{asset.model || "Activo"}</strong><small className="telemetry-value">{asset.serialNumber}</small></span>
                </button>
              );
            })}
          </div>
        )}
        <PaginationControls currentPage={catalogPage} totalItems={filteredCatalogAssets.length} pageSize={catalogPageSize} onPageChange={setCatalogPage} onPageSizeChange={(size) => { setCatalogPageSize(size); setCatalogPage(0); }} loading={loading} itemLabel="activos" />
      </section>
      <section className="work-section">
        <div className="section-toolbar loan-history-toolbar">
          <div className="toolbar-title"><ClipboardList size={17} /><strong>{inspector ? "Bandeja de préstamos" : technician ? "Historial de préstamos" : "Todos los préstamos"}</strong><span>{rows.length}</span>{inspector && <span className="pending-count">{pendingLoans} pendientes</span>}</div>
          <div className="toolbar-controls">
            <label className="search-control"><Search size={16} /><input value={loanSearch} onChange={(event) => { setLoanSearch(event.target.value); setLoanPage(0); }} placeholder="Serie, modelo o técnico" aria-label="Buscar préstamos por serie, modelo o técnico" /></label>
            <SelectInput className="filter-select" value={loanStatusFilter} onChange={(event) => { setLoanStatusFilter(event.target.value); setLoanPage(0); }} aria-label="Filtrar por estado del préstamo">
              <option value="ALL">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="APPROVED">Aprobado</option>
              <option value="REJECTED">Rechazado</option>
              <option value="RETURNED">Devuelto</option>
            </SelectInput>
            <SelectInput className="filter-select" value={loanSortBy} onChange={(event) => { setLoanSortBy(event.target.value); setLoanPage(0); }} aria-label="Ordenar préstamos por">
              <option value="PENDING_FIRST">Pendientes primero</option>
              <option value="REQUEST_DATE_DESC">Fecha solicitud (Reciente)</option>
              <option value="REQUEST_DATE_ASC">Fecha solicitud (Antigua)</option>
              <option value="DUE_DATE_ASC">Vencimiento (Próximo)</option>
              <option value="DUE_DATE_DESC">Vencimiento (Lejano)</option>
              <option value="DELAY_DAYS_DESC">Días de mora (Mayor)</option>
              <option value="ASSET_ASC">Activo (A-Z)</option>
            </SelectInput>
            <button type="button" className="loans-collapse-trigger" aria-expanded={loansExpanded} aria-controls="loan-history-panel" onClick={() => setLoansExpanded((expanded) => !expanded)}>
              <span>{loansExpanded ? "Contraer" : "Expandir"}</span><ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div id="loan-history-panel" hidden={!loansExpanded}>
        {loading ? <LoadingRows label="Cargando préstamos" /> : rows.length === 0 ? <EmptyState title="Sin préstamos registrados" detail={technician ? "Actualmente no tienes solicitudes de préstamo pendientes ni activas." : "Actualmente no hay solicitudes de préstamo pendientes ni activas."} /> : <DataTable headings={technician ? ["Activo", "Solicitud", "Vencimiento", "Devolución", "Días de mora", "Estado", "Acción"] : ["Activo", "Técnico", "Solicitud", "Vencimiento", "Condición", "Estado", "Acciones"]}>
          {visibleLoans.map((loan) => <tr key={loan.id} className={inspector && loan.status === "PENDING" ? "loan-pending-row" : undefined}>
            <td>
              <span className="copy-value"><span className="table-primary mono-cell telemetry-value font-mono">{loan.asset.serialNumber}</span><CopyButton text={loan.asset.serialNumber} label={`Copiar serie ${loan.asset.serialNumber}`} /></span>
              <small className="table-secondary">{loan.asset.model || "Activo"}</small>
              <small className="table-secondary">Estado del activo: <StatusTag value={loan.asset.status} /></small>
              <small className="table-secondary id-copy-line font-mono">ID <span>{loan.id}</span><CopyButton className="inline-copy" text={loan.id} label={`Copiar ID del préstamo de ${loan.asset.serialNumber}`} /></small>
            </td>
            {!technician && <td>{loan.user?.fullName || loan.user?.email || "—"}</td>}
            <td>{loan.requestDate?.slice(0, 10) ?? "—"}</td><td>{loan.dueLocalDate ?? "—"}{loan.status === "APPROVED" && (loan.delayDays ?? 0) > 0 && <span className="status-tag bad overdue-badge">Vencido · {loan.delayDays} d</span>}</td>
            {technician ? <><td>{loan.returnDateTime?.slice(0, 10) ?? "—"}{(loan.delayDays ?? 0) > 0 && <small className="table-secondary overdue-copy">{loan.delayDays} días tarde</small>}</td><td><StatusTag value={loan.status} /></td><td>{loan.status === "APPROVED" ? <button className="table-action" type="button" title="Registrar devolución" aria-label="Registrar devolución" onClick={() => { setCondition("GOOD"); setDamageDescription(""); setReturning(loan); }}><RotateCcw size={15} /></button> : loan.status === "REJECTED" ? <button type="button" className="view-reason-button" onClick={() => setSelectedRejection(loan)}>Ver motivo</button> : <span className="actions-placeholder">—</span>}</td></> : <><td>{loan.returnCondition ? <StatusTag value={loan.returnCondition} /> : "—"}</td><td><StatusTag value={loan.status} /></td><td><div className="inline-actions">{inspector && loan.status === "PENDING" && <><button className="table-action approve-action" type="button" title="Aprobar solicitud" aria-label="Aprobar solicitud" disabled={saving} onClick={() => approve(loan)}><Check size={16} /></button><button className="table-action reject-action" type="button" title="Rechazar solicitud" aria-label="Rechazar solicitud" disabled={saving} onClick={() => { setRejecting(loan); setReason(""); }}><X size={16} /></button></>}{(isAdmin || inspector) && loan.status === "APPROVED" && <button className="table-action" type="button" title="Registrar devolución" aria-label="Registrar devolución" onClick={() => { setCondition("GOOD"); setDamageDescription(""); setReturning(loan); }}><RotateCcw size={15} /></button>}{!(inspector && loan.status === "PENDING") && !((isAdmin || inspector) && loan.status === "APPROVED") && <span className="actions-placeholder">—</span>}</div></td></>}
          </tr>)}
        </DataTable>}
        <PaginationControls currentPage={loanPage} totalItems={rows.length} pageSize={loanPageSize} onPageChange={setLoanPage} onPageSizeChange={(size) => { setLoanPageSize(size); setLoanPage(0); }} loading={loading} itemLabel="préstamos" />
        </div>
      </section>
      {showRequest && !requestConfirmationOpen && (
        <ModalPortal>
          <motion.div className="modal-backdrop asset-drawer-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setShowRequest(false); }}>
            <motion.section ref={requestDialogRef} tabIndex={-1} className="work-modal asset-drawer" role="dialog" aria-modal="true" aria-labelledby="loan-request-title" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
              <div className="modal-heading"><div><p className="work-eyebrow">CATÁLOGO · NUEVA CUSTODIA</p><h2 id="loan-request-title">{selectedAsset?.model || "Solicitar préstamo"}</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setShowRequest(false)}><X size={17} /></button></div>
              {selectedAsset && <div className="drawer-asset-summary"><span className="drawer-asset-photo"><Laptop size={44} strokeWidth={1.2} /></span><span className={`asset-availability ${selectedAsset.status === "AVAILABLE" ? "available" : "unavailable"}`}><i />{selectedAsset.status === "AVAILABLE" ? "Disponible" : "No disponible"}</span><strong className="telemetry-value">{selectedAsset.serialNumber}</strong><span>{selectedAsset.model || "Activo"}</span></div>}
              {technician && (!selectedAsset || selectedAsset.status === "AVAILABLE") ? <form className="work-form" onSubmit={submitRequest}><div className="work-field"><span>Activo disponible</span><div className="asset-combobox-row"><Combobox value={assetId} onValueChange={setAssetId} options={assetOptions} placeholder="Selecciona un equipo" searchPlaceholder="Buscar por serie o modelo" emptyMessage="No hay equipos disponibles." required />{selectedAsset && <CopyButton text={selectedAsset.serialNumber} label={`Copiar serie ${selectedAsset.serialNumber}`} />}</div></div><div className="form-grid two-col"><FormField label="Fecha de inicio"><TextInput type="date" value={loanDate} onChange={(event) => setLoanDate(event.target.value)} min={today} required /></FormField><FormField label="Hora de inicio"><TextInput type="time" min="08:00" max="18:00" value={loanTime} onChange={(event) => setLoanTime(event.target.value)} required /></FormField><FormField label="Fecha prevista de devolución"><TextInput type="date" min={loanDate || today} value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></FormField><FormField label="Hora prevista de devolución"><TextInput type="time" min="08:00" max="18:00" value={dueTime} onChange={(event) => setDueTime(event.target.value)} required /></FormField></div><p className="form-hint">Horario operativo: 08:00–18:00. El préstamo debe durar al menos una hora. La solicitud quedará pendiente hasta la aprobación de un inspector.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setShowRequest(false)}>Cancelar</Button><Button type="submit" loading={saving} disabled={overdue}>Enviar solicitud</Button></div></form> : <div className="drawer-unavailable"><p>{technician ? "Este activo no está disponible para una nueva solicitud." : "Consulta el estado de este activo en el catálogo."}</p><Button variant="secondary" type="button" onClick={() => setShowRequest(false)}>Cerrar detalle</Button></div>}
            </motion.section>
          </motion.div>
        </ModalPortal>
      )}
      {rejecting && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation">
            <section ref={rejectDialogRef} tabIndex={-1} className="work-modal" role="dialog" aria-modal="true" aria-labelledby="reject-title">
              <div className="modal-heading"><div><p className="work-eyebrow">REVISIÓN</p><h2 id="reject-title">Rechazar solicitud</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setRejecting(null)}><X size={17} /></button></div>
              <form className="work-form" onSubmit={reject}><p className="form-hint copy-value">Activo <span className="telemetry-value">{rejecting.asset.serialNumber}</span><CopyButton text={rejecting.asset.serialNumber} label={`Copiar serie ${rejecting.asset.serialNumber}`} /> · {rejecting.user?.fullName || rejecting.user?.email}</p><FormField label="Motivo del rechazo"><textarea className="work-input work-textarea" value={reason} onChange={(event) => setReason(event.target.value)} minLength={15} maxLength={255} required /><small className={`character-counter ${reason.trim().length >= 15 ? "met" : ""}`}>{reason.length} / 255 caracteres · Mínimo 15</small></FormField><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setRejecting(null)}>Cancelar</Button><Button variant="danger" type="submit" loading={saving}>Confirmar rechazo</Button></div></form>
            </section>
          </div>
        </ModalPortal>
      )}
      {selectedRejection && <Dialog open title="Motivo del rechazo" eyebrow={`SOLICITUD · ${selectedRejection.asset.serialNumber}`} onClose={() => setSelectedRejection(null)}><p className="legal-notice-copy">{selectedRejection.rejectionReason?.trim() || "El inspector no registró una justificación para esta solicitud."}</p></Dialog>}
      {returning && !returnConfirmationOpen && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation">
            <section ref={returnDialogRef} tabIndex={-1} className="work-modal" role="dialog" aria-modal="true" aria-labelledby="return-title">
              <div className="modal-heading"><div><p className="work-eyebrow">DEVOLUCIÓN FÍSICA</p><h2 id="return-title">{technician ? "Devolver activo" : "Registrar devolución"}</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setReturning(null)}><X size={17} /></button></div>
              <form className="work-form" onSubmit={returnLoan}><p className="form-hint copy-value">Activo <span className="telemetry-value">{returning.asset.serialNumber}</span><CopyButton text={returning.asset.serialNumber} label={`Copiar serie ${returning.asset.serialNumber}`} /> · vencía el <span className="telemetry-value">{returning.dueLocalDate ?? "sin fecha"}</span></p><FormField label="Condición al devolver"><SelectInput value={condition} onChange={(event) => setCondition(event.target.value as typeof condition)}><option value="GOOD">En buen estado</option><option value="DAMAGED">Dañado</option><option value="LOST">No localizado</option></SelectInput></FormField>{condition === "DAMAGED" && <FormField label="Descripción de la falla (obligatorio)"><textarea className="work-input work-textarea" value={damageDescription} onChange={(event) => setDamageDescription(event.target.value)} placeholder="Describe detalladamente el daño físico o avería del activo..." rows={3} minLength={10} required /><small className={`character-counter ${damageDescription.trim().length >= 10 ? "met" : ""}`}>{damageDescription.length} caracteres · Mínimo 10</small></FormField>}<p className="form-hint">{condition === "DAMAGED" ? "Confirmas que el equipo está dañado, pasará a mantenimiento y se abrirá una orden técnica pendiente." : condition === "LOST" ? "Confirmas que el equipo no está localizado y se generará el reporte formal de pérdida." : "El equipo quedará disponible al registrar su devolución."}</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setReturning(null)}>Cancelar</Button><Button type="submit" loading={saving}>{condition === "DAMAGED" ? "Confirmar devolución con daño" : condition === "LOST" ? "Confirmar activo no localizado" : "Registrar devolución"}</Button></div></form>
            </section>
          </div>
        </ModalPortal>
      )}
      <ConfirmDialog
        open={requestConfirmationOpen}
        title="Confirmar solicitud de préstamo"
        message={<p className="confirm-request-copy">¿Deseas solicitar <span className="serial-badge inline-flex items-center gap-1.5 font-mono"><span>{selectedAsset?.serialNumber ?? "el equipo seleccionado"}</span>{selectedAsset && <CopyButton text={selectedAsset.serialNumber} label={`Copiar serie ${selectedAsset.serialNumber}`} />}</span> con devolución prevista para <time className="font-mono" dateTime={dueDate}>{dueDate}</time>?</p>}
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

function isOperationalTime(time: string): boolean {
  return time >= "08:00" && time <= "18:00";
}