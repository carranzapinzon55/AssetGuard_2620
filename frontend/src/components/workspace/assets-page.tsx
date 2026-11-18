"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Boxes, Edit3, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useCurrency } from "@/components/currency-provider";
import { Combobox } from "@/components/workspace/combobox";
import { Button, CopyButton, CurrencyDisplay, DataTable, EmptyState, Feedback, FormField, LoadingRows, ModalPortal, PageTitle, PaginationControls, SelectInput, StatusTag, TextInput, useEscapeKey, useModalFocus } from "@/components/workspace/ui";
import { ASSETS_CATALOG_QUERY, ASSETS_QUERY, CREATE_ASSET, PROVIDERS_QUERY, UPDATE_ASSET, USERS_QUERY } from "@/lib/operations";
import { errorMessage, queryGraphQL, type AssetItem, type ProviderItem, type UserItem } from "@/lib/workspace";

type AssetsResult = { assets: AssetItem[] };
type AssetResult = { createAsset: AssetItem; updateAsset: AssetItem };
const MAX_ASSETS = 50;
const blankAsset = { model: "", estimatedValue: "", purchaseDate: "", status: "AVAILABLE", stockQuantity: "1" };

function getLocalTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AssetsPage() {
  const { session } = useAuth();
  const { currency, convertToUsd, convertFromUsd } = useCurrency();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = session?.user.role === "ADMIN";
  const isTechnician = session?.user.role === "TECHNICIAN";
  const todayIso = getLocalTodayIso();

  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(() => searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("PURCHASE_DATE_DESC");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<AssetItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankAsset);
  const [assetCurrency, setAssetCurrency] = useState(currency);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);

  // Campos dinámicos según el estado del activo
  const [technicians, setTechnicians] = useState<UserItem[]>([]);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loanTechnicianId, setLoanTechnicianId] = useState("");
  const [loanStartDate, setLoanStartDate] = useState(todayIso);
  const [loanDueDate, setLoanDueDate] = useState(todayIso);
  const [loanStartTime, setLoanStartTime] = useState("08:00");
  const [loanEndTime, setLoanEndTime] = useState("18:00");
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [maintenanceCost, setMaintenanceCost] = useState("");
  const [maintenanceCostCurrency, setMaintenanceCostCurrency] = useState<"USD" | "COP">(currency);
  const [maintenanceProviderName, setMaintenanceProviderName] = useState("");
  const [lostNotes, setLostNotes] = useState("");

  useEffect(() => {
    if (isAdmin) {
      queryGraphQL<{ users: UserItem[] }>(USERS_QUERY, { limit: 100 })
        .then((res) => setTechnicians(res.users.filter((u) => u.role === "TECHNICIAN" && u.status)))
        .catch(() => {});
      queryGraphQL<{ providers: ProviderItem[] }>(PROVIDERS_QUERY)
        .then((res) => setProviders(res.providers.filter((p) => p.active)))
        .catch(() => {});
    }
  }, [isAdmin, session?.token]);

  const technicianOptions = useMemo(() => technicians.map((t) => ({
    value: t.id,
    label: `${t.fullName || t.email} (${t.email})`,
  })), [technicians]);

  const providerOptions = useMemo(() => {
    const list = providers.map((p) => ({ value: p.name, label: p.name }));
    if (maintenanceProviderName && !list.some((p) => p.value === maintenanceProviderName)) {
      list.unshift({ value: maintenanceProviderName, label: `${maintenanceProviderName} (Manual)` });
    }
    return list;
  }, [providers, maintenanceProviderName]);

  useEscapeKey((formOpen && !saving) || confirmEditOpen, () => {
    if (confirmEditOpen) setConfirmEditOpen(false);
    else setFormOpen(false);
  });

  useEffect(() => {
    setFormOpen(false);
    setConfirmEditOpen(false);
  }, [pathname]);

  const dialogRef = useModalFocus(formOpen);
  const confirmDialogRef = useModalFocus(confirmEditOpen);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    queryGraphQL<AssetsResult>(isTechnician ? ASSETS_CATALOG_QUERY : ASSETS_QUERY, { limit: MAX_ASSETS })
      .then((result) => { if (active) setAssets(result.assets); })
      .catch((error: unknown) => { if (active) setFeedback({ error: errorMessage(error) }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token, refresh, isTechnician]);

  const filtered = useMemo(() => assets.filter((asset) => {
    const matchesText = `${asset.serialNumber} ${asset.model ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === "ALL" || asset.status === statusFilter;
    return matchesText && matchesStatus;
  }), [assets, query, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "PURCHASE_DATE_DESC":
          return (b.purchaseDate ?? "").localeCompare(a.purchaseDate ?? "");
        case "PURCHASE_DATE_ASC":
          return (a.purchaseDate ?? "").localeCompare(b.purchaseDate ?? "");
        case "MODEL_ASC":
          return (a.model ?? "").localeCompare(b.model ?? "");
        case "MODEL_DESC":
          return (b.model ?? "").localeCompare(a.model ?? "");
        case "VALUE_DESC":
          return (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0);
        case "VALUE_ASC":
          return (a.estimatedValue ?? 0) - (b.estimatedValue ?? 0);
        case "STOCK_DESC":
          return (b.stockQuantity ?? 1) - (a.stockQuantity ?? 1);
        case "STOCK_ASC":
          return (a.stockQuantity ?? 1) - (b.stockQuantity ?? 1);
        case "STATUS":
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
  }, [filtered, sortBy]);

  const visible = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function changePageSize(nextPageSize: number) {
    setPageSize(nextPageSize);
    setPage(0);
  }

  function openForm(asset?: AssetItem) {
    setEditing(asset ?? null);
    setAssetCurrency(currency);
    setForm(asset ? {
      model: asset.model ?? "",
      estimatedValue: asset.estimatedValue == null
        ? ""
        : convertFromUsd(asset.estimatedValue, currency).toFixed(2),
      purchaseDate: asset.purchaseDate ?? "",
      status: asset.status,
      stockQuantity: String(asset.stockQuantity ?? 1),
    } : blankAsset);
    setLoanTechnicianId("");
    setLoanStartDate(todayIso);
    setLoanDueDate(todayIso);
    setLoanStartTime("08:00");
    setLoanEndTime("18:00");
    setMaintenanceReason("");
    setMaintenanceCost("");
    setMaintenanceCostCurrency(currency);
    setMaintenanceProviderName("");
    setLostNotes("");
    setFeedback({});
    setFormOpen(true);
  }

  async function saveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback({});

    if (!form.model.trim()) {
      setFeedback({ error: "Debes ingresar el modelo del activo." });
      return;
    }

    const numericValue = Number(form.estimatedValue);
    const minUsd = 0.25;
    const minDisplay = assetCurrency === "COP" ? 1000 : 0.25;
    if (!form.estimatedValue || !Number.isFinite(numericValue)
        || numericValue < minDisplay
        || convertToUsd(numericValue, assetCurrency) < minUsd) {
      setFeedback({ error: assetCurrency === "COP"
        ? "El valor estimado debe ser de al menos $1.000 COP (equivalente a 0,25 USD)."
        : "El valor estimado debe ser de al menos 0,25 USD." });
      return;
    }

    if (!form.purchaseDate) {
      setFeedback({ error: "Debes seleccionar la fecha de compra." });
      return;
    }

    if (form.purchaseDate > getLocalTodayIso()) {
      setFeedback({ error: "La fecha de compra no puede ser posterior a hoy." });
      return;
    }

    if (form.status === "LOANED") {
      if (!loanTechnicianId) {
        setFeedback({ error: "Debes seleccionar el técnico asignado para el préstamo." });
        return;
      }
      if (!loanDueDate) {
        setFeedback({ error: "Debes ingresar la fecha de devolución del préstamo." });
        return;
      }
      if (loanDueDate < loanStartDate) {
        setFeedback({ error: "La fecha de devolución no puede ser anterior a la fecha de inicio." });
        return;
      }
      if (loanDueDate === loanStartDate) {
        const startTs = new Date(`${loanStartDate}T${loanStartTime}:00`).getTime();
        const endTs = new Date(`${loanDueDate}T${loanEndTime}:00`).getTime();
        if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs - startTs < 60 * 60 * 1000) {
          setFeedback({ error: "La duración mínima del préstamo en el mismo día es de una hora (08:00–18:00)." });
          return;
        }
      }
    } else if (form.status === "UNDER_MAINTENANCE") {
      if (!maintenanceReason.trim()) {
        setFeedback({ error: "Debes ingresar el motivo del servicio de mantenimiento." });
        return;
      }
      if (!maintenanceProviderName.trim()) {
        setFeedback({ error: "Debes seleccionar o ingresar el proveedor técnico." });
        return;
      }
      if (maintenanceCost) {
        const costNum = Number(maintenanceCost);
        const maxCost = maintenanceCostCurrency === "COP" ? 400_000_000 : 100_000;
        if (!Number.isFinite(costNum) || costNum < 0 || costNum > maxCost) {
          setFeedback({ error: "El costo estimado no puede exceder 100.000 USD o 400.000.000 COP." });
          return;
        }
      }
    } else if (form.status === "LOST") {
      if (!lostNotes.trim()) {
        setFeedback({ error: "Debes ingresar una observación o responsable para el reporte de activo perdido." });
        return;
      }
    }

    if (editing) {
      setConfirmEditOpen(true);
      return;
    }
    await persistAsset();
  }

  async function persistAsset() {
    setSaving(true);
    setFeedback({});
    const input: Record<string, unknown> = {
      model: form.model.trim() || null,
      estimatedValue: form.estimatedValue
        ? convertToUsd(Number(form.estimatedValue), assetCurrency)
        : null,
      purchaseDate: form.purchaseDate || null,
      status: form.status,
      stockQuantity: form.stockQuantity ? Number(form.stockQuantity) : 1,
    };
    if (form.status === "LOANED") {
      input.loanTechnicianId = loanTechnicianId;
      input.loanStartDate = loanStartDate;
      input.loanDueDate = loanDueDate;
      input.loanStartTime = loanStartTime;
      input.loanEndTime = loanEndTime;
    } else if (form.status === "UNDER_MAINTENANCE") {
      input.maintenanceReason = maintenanceReason.trim();
      input.maintenanceCost = maintenanceCost
        ? convertToUsd(Number(maintenanceCost), maintenanceCostCurrency)
        : null;
      input.maintenanceProviderName = maintenanceProviderName.trim() || null;
    } else if (form.status === "LOST") {
      input.lostNotes = lostNotes.trim();
    }
    try {
      if (editing) await queryGraphQL<AssetResult>(UPDATE_ASSET, { input: { id: editing.id, ...input } });
      else await queryGraphQL<AssetResult>(CREATE_ASSET, { input });
      setFeedback({ success: editing ? "Activo actualizado." : "Activo registrado." });
      setFormOpen(false);
      setRefresh((value) => value + 1);
    } catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setSaving(false); }
  }

  return (
    <div className="work-page">
      <PageTitle
        eyebrow={isAdmin ? "INVENTARIO · ADMINISTRACIÓN" : "INVENTARIO · CATÁLOGO"}
        title="Activos"
        description={isAdmin ? "Registra, actualiza y localiza equipos del inventario." : "Busca equipos disponibles y revisa su estado de custodia."}
        action={isAdmin ? <Button onClick={() => openForm()}><Plus size={16} /> Registrar activo</Button> : undefined}
      />
      <Feedback {...feedback} />
      <section className="work-section">
        <div className="section-toolbar">
          <div className="toolbar-title"><Boxes size={17} /><strong>{isAdmin ? "Inventario" : "Catálogo de equipos"}</strong><span>{filtered.length}</span></div>
          <div className="toolbar-controls">
            <label className="search-control"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Número de serie o modelo" aria-label="Buscar número de serie o modelo" /></label>
            <SelectInput className="filter-select" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }} aria-label="Filtrar por estado">
              <option value="ALL">Todos los estados</option>
              <option value="AVAILABLE">Disponible</option>
              <option value="LOANED">En préstamo</option>
              <option value="UNDER_MAINTENANCE">En mantenimiento</option>
              <option value="LOST">Perdido</option>
            </SelectInput>
            <SelectInput className="filter-select" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(0); }} aria-label="Ordenar activos por">
              <option value="PURCHASE_DATE_DESC">Fecha compra (Recientes)</option>
              <option value="PURCHASE_DATE_ASC">Fecha compra (Antiguos)</option>
              <option value="MODEL_ASC">Modelo (A-Z)</option>
              <option value="MODEL_DESC">Modelo (Z-A)</option>
              <option value="VALUE_DESC">Valor (Mayor a menor)</option>
              <option value="VALUE_ASC">Valor (Menor a mayor)</option>
              <option value="STOCK_DESC">Unidades (Mayor a menor)</option>
              <option value="STOCK_ASC">Unidades (Menor a mayor)</option>
              <option value="STATUS">Estado</option>
            </SelectInput>
          </div>
        </div>
        {loading ? <LoadingRows label="Cargando activos" /> : visible.length === 0 ? (
          <EmptyState
            title={assets.length === 0 ? "Inventario sin activos" : "No hay resultados"}
            detail={assets.length === 0 ? "No se encontraron equipos tecnológicos disponibles en el inventario." : "Prueba con otro número de serie, modelo o estado."}
          />
        ) : (
          <DataTable headings={["Número de serie", "Modelo", ...(isTechnician ? [] : ["Valor estimado", "Fecha de compra"]), "Unidades", "Estado", ...(isAdmin ? ["Acciones"] : [])]}>
            {visible.map((asset) => (
              <tr key={asset.id}>
                <td>
                  <span className="copy-value"><span className="table-primary mono-cell telemetry-value font-mono">{asset.serialNumber}</span><CopyButton text={asset.serialNumber} label={`Copiar serie ${asset.serialNumber}`} /></span>
                  <small className="table-secondary id-copy-line font-mono">ID <span>{asset.id}</span><CopyButton className="inline-copy" text={asset.id} label={`Copiar ID de ${asset.serialNumber}`} /></small>
                </td>
                <td>{asset.model || "—"}</td>
                {!isTechnician && <><td>{asset.estimatedValue == null ? "—" : <CurrencyDisplay usdAmount={asset.estimatedValue} />}</td>
                <td className="telemetry-value font-mono">{asset.purchaseDate ?? "—"}</td></>}
                <td className="telemetry-value font-mono">{asset.stockQuantity ?? 1}</td>
                <td><StatusTag value={asset.status} /></td>
                {isAdmin && (
                  <td>
                    <button
                      className="table-action"
                      type="button"
                      onClick={() => openForm(asset)}
                      aria-label={`Editar activo ${asset.serialNumber}`}
                      title={`Editar activo ${asset.serialNumber}`}
                    >
                      <Edit3 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </DataTable>
        )}
        <PaginationControls currentPage={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={changePageSize} itemLabel="activos" />
      </section>

      {formOpen && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
            <section ref={dialogRef} tabIndex={-1} className="work-modal" role="dialog" aria-modal="true" aria-labelledby="asset-form-title">
            <div className="modal-heading">
              <div>
                <p className="work-eyebrow">INVENTARIO</p>
                <h2 id="asset-form-title">{editing ? "Editar activo" : "Registrar activo"}</h2>
              </div>
              <button type="button" className="table-action" aria-label="Cerrar" onClick={() => setFormOpen(false)}><X size={17} /></button>
            </div>
            <form className="work-form" onSubmit={saveAsset}>
              <div className="work-field"><span>Número de serie</span><div className="copy-value"><span className="serial-badge telemetry-value">{editing?.serialNumber ?? "Autogenerado por el sistema"}</span>{editing?.serialNumber && <CopyButton text={editing.serialNumber} label={`Copiar serie ${editing.serialNumber}`} />}</div></div>
              <FormField label="Modelo">
                <TextInput value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} required />
              </FormField>
              <div className="form-grid two-col">
                <FormField label="Valor estimado">
                  <div className="money-entry">
                    <TextInput className="telemetry-value" type="number" min={assetCurrency === "COP" ? "1000" : "0.25"} step="0.01" value={form.estimatedValue} onChange={(event) => setForm({ ...form, estimatedValue: event.target.value })} required />
                    <SelectInput className="currency-entry-select" value={assetCurrency} onChange={(event) => setAssetCurrency(event.target.value as typeof assetCurrency)} aria-label="Moneda del valor estimado">
                      <option value="USD">USD</option>
                      <option value="COP">COP</option>
                    </SelectInput>
                  </div>
                </FormField>
                <FormField label="Fecha de compra">
                  <TextInput
                    type="date"
                    max={todayIso}
                    value={form.purchaseDate}
                    onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })}
                    required
                  />
                </FormField>
              </div>
              <p className="form-hint">La tasa de referencia es 1 USD = 4.000 COP; el valor se guarda en USD.</p>
              <FormField label="Estado">
                <SelectInput value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="AVAILABLE">Disponible</option>
                  <option value="LOANED">En préstamo</option>
                  <option value="UNDER_MAINTENANCE">En mantenimiento</option>
                  <option value="LOST">Perdido</option>
                </SelectInput>
              </FormField>

              {form.status === "LOANED" && (
                <div className="dynamic-status-section work-section p-3 rounded-lg border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20 my-3">
                  <p className="work-eyebrow text-emerald-800 dark:text-emerald-300 mb-2">DETALLE DE PRÉSTAMO DIRECTO</p>
                  <FormField label="Técnico asignado">
                    <Combobox
                      value={loanTechnicianId}
                      onValueChange={setLoanTechnicianId}
                      options={technicianOptions}
                      placeholder="Selecciona un técnico activo"
                      searchPlaceholder="Buscar técnico por nombre o correo"
                      emptyMessage="No se encontraron técnicos activos."
                      required
                    />
                  </FormField>
                  <div className="form-grid two-col mt-2">
                    <FormField label="Fecha de inicio">
                      <TextInput
                        type="date"
                        min={todayIso}
                        value={loanStartDate}
                        onChange={(event) => setLoanStartDate(event.target.value)}
                        required
                      />
                    </FormField>
                    <FormField label="Hora de inicio">
                      <TextInput
                        type="time"
                        min="08:00"
                        max="18:00"
                        value={loanStartTime}
                        onChange={(event) => setLoanStartTime(event.target.value)}
                        required
                      />
                    </FormField>
                    <FormField label="Fecha de devolución">
                      <TextInput
                        type="date"
                        min={loanStartDate || todayIso}
                        value={loanDueDate}
                        onChange={(event) => setLoanDueDate(event.target.value)}
                        required
                      />
                    </FormField>
                    <FormField label="Hora de devolución">
                      <TextInput
                        type="time"
                        min="08:00"
                        max="18:00"
                        value={loanEndTime}
                        onChange={(event) => setLoanEndTime(event.target.value)}
                        required
                      />
                    </FormField>
                  </div>
                </div>
              )}

              {form.status === "UNDER_MAINTENANCE" && (
                <div className="dynamic-status-section work-section p-3 rounded-lg border border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/20 my-3">
                  <p className="work-eyebrow text-amber-800 dark:text-amber-300 mb-2">DETALLE DE ORDEN DE MANTENIMIENTO</p>
                  <FormField label="Motivo del servicio">
                    <TextInput
                      value={maintenanceReason}
                      onChange={(event) => setMaintenanceReason(event.target.value)}
                      placeholder="Ej: Calibración preventiva o reparación de componentes"
                      required
                    />
                  </FormField>
                  <FormField label="Proveedor técnico">
                    <Combobox
                      value={maintenanceProviderName}
                      onValueChange={setMaintenanceProviderName}
                      options={providerOptions}
                      placeholder="Selecciona o escribe el proveedor"
                      searchPlaceholder="Buscar proveedor"
                      emptyMessage="Escribe el nombre del proveedor para asignarlo."
                      required
                    />
                  </FormField>
                  <FormField label="Costo estimado">
                    <div className="money-entry">
                      <TextInput
                        className="telemetry-value"
                        type="number"
                        min="0"
                        max={maintenanceCostCurrency === "COP" ? "400000000" : "100000"}
                        step="0.01"
                        value={maintenanceCost}
                        onChange={(event) => setMaintenanceCost(event.target.value)}
                        placeholder="0.00"
                      />
                      <SelectInput
                        className="currency-entry-select"
                        value={maintenanceCostCurrency}
                        onChange={(event) => setMaintenanceCostCurrency(event.target.value as "USD" | "COP")}
                        aria-label="Moneda del costo de mantenimiento"
                      >
                        <option value="USD">USD</option>
                        <option value="COP">COP</option>
                      </SelectInput>
                    </div>
                    <small className="form-hint">Tope: 100.000 USD / 400.000.000 COP.</small>
                  </FormField>
                </div>
              )}

              {form.status === "LOST" && (
                <div className="dynamic-status-section work-section p-3 rounded-lg border border-red-500/30 bg-red-50/30 dark:bg-red-950/20 my-3">
                  <p className="work-eyebrow text-red-800 dark:text-red-300 mb-2">REPORTE FORMAL DE ACTIVO PERDIDO</p>
                  <FormField label="Observación / responsable">
                    <textarea
                      className="work-input work-textarea"
                      value={lostNotes}
                      onChange={(event) => setLostNotes(event.target.value)}
                      placeholder="Indica las circunstancias de la pérdida, último custodio o responsable identificado..."
                      rows={3}
                      required
                    />
                    <small className="form-hint">Este reporte quedará registrado en el historial de alertas y auditoría.</small>
                  </FormField>
                </div>
              )}
              <FormField label="Unidades / Stock">
                <TextInput type="number" min="1" step="1" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })} required />
              </FormField>
              <Feedback error={feedback.error} />
              <div className="modal-actions">
                <Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button type="submit" loading={saving}>Guardar activo</Button>
              </div>
            </form>
          </section>
        </div>
        </ModalPortal>
      )}

      {confirmEditOpen && (
        <ModalPortal>
          <div className="modal-backdrop confirmation-backdrop" role="presentation">
            <section ref={confirmDialogRef} tabIndex={-1} className="work-modal" role="alertdialog" aria-modal="true" aria-labelledby="asset-confirm-title" aria-describedby="asset-confirm-description">
              <div className="modal-heading">
                <div>
                  <p className="work-eyebrow">INVENTARIO · EDICIÓN</p>
                  <h2 id="asset-confirm-title">Confirmar cambios</h2>
                </div>
              </div>
              <p id="asset-confirm-description" className="legal-notice-copy">¿Deseas guardar los cambios realizados en el activo <span className="copy-value"><span className="telemetry-value">{editing?.serialNumber}</span>{editing?.serialNumber && <CopyButton text={editing.serialNumber} label={`Copiar serie ${editing.serialNumber}`} />}</span>?</p>
              <div className="modal-actions">
                <Button variant="secondary" type="button" onClick={() => setConfirmEditOpen(false)}>Volver a editar</Button>
                <Button type="button" loading={saving} onClick={() => { setConfirmEditOpen(false); void persistAsset(); }}>Guardar cambios</Button>
              </div>
            </section>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}