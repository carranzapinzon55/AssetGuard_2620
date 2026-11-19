"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Ban, CheckCircle2, ChevronDown, Pencil, Plus, Search, Wrench, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useCurrency, type Currency } from "@/components/currency-provider";
import { Combobox } from "@/components/workspace/combobox";
import { Button, CopyButton, CurrencyDisplay, DataTable, EmptyState, Feedback, FormField, LoadingRows, ModalPortal, PageTitle, PaginationControls, SelectInput, StatusTag, TextInput, useEscapeKey, useModalFocus } from "@/components/workspace/ui";
import { ASSETS_CATALOG_QUERY, COMPLETE_MAINTENANCE, CREATE_MAINTENANCE, CREATE_PROVIDER, DECOMMISSION_FROM_MAINTENANCE, MAINTENANCE_QUERY, PROVIDERS_QUERY, UPDATE_MAINTENANCE } from "@/lib/operations";
import { errorMessage, queryGraphQL, type AssetItem, type MaintenanceItem, type ProviderItem } from "@/lib/workspace";

type MaintenanceResult = { maintenanceRecords: MaintenanceItem[] };
type AssetsResult = { assets: AssetItem[] };
type ProvidersResult = { providers: ProviderItem[] };
type MutationResult = { createMaintenanceRecord: MaintenanceItem; completeMaintenance: MaintenanceItem };
const MAX_MAINTENANCE_COST_USD = 100_000;

