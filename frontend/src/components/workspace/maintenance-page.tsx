"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Plus, Wrench, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, DataTable, EmptyState, Feedback, FormField, LoadingRows, PageTitle, StatusTag, TextInput, useEscapeKey, useModalFocus } from "@/components/workspace/ui";
import { ASSETS_QUERY, COMPLETE_MAINTENANCE, CREATE_MAINTENANCE, MAINTENANCE_QUERY } from "@/lib/operations";
import { errorMessage, queryGraphQL, type AssetItem, type MaintenanceItem } from "@/lib/workspace";

type MaintenanceResult = { maintenanceRecords: MaintenanceItem[] };
type AssetsResult = { assets: AssetItem[] };
type MutationResult = { createMaintenanceRecord: MaintenanceItem; completeMaintenance: MaintenanceItem };

export function MaintenancePage() {
  const { session } = useAuth();
  const [records, setRecords] = useState<MaintenanceItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [providerName, setProviderName] = useState("");
  const [reason, setReason] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [completing, setCompleting] = useState<MaintenanceItem | null>(null);

  useEscapeKey(!saving && (formOpen || completing !== null), () => {
    if (completing) setCompleting(null);
    else setFormOpen(false);
  });
  const formDialogRef = useModalFocus(formOpen);
  const completionDialogRef = useModalFocus(completing !== null);
  useEffect(() => {
    let active = true;
    Promise.all([queryGraphQL<MaintenanceResult>(MAINTENANCE_QUERY), queryGraphQL<AssetsResult>(ASSETS_QUERY)])
      .then(([maintenance, assetResult]) => { if (active) { setRecords(maintenance.maintenanceRecords); setAssets(assetResult.assets); } })
      .catch((error: unknown) => { if (active) setFeedback({ error: errorMessage(error) }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token, refresh]);

  const activeRecords = useMemo(() => records.filter((record) => !record.endDate), [records]);
  const availableAssets = assets.filter((asset) => asset.status !== "LOST" && asset.status !== "UNDER_MAINTENANCE");

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFeedback({});
    const input = {
      assetId,
      providerName: providerName || null,
      reason,
      cost: cost ? Number(cost) : null,
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
      setFeedback({ success: "Equipo enviado a mantenimiento." });
      setRefresh((previous) => previous + 1);
    } catch (error) {
      setFeedback({ error: errorMessage(error) });
    }
    finally { setSaving(false); }
  }

  async function complete() {
    if (!completing) return;
    setSaving(true); setFeedback({});
    try { await queryGraphQL<MutationResult>(COMPLETE_MAINTENANCE, { input: { recordId: completing.id } }); setFeedback({ success: `${completing.asset.serialNumber} certificado y disponible.` }); setCompleting(null); setRefresh((value) => value + 1); }
    catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setSaving(false); }
  }

  return (
    <div className="work-page">
      <PageTitle eyebrow="OPERACIONES · INSPECCIÓN" title="Mantenimiento técnico" description="Registra intervenciones y certifica el retorno de equipos al inventario disponible." action={<Button onClick={() => setFormOpen(true)}><Plus size={16} /> Enviar a mantenimiento</Button>} />
      <Feedback {...feedback} />
      <section className="work-section"><div className="section-toolbar"><div className="toolbar-title"><Wrench size={17} /><strong>Equipos en mantenimiento</strong><span>{activeRecords.length}</span></div><span className="toolbar-note">AL CERRAR UN REGISTRO, EL ACTIVO QUEDA DISPONIBLE</span></div>
        {loading ? <LoadingRows label="Cargando registros" /> : activeRecords.length === 0 ? <EmptyState title="No hay equipos en intervención" detail="Los equipos enviados a mantenimiento aparecerán en esta bandeja." /> : <DataTable headings={["Activo", "Motivo", "Proveedor", "Inicio", "Costo", "Estado", "Acción"]}>{activeRecords.map((record) => <tr key={record.id}><td><span className="table-primary mono-cell">{record.asset.serialNumber}</span><small className="table-secondary">{record.asset.model}</small></td><td>{record.reason || "—"}</td><td>{record.providerName || "—"}</td><td>{record.startDate || "—"}</td><td>{record.cost == null ? "—" : new Intl.NumberFormat("es", { style: "currency", currency: "USD" }).format(record.cost)}</td><td><StatusTag value={record.asset.status} /></td><td><button className="table-action" type="button" title={`Certificar retorno de ${record.asset.serialNumber}`} aria-label={`Certificar retorno de ${record.asset.serialNumber}`} onClick={() => setCompleting(record)}><CheckCircle2 size={15} /></button></td></tr>)}</DataTable>}
      </section>
      <section className="work-section secondary-section"><div className="section-toolbar"><div className="toolbar-title"><CheckCircle2 size={17} /><strong>Historial de intervenciones</strong><span>{records.length}</span></div></div>{records.length === 0 ? <EmptyState title="Sin intervenciones registradas" detail="Cuando se inicie una intervención, aparecerá aquí su historial." /> : <DataTable headings={["Activo", "Motivo", "Inicio", "Cierre", "Estado actual"]}>{records.map((record) => <tr key={record.id}><td className="mono-cell">{record.asset.serialNumber}</td><td>{record.reason || "—"}</td><td>{record.startDate || "—"}</td><td>{record.endDate || "En curso"}</td><td><StatusTag value={record.asset.status} /></td></tr>)}</DataTable>}</section>
      {formOpen && <div className="modal-backdrop" role="presentation"><section ref={formDialogRef} tabIndex={-1} className="work-modal" role="dialog" aria-modal="true" aria-labelledby="maintenance-title"><div className="modal-heading"><div><p className="work-eyebrow">CONTROL TÉCNICO</p><h2 id="maintenance-title">Nueva intervención</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setFormOpen(false)}><X size={17} /></button></div><form className="work-form" onSubmit={createRecord}><FormField label="Activo"><select className="work-input" value={assetId} onChange={(event) => setAssetId(event.target.value)} required><option value="">Selecciona un equipo</option>{availableAssets.map((asset) => <option value={asset.id} key={asset.id}>{asset.serialNumber} · {asset.model}</option>)}</select></FormField><FormField label="Motivo de intervención"><TextInput value={reason} onChange={(event) => setReason(event.target.value)} required /></FormField><FormField label="Proveedor técnico"><TextInput value={providerName} onChange={(event) => setProviderName(event.target.value)} /></FormField><FormField label="Costo estimado"><TextInput type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} /></FormField><p className="form-hint">Al guardar, el equipo quedará marcado como &quot;En mantenimiento&quot;.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>Iniciar mantenimiento</Button></div></form></section></div>}
      {completing && <div className="modal-backdrop" role="presentation"><section ref={completionDialogRef} tabIndex={-1} className="work-modal" role="alertdialog" aria-modal="true" aria-labelledby="complete-title" aria-describedby="complete-description"><div className="modal-heading"><div><p className="work-eyebrow">CONTROL TÉCNICO</p><h2 id="complete-title">Confirmar certificación de retorno</h2></div><button className="table-action" type="button" title="Cerrar confirmación" aria-label="Cerrar confirmación" onClick={() => setCompleting(null)}><X size={17} /></button></div><p id="complete-description" className="legal-notice-copy">Al certificar el retorno de {completing.asset.serialNumber}, el registro de mantenimiento se cerrará y el activo quedará disponible.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setCompleting(null)}>Cancelar</Button><Button type="button" loading={saving} onClick={() => void complete()}>Certificar retorno</Button></div></section></div>}
    </div>
  );
}