export function MaintenancePage() {
  const { session } = useAuth();
  const { currency, convertToUsd, convertFromUsd } = useCurrency();
  const [records, setRecords] = useState<MaintenanceItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  // Modal Nueva Intervención
  const [formOpen, setFormOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [providerName, setProviderName] = useState("");
  const [reason, setReason] = useState("");
  const [cost, setCost] = useState("");
  const [costCurrency, setCostCurrency] = useState<Currency>(currency);
  const [showNewProviderNewModal, setShowNewProviderNewModal] = useState(false);

  // Modal Editar Intervención
  const [editingRecord, setEditingRecord] = useState<MaintenanceItem | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editProviderName, setEditProviderName] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editCostCurrency, setEditCostCurrency] = useState<Currency>(currency);
  const [showNewProviderEditModal, setShowNewProviderEditModal] = useState(false);

  // Auxiliar Registro de Proveedor
  const [newProviderName, setNewProviderName] = useState("");
  const [creatingProvider, setCreatingProvider] = useState(false);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [completing, setCompleting] = useState<MaintenanceItem | null>(null);

  // Modal Baja Definitiva
  const [decommissioning, setDecommissioning] = useState<MaintenanceItem | null>(null);
  const [decommissionNotes, setDecommissionNotes] = useState("");

  // Filtros y ordenamiento - Equipos en mantenimiento
  const [activeSearch, setActiveSearch] = useState("");
  const [activeProviderFilter, setActiveProviderFilter] = useState("ALL");
  const [activeSortBy, setActiveSortBy] = useState("START_DATE_DESC");
  const [activePage, setActivePage] = useState(0);
  const [activePageSize, setActivePageSize] = useState(10);

  // Filtros y ordenamiento - Historial de intervenciones
  const [historySearch, setHistorySearch] = useState("");
  const [historyProviderFilter, setHistoryProviderFilter] = useState("ALL");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("ALL");
  const [historySortBy, setHistorySortBy] = useState("START_DATE_DESC");
  const [historyPage, setHistoryPage] = useState(0);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEscapeKey(!saving && (formOpen || completing !== null || editingRecord !== null || decommissioning !== null), () => {
    if (decommissioning) setDecommissioning(null);
    else if (completing) setCompleting(null);
    else if (editingRecord) setEditingRecord(null);
    else setFormOpen(false);
  });
  const formDialogRef = useModalFocus(formOpen);
  const editDialogRef = useModalFocus(editingRecord !== null);
  const completionDialogRef = useModalFocus(completing !== null);
  const decommissionDialogRef = useModalFocus(decommissioning !== null);

  useEffect(() => {
    let active = true;
    Promise.all([
      queryGraphQL<MaintenanceResult>(MAINTENANCE_QUERY),
      queryGraphQL<AssetsResult>(ASSETS_CATALOG_QUERY),
      queryGraphQL<ProvidersResult>(PROVIDERS_QUERY),
    ])
      .then(([maintenance, assetResult, providerResult]) => {
        if (active) {
          setRecords(maintenance.maintenanceRecords);
          setAssets(assetResult.assets);
          setProviders(providerResult.providers.filter((p) => p.active));
        }
      })
      .catch((error: unknown) => { if (active) setFeedback({ error: errorMessage(error) }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token, refresh]);

  const activeRecords = useMemo(() => records.filter((record) => !record.endDate), [records]);

  const filteredActiveRecords = useMemo(() => {
    return activeRecords.filter((record) => {
      const text = `${record.asset.serialNumber} ${record.asset.model ?? ""} ${record.reason ?? ""} ${record.providerName ?? ""}`.toLowerCase();
      const matchesText = text.includes(activeSearch.trim().toLowerCase());
      const matchesProvider = activeProviderFilter === "ALL" || (record.providerName ?? "") === activeProviderFilter;
      return matchesText && matchesProvider;
    });
  }, [activeRecords, activeSearch, activeProviderFilter]);

  const sortedActiveRecords = useMemo(() => {
    return [...filteredActiveRecords].sort((a, b) => {
      switch (activeSortBy) {
        case "START_DATE_DESC":
          return (b.startDate ?? "").localeCompare(a.startDate ?? "");
        case "START_DATE_ASC":
          return (a.startDate ?? "").localeCompare(b.startDate ?? "");
        case "COST_DESC":
          return (b.cost ?? 0) - (a.cost ?? 0);
        case "COST_ASC":
          return (a.cost ?? 0) - (b.cost ?? 0);
        case "PROVIDER_ASC":
          return (a.providerName ?? "").localeCompare(b.providerName ?? "");
        default:
          return 0;
      }
    });
  }, [filteredActiveRecords, activeSortBy]);

  const filteredHistoryRecords = useMemo(() => {
    return records.filter((record) => {
      const text = `${record.asset.serialNumber} ${record.asset.model ?? ""} ${record.reason ?? ""} ${record.providerName ?? ""}`.toLowerCase();
      const matchesText = text.includes(historySearch.trim().toLowerCase());
      const matchesProvider = historyProviderFilter === "ALL" || (record.providerName ?? "") === historyProviderFilter;
      const matchesStatus = historyStatusFilter === "ALL" || record.asset.status === historyStatusFilter;
      return matchesText && matchesProvider && matchesStatus;
    });
  }, [records, historySearch, historyProviderFilter, historyStatusFilter]);

  const sortedHistoryRecords = useMemo(() => {
    return [...filteredHistoryRecords].sort((a, b) => {
      switch (historySortBy) {
        case "START_DATE_DESC":
          return (b.startDate ?? "").localeCompare(a.startDate ?? "");
        case "START_DATE_ASC":
          return (a.startDate ?? "").localeCompare(b.startDate ?? "");
        case "END_DATE_DESC":
          return (b.endDate ?? "").localeCompare(a.endDate ?? "");
        case "COST_DESC":
          return (b.cost ?? 0) - (a.cost ?? 0);
        case "COST_ASC":
          return (a.cost ?? 0) - (b.cost ?? 0);
        case "PROVIDER_ASC":
          return (a.providerName ?? "").localeCompare(b.providerName ?? "");
        default:
          return 0;
      }
    });
  }, [filteredHistoryRecords, historySortBy]);

  const visibleActiveRecords = sortedActiveRecords.slice(activePage * activePageSize, (activePage + 1) * activePageSize);
  const visibleHistoryRecords = sortedHistoryRecords.slice(historyPage * historyPageSize, (historyPage + 1) * historyPageSize);
  const availableAssets = assets.filter((asset) => (asset.availableQuantity ?? 0) > 0);
  const assetOptions = availableAssets.map((asset) => {
    const total = asset.stockQuantity ?? 1;
    const avail = asset.availableQuantity ?? 0;
    const label = `${avail} / ${total} ${avail === 1 ? "disponible" : "disponibles"}`;
    return {
      value: asset.id,
      label: `${asset.serialNumber} · ${asset.model ?? "Activo"} (${label})`,
    };
  });
  const selectedAsset = availableAssets.find((asset) => asset.id === assetId);

  const providerOptions = useMemo(() => {
    const list = providers.map((p) => ({ value: p.name, label: p.name }));
    if (providerName && !list.some((p) => p.value === providerName)) {
      list.unshift({ value: providerName, label: providerName });
    }
    return list;
  }, [providers, providerName]);

  const editProviderOptions = useMemo(() => {
    const list = providers.map((p) => ({ value: p.name, label: p.name }));
    if (editProviderName && !list.some((p) => p.value === editProviderName)) {
      list.unshift({ value: editProviderName, label: editProviderName });
    }
    return list;
  }, [providers, editProviderName]);

  function toggleCostCurrency() {
    const nextCurrency: Currency = costCurrency === "USD" ? "COP" : "USD";
    if (cost.trim()) {
      const amountInUsd = convertToUsd(Number(cost), costCurrency);
      setCost(convertFromUsd(amountInUsd, nextCurrency).toFixed(2));
    }
    setCostCurrency(nextCurrency);
  }

  function toggleEditCostCurrency() {
    const nextCurrency: Currency = editCostCurrency === "USD" ? "COP" : "USD";
    if (editCost.trim()) {
      const amountInUsd = convertToUsd(Number(editCost), editCostCurrency);
      setEditCost(convertFromUsd(amountInUsd, nextCurrency).toFixed(2));
    }
    setEditCostCurrency(nextCurrency);
  }

  async function handleCreateProvider(target: "new" | "edit") {
    const trimmed = newProviderName.trim();
    if (!trimmed) return;
    setCreatingProvider(true);
    try {
      const result = await queryGraphQL<{ createProvider: ProviderItem }>(CREATE_PROVIDER, { name: trimmed });
      const created = result.createProvider;
      setProviders((prev) => {
        if (prev.some((p) => p.name.toLowerCase() === created.name.toLowerCase())) return prev;
        return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
      });
      if (target === "new") {
        setProviderName(created.name);
        setShowNewProviderNewModal(false);
      } else {
        setEditProviderName(created.name);
        setShowNewProviderEditModal(false);
      }
      setNewProviderName("");
    } catch (error) {
      setFeedback({ error: errorMessage(error) });
    } finally {
      setCreatingProvider(false);
    }
  }

  function startEdit(record: MaintenanceItem) {
    setEditingRecord(record);
    setEditReason(record.reason ?? "");
    setEditProviderName(record.providerName ?? "");
    setShowNewProviderEditModal(false);
    setNewProviderName("");
    if (record.cost != null) {
      if (currency === "COP") {
        setEditCost(convertFromUsd(record.cost, "COP").toFixed(2));
        setEditCostCurrency("COP");
      } else {
        setEditCost(String(record.cost));
        setEditCostCurrency("USD");
      }
    } else {
      setEditCost("");
      setEditCostCurrency(currency);
    }
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assetId) { setFeedback({ error: "Debes seleccionar un equipo." }); return; }
    const enteredCost = cost.trim() ? Number(cost) : null;
    const costInUsd = enteredCost == null ? null : convertToUsd(enteredCost, costCurrency);
    if (costInUsd != null && (!Number.isFinite(costInUsd) || costInUsd < 0 || costInUsd > MAX_MAINTENANCE_COST_USD)) {
      setFeedback({ error: "El costo máximo permitido es 100.000 USD (400.000.000 COP)." });
      return;
    }
    setSaving(true); setFeedback({});
    const input = {
      assetId,
      providerName: providerName || null,
      reason,
      cost: costInUsd,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: null,
    };
    try {
      try {
        await queryGraphQL<MutationResult>(CREATE_MAINTENANCE, { input });
      } catch (mutationError) {
        const latest = await queryGraphQL<MaintenanceResult>(MAINTENANCE_QUERY);
        const knownIds = new Set(records.map((record) => record.id));
        const persisted = latest.maintenanceRecords.some((record) =>
          !knownIds.has(record.id)
          && record.asset.id === assetId
          && record.startDate === input.startDate,
        );
        if (!persisted) throw mutationError;
      }

      setFormOpen(false);
      setAssetId("");
      setProviderName("");
      setReason("");
      setCost("");
      setCostCurrency(currency);
      setShowNewProviderNewModal(false);
      setActivePage(0);
      setHistoryPage(0);
      setFeedback({ success: "Equipo enviado a mantenimiento." });
      setRefresh((previous) => previous + 1);
    } catch (error) {
      setFeedback({ error: errorMessage(error) });
    }
    finally { setSaving(false); }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRecord) return;
    const enteredCost = editCost.trim() ? Number(editCost) : null;
    const costInUsd = enteredCost == null ? null : convertToUsd(enteredCost, editCostCurrency);
    if (costInUsd != null && (!Number.isFinite(costInUsd) || costInUsd < 0 || costInUsd > MAX_MAINTENANCE_COST_USD)) {
      setFeedback({ error: "El costo máximo permitido es 100.000 USD (400.000.000 COP)." });
      return;
    }
    setSaving(true);
    setFeedback({});
    const input = {
      recordId: editingRecord.id,
      providerName: editProviderName || null,
      reason: editReason || null,
      cost: costInUsd,
    };
    try {
      await queryGraphQL<{ updateMaintenanceRecord: MaintenanceItem }>(UPDATE_MAINTENANCE, { input });
      setEditingRecord(null);
      setFeedback({ success: "Intervención actualizada." });
      setRefresh((previous) => previous + 1);
    } catch (error) {
      setFeedback({ error: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function complete() {
    if (!completing) return;
    setSaving(true); setFeedback({});
    try { await queryGraphQL<MutationResult>(COMPLETE_MAINTENANCE, { input: { recordId: completing.id } }); setActivePage(0); setHistoryPage(0); setFeedback({ success: `${completing.asset.serialNumber} certificado y disponible.` }); setCompleting(null); setRefresh((value) => value + 1); }
    catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setSaving(false); }
  }

  function startDecommission(record: MaintenanceItem) {
    setDecommissioning(record);
    setDecommissionNotes("");
  }

  async function handleDecommission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decommissioning) return;
    if (decommissionNotes.trim().length < 10) {
      setFeedback({ error: "El diagnóstico técnico debe tener al menos 10 caracteres." });
      return;
    }
    setSaving(true);
    setFeedback({});
    try {
      await queryGraphQL<{ decommissionFromMaintenance: MaintenanceItem }>(DECOMMISSION_FROM_MAINTENANCE, {
        id: decommissioning.id,
        notes: decommissionNotes.trim(),
      });
      setActivePage(0);
      setHistoryPage(0);
      setFeedback({ success: `${decommissioning.asset.serialNumber} dado de baja definitiva e imputado a mermas permanentes.` });
      setDecommissioning(null);
      setDecommissionNotes("");
      setRefresh((previous) => previous + 1);
    } catch (error) {
      setFeedback({ error: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="work-page">
      <PageTitle eyebrow="OPERACIONES · INSPECCIÓN" title="Mantenimiento técnico" description="Registra intervenciones y certifica el retorno de equipos al inventario disponible." action={<Button onClick={() => { setCostCurrency(currency); setShowNewProviderNewModal(false); setFormOpen(true); }}><Plus size={16} /> Enviar a mantenimiento</Button>} />
      <Feedback {...feedback} />
      <section className="work-section">
        <div className="section-toolbar">
          <div className="toolbar-title"><Wrench size={17} /><strong>Equipos en mantenimiento</strong><span>{sortedActiveRecords.length}</span></div>
          <div className="toolbar-controls">
            <label className="search-control">
              <Search size={16} />
              <input value={activeSearch} onChange={(e) => { setActiveSearch(e.target.value); setActivePage(0); }} placeholder="Serie, modelo, motivo..." aria-label="Buscar en equipos en mantenimiento" />
            </label>
            <SelectInput className="filter-select" value={activeProviderFilter} onChange={(e) => { setActiveProviderFilter(e.target.value); setActivePage(0); }} aria-label="Filtrar por proveedor">
              <option value="ALL">Todos los proveedores</option>
              {providers.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </SelectInput>
            <SelectInput className="filter-select" value={activeSortBy} onChange={(e) => { setActiveSortBy(e.target.value); setActivePage(0); }} aria-label="Ordenar equipos en mantenimiento">
              <option value="START_DATE_DESC">Fecha inicio (Reciente)</option>
              <option value="START_DATE_ASC">Fecha inicio (Antigua)</option>
              <option value="COST_DESC">Costo (Mayor)</option>
              <option value="COST_ASC">Costo (Menor)</option>
              <option value="PROVIDER_ASC">Proveedor (A-Z)</option>
            </SelectInput>
          </div>
        </div>
        {loading ? <LoadingRows label="Cargando registros" /> : sortedActiveRecords.length === 0 ? <EmptyState title="No hay equipos en intervención" detail="Los equipos enviados a mantenimiento aparecerán en esta bandeja." /> : <DataTable headings={["Activo", "Motivo", "Proveedor", "Inicio", "Costo", "Estado", "Acción"]}>{visibleActiveRecords.map((record) => <tr key={record.id}><td><span className="copy-value"><span className="table-primary mono-cell telemetry-value font-mono">{record.asset.serialNumber}</span><CopyButton text={record.asset.serialNumber} label={`Copiar serie ${record.asset.serialNumber}`} /></span><small className="table-secondary">{record.asset.model}</small><small className="table-secondary id-copy-line font-mono">ID <span>{record.id}</span><CopyButton className="inline-copy" text={record.id} label={`Copiar ID del mantenimiento de ${record.asset.serialNumber}`} /></small></td><td>{record.reason || "—"}</td><td>{record.providerName || "—"}</td><td className="telemetry-value font-mono">{record.startDate || "—"}</td><td>{record.cost == null ? "—" : <CurrencyDisplay usdAmount={record.cost} />}</td><td><StatusTag value={record.asset.status} /></td><td><div className="inline-actions"><button className="table-action" type="button" title={`Editar intervención de ${record.asset.serialNumber}`} aria-label={`Editar intervención de ${record.asset.serialNumber}`} onClick={() => startEdit(record)}><Pencil size={15} /></button><button className="table-action" type="button" title={`Certificar retorno de ${record.asset.serialNumber}`} aria-label={`Certificar retorno de ${record.asset.serialNumber}`} onClick={() => setCompleting(record)}><CheckCircle2 size={15} /></button><button className="table-action table-action-danger" type="button" title={`Dar de baja definitiva ${record.asset.serialNumber}`} aria-label={`Dar de baja definitiva ${record.asset.serialNumber}`} onClick={() => startDecommission(record)}><Ban size={15} /></button></div></td></tr>)}</DataTable>}
        <PaginationControls currentPage={activePage} totalItems={sortedActiveRecords.length} pageSize={activePageSize} onPageChange={setActivePage} onPageSizeChange={(size) => { setActivePageSize(size); setActivePage(0); }} loading={loading} itemLabel="intervenciones activas" />
      </section>
      <section className="work-section secondary-section">
        <div className="section-toolbar">
          <div className="toolbar-title"><CheckCircle2 size={17} /><strong>Historial de intervenciones</strong><span>{sortedHistoryRecords.length}</span></div>
          <div className="toolbar-controls">
            <label className="search-control">
              <Search size={16} />
              <input value={historySearch} onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(0); }} placeholder="Serie, modelo, motivo..." aria-label="Buscar en historial de intervenciones" />
            </label>
            <SelectInput className="filter-select" value={historyProviderFilter} onChange={(e) => { setHistoryProviderFilter(e.target.value); setHistoryPage(0); }} aria-label="Filtrar por proveedor en historial">
              <option value="ALL">Todos los proveedores</option>
              {providers.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </SelectInput>
            <SelectInput className="filter-select" value={historyStatusFilter} onChange={(e) => { setHistoryStatusFilter(e.target.value); setHistoryPage(0); }} aria-label="Filtrar por estado en historial">
              <option value="ALL">Todos los estados</option>
              <option value="AVAILABLE">Disponible</option>
              <option value="UNDER_MAINTENANCE">En mantenimiento</option>
            </SelectInput>
            <SelectInput className="filter-select" value={historySortBy} onChange={(e) => { setHistorySortBy(e.target.value); setHistoryPage(0); }} aria-label="Ordenar historial de intervenciones">
              <option value="START_DATE_DESC">Fecha inicio (Reciente)</option>
              <option value="START_DATE_ASC">Fecha inicio (Antigua)</option>
              <option value="END_DATE_DESC">Fecha cierre (Reciente)</option>
              <option value="COST_DESC">Costo (Mayor)</option>
              <option value="COST_ASC">Costo (Menor)</option>
              <option value="PROVIDER_ASC">Proveedor (A-Z)</option>
            </SelectInput>
            <button
              type="button"
              className="loans-collapse-trigger"
              aria-expanded={historyExpanded}
              aria-controls="maintenance-history-panel"
              onClick={() => setHistoryExpanded((expanded) => !expanded)}
            >
              <span>{historyExpanded ? "Contraer" : "Expandir"}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div id="maintenance-history-panel" hidden={!historyExpanded}>
          {loading ? (
            <LoadingRows label="Cargando historial" />
          ) : sortedHistoryRecords.length === 0 ? (
            <EmptyState title="Sin intervenciones registradas" detail="Cuando se inicie una intervención, aparecerá aquí su historial." />
          ) : (
            <DataTable headings={["Activo", "Motivo", "Proveedor", "Inicio", "Cierre", "Costo", "Estado actual"]}>
              {visibleHistoryRecords.map((record) => (
                <tr key={record.id}>
                  <td>
                    <span className="copy-value">
                      <span className="mono-cell telemetry-value font-mono">{record.asset.serialNumber}</span>
                      <CopyButton text={record.asset.serialNumber} label={`Copiar serie ${record.asset.serialNumber}`} />
                    </span>
                    <small className="table-secondary id-copy-line font-mono">
                      ID <span>{record.id}</span>
                      <CopyButton className="inline-copy" text={record.id} label={`Copiar ID del mantenimiento de ${record.asset.serialNumber}`} />
                    </small>
                  </td>
                  <td>{record.reason || "—"}</td>
                  <td>{record.providerName || "—"}</td>
                  <td className="telemetry-value font-mono">{record.startDate || "—"}</td>
                  <td className="telemetry-value font-mono">{record.endDate || "En curso"}</td>
                  <td>{record.cost == null ? "—" : <CurrencyDisplay usdAmount={record.cost} />}</td>
                  <td><StatusTag value={record.asset.status} /></td>
                </tr>
              ))}
            </DataTable>
          )}
          <PaginationControls currentPage={historyPage} totalItems={sortedHistoryRecords.length} pageSize={historyPageSize} onPageChange={setHistoryPage} onPageSizeChange={(size) => { setHistoryPageSize(size); setHistoryPage(0); }} loading={loading} itemLabel="intervenciones" />
        </div>
      </section>

      {/* Modal Nueva intervención */}
      {formOpen && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation"><section ref={formDialogRef} tabIndex={-1} className="work-modal" role="dialog" aria-modal="true" aria-labelledby="maintenance-title"><div className="modal-heading"><div><p className="work-eyebrow">CONTROL TÉCNICO</p><h2 id="maintenance-title">Nueva intervención</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setFormOpen(false)}><X size={17} /></button></div><form className="work-form" onSubmit={createRecord}><div className="work-field"><span>Activo</span><div className="asset-combobox-row"><Combobox value={assetId} onValueChange={setAssetId} options={assetOptions} placeholder="Selecciona un equipo" searchPlaceholder="Buscar por serie o modelo" emptyMessage="No hay equipos disponibles." required />{selectedAsset && <CopyButton text={selectedAsset.serialNumber} label={`Copiar serie ${selectedAsset.serialNumber}`} />}</div></div><FormField label="Motivo de intervención"><TextInput value={reason} onChange={(event) => setReason(event.target.value)} required /></FormField><FormField label="Proveedor técnico"><div className="asset-combobox-row"><Combobox value={providerName} onValueChange={setProviderName} options={providerOptions} placeholder="Selecciona un proveedor técnico" searchPlaceholder="Buscar empresa técnica..." emptyMessage="No se encontraron proveedores." />{providerName && <button type="button" className="table-action" title="Quitar proveedor asignado" aria-label="Quitar proveedor asignado" onClick={() => setProviderName("")}><X size={14} /></button>}</div>{!showNewProviderNewModal ? <div style={{ marginTop: "0.25rem" }}><button type="button" className="form-hint" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.25rem", textDecoration: "underline" }} onClick={() => { setShowNewProviderNewModal(true); setNewProviderName(""); }}><Plus size={13} /> Añadir nuevo proveedor al catálogo</button></div> : <div className="provider-quick-register"><span className="provider-quick-register-title">Registrar nueva empresa tecnológica:</span><div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}><TextInput placeholder="Nombre de la empresa" value={newProviderName} onChange={(e) => setNewProviderName(e.target.value)} disabled={creatingProvider} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleCreateProvider("new"); } }} /><Button type="button" disabled={creatingProvider || !newProviderName.trim()} loading={creatingProvider} onClick={() => void handleCreateProvider("new")}>Guardar</Button><Button type="button" variant="secondary" disabled={creatingProvider} onClick={() => { setShowNewProviderNewModal(false); setNewProviderName(""); }}>Cancelar</Button></div></div>}</FormField><FormField label="Costo estimado"><div className="money-entry"><TextInput className="telemetry-value" type="number" min="0" max={costCurrency === "COP" ? MAX_MAINTENANCE_COST_USD * 4000 : MAX_MAINTENANCE_COST_USD} step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} /><button className="currency-entry-label" type="button" onClick={toggleCostCurrency} aria-label={`Cambiar moneda de entrada, actual ${costCurrency}`}>{costCurrency}</button></div><small className="form-hint">Máximo: {costCurrency === "COP" ? "400.000.000 COP" : "100.000 USD"}.</small></FormField><p className="form-hint">La tasa de referencia es 1 USD = 4.000 COP; el costo se guarda en USD. Al guardar, el equipo quedará marcado como &quot;En mantenimiento&quot;.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>Iniciar mantenimiento</Button></div></form></section></div>
        </ModalPortal>
      )}

      {/* Modal Editar intervención */}
      {editingRecord && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation"><section ref={editDialogRef} tabIndex={-1} className="work-modal" role="dialog" aria-modal="true" aria-labelledby="edit-maintenance-title"><div className="modal-heading"><div><p className="work-eyebrow">CONTROL TÉCNICO</p><h2 id="edit-maintenance-title">Editar intervención</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setEditingRecord(null)}><X size={17} /></button></div><form className="work-form" onSubmit={saveEdit}><div className="work-field"><span>Activo en intervención</span><div className="asset-combobox-row"><TextInput value={`${editingRecord.asset.serialNumber} · ${editingRecord.asset.model ?? "Activo"}`} disabled readOnly /><CopyButton text={editingRecord.asset.serialNumber} label={`Copiar serie ${editingRecord.asset.serialNumber}`} /></div></div><FormField label="Motivo de intervención"><TextInput value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Describe el motivo o falla técnica" required /></FormField><FormField label="Proveedor técnico"><div className="asset-combobox-row"><Combobox value={editProviderName} onValueChange={setEditProviderName} options={editProviderOptions} placeholder="Selecciona un proveedor técnico" searchPlaceholder="Buscar empresa técnica..." emptyMessage="No se encontraron proveedores." />{editProviderName && <button type="button" className="table-action" title="Quitar proveedor asignado" aria-label="Quitar proveedor asignado" onClick={() => setEditProviderName("")}><X size={14} /></button>}</div>{!showNewProviderEditModal ? <div style={{ marginTop: "0.25rem" }}><button type="button" className="form-hint" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.25rem", textDecoration: "underline" }} onClick={() => { setShowNewProviderEditModal(true); setNewProviderName(""); }}><Plus size={13} /> Añadir nuevo proveedor al catálogo</button></div> : <div className="provider-quick-register"><span className="provider-quick-register-title">Registrar nueva empresa tecnológica:</span><div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}><TextInput placeholder="Nombre de la empresa" value={newProviderName} onChange={(e) => setNewProviderName(e.target.value)} disabled={creatingProvider} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleCreateProvider("edit"); } }} /><Button type="button" disabled={creatingProvider || !newProviderName.trim()} loading={creatingProvider} onClick={() => void handleCreateProvider("edit")}>Guardar</Button><Button type="button" variant="secondary" disabled={creatingProvider} onClick={() => { setShowNewProviderEditModal(false); setNewProviderName(""); }}>Cancelar</Button></div></div>}</FormField><FormField label="Costo estimado / total de reparación"><div className="money-entry"><TextInput className="telemetry-value" type="number" min="0" max={editCostCurrency === "COP" ? MAX_MAINTENANCE_COST_USD * 4000 : MAX_MAINTENANCE_COST_USD} step="0.01" value={editCost} onChange={(event) => setEditCost(event.target.value)} placeholder="0.00" /><button className="currency-entry-label" type="button" onClick={toggleEditCostCurrency} aria-label={`Cambiar moneda de entrada, actual ${editCostCurrency}`}>{editCostCurrency}</button></div><small className="form-hint">Máximo: {editCostCurrency === "COP" ? "400.000.000 COP" : "100.000 USD"}.</small></FormField><p className="form-hint">La tasa de referencia es 1 USD = 4.000 COP; el costo se actualiza y consolida en USD.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setEditingRecord(null)}>Cancelar</Button><Button type="submit" loading={saving}>Guardar cambios</Button></div></form></section></div>
        </ModalPortal>
      )}

      {/* Modal Confirmar certificación de retorno */}
      {completing && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation"><section ref={completionDialogRef} tabIndex={-1} className="work-modal" role="alertdialog" aria-modal="true" aria-labelledby="complete-title" aria-describedby="complete-description"><div className="modal-heading"><div><p className="work-eyebrow">CONTROL TÉCNICO</p><h2 id="complete-title">Confirmar certificación de retorno</h2></div><button className="table-action" type="button" title="Cerrar confirmación" aria-label="Cerrar confirmación" onClick={() => setCompleting(null)}><X size={17} /></button></div><p id="complete-description" className="legal-notice-copy">Al certificar el retorno de <span className="copy-value"><span className="telemetry-value">{completing.asset.serialNumber}</span><CopyButton text={completing.asset.serialNumber} label={`Copiar serie ${completing.asset.serialNumber}`} /></span>, el registro de mantenimiento se cerrará y el activo quedará disponible.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setCompleting(null)}>Cancelar</Button><Button type="button" loading={saving} onClick={() => void complete()}>Certificar retorno</Button></div></section></div>
        </ModalPortal>
      )}

      {/* Modal Dar de baja definitiva */}
      {decommissioning && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation">
            <section ref={decommissionDialogRef} tabIndex={-1} className="work-modal" role="dialog" aria-modal="true" aria-labelledby="decommission-title">
              <div className="modal-heading">
                <div>
                  <p className="work-eyebrow text-rose-600 dark:text-rose-400">BAJA TÉCNICA DEFINITIVA</p>
                  <h2 id="decommission-title">Dar de baja definitiva</h2>
                </div>
                <button className="table-action" type="button" aria-label="Cerrar" onClick={() => setDecommissioning(null)}><X size={17} /></button>
              </div>
              <form className="work-form" onSubmit={handleDecommission}>
                <div className="decommission-summary">
                  <div><strong>Serie:</strong> <span className="telemetry-value font-mono">{decommissioning.asset.serialNumber}</span></div>
                  <div><strong>Modelo:</strong> <span>{decommissioning.asset.model || "—"}</span></div>
                  <div><strong>Valor estimado:</strong> <span>{decommissioning.asset.estimatedValue != null ? <CurrencyDisplay usdAmount={decommissioning.asset.estimatedValue} /> : "No especificado"}</span></div>
                </div>

                <div className="decommission-alert">
                  <p>
                    ⚠️ <strong>Confirmación de merma permanente:</strong> Esta acción cerrará la orden de mantenimiento y contabilizará permanentemente este equipo como pérdida/merma en el Dashboard financiero. Esta acción no se puede deshacer y la unidad se descontará del inventario disponible.
                  </p>
                </div>

                <FormField label="Diagnóstico técnico de daño irreparable (obligatorio)">
                  <textarea
                    className="work-input work-textarea"
                    value={decommissionNotes}
                    onChange={(e) => setDecommissionNotes(e.target.value)}
                    placeholder="Describe el daño irreparable, costo inviable de reparación o fallo catastrófico que justifica la baja..."
                    rows={4}
                    minLength={10}
                    required
                  />
                  <small className={`character-counter ${decommissionNotes.trim().length >= 10 ? "met" : ""}`}>
                    {decommissionNotes.trim().length} / 10 caracteres mínimo
                  </small>
                </FormField>

                <div className="modal-actions">
                  <Button variant="secondary" type="button" onClick={() => setDecommissioning(null)}>Cancelar</Button>
                  <Button variant="danger" type="submit" loading={saving} disabled={decommissionNotes.trim().length < 10}>
                    Confirmar baja definitiva
                  </Button>
                </div>
              </form>
            </section>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
