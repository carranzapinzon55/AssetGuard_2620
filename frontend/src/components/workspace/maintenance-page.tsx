"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Plus, Wrench } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, DataTable, EmptyState, Feedback, FormField, LoadingRows, PageTitle, StatusTag, TextInput } from "@/components/workspace/ui";
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
    try {
      await queryGraphQL<MutationResult>(CREATE_MAINTENANCE, { input: { assetId, providerName: providerName || null, reason, cost: cost ? Number(cost) : null, startDate: new Date().toISOString().slice(0, 10), endDate: null } });
      setFormOpen(false); setAssetId(""); setProviderName(""); setReason(""); setCost(""); setFeedback({ success: "Equipo enviado a mantenimiento." }); setRefresh((value) => value + 1);
    } catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setSaving(false); }
  }

  async function complete(record: MaintenanceItem) {
    setSaving(true); setFeedback({});
    try { await queryGraphQL<MutationResult>(COMPLETE_MAINTENANCE, { input: { recordId: record.id } }); setFeedback({ success: `${record.asset.serialNumber} certificado y disponible.` }); setRefresh((value) => value + 1); }
    catch (error) { setFeedback({ error: errorMessage(error) }); }
    finally { setSaving(false); }
  }

  return (
    <div className="work-page">
      <PageTitle eyebrow="OPERACIONES · INSPECCIÓN" title="Mantenimiento técnico" description="Registra intervenciones y certifica el retorno de equipos al inventario disponible." action={<Button onClick={() => setFormOpen(true)}><Plus size={16} /> Enviar a mantenimiento</Button>} />
      <Feedback {...feedback} />
      <section className="work-section"><div className="section-toolbar"><div className="toolbar-title"><Wrench size={17} /><strong>Equipos en mantenimiento</strong><span>{activeRecords.length}</span></div><span className="toolbar-note">AL CERRAR UN REGISTRO, EL ACTIVO PASA A AVAILABLE</span></div>
        {loading ? <LoadingRows label="Cargando registros" /> : activeRecords.length === 0 ? <EmptyState title="No hay equipos en intervención" detail="Los equipos enviados a mantenimiento aparecerán en esta bandeja." /> : <DataTable headings={["Activo", "Motivo", "Proveedor", "Inicio", "Costo", "Estado", "Acción"]}>{activeRecords.map((record) => <tr key={record.id}><td><span className="table-primary mono-cell">{record.asset.serialNumber}</span><small className="table-secondary">{record.asset.model}</small></td><td>{record.reason || "—"}</td><td>{record.providerName || "—"}</td><td>{record.startDate || "—"}</td><td>{record.cost == null ? "—" : new Intl.NumberFormat("es", { style: "currency", currency: "USD" }).format(record.cost)}</td><td><StatusTag value={record.asset.status} /></td><td><Button variant="secondary" disabled={saving} onClick={() => complete(record)}><CheckCircle2 size={14} /> Certificar retorno</Button></td></tr>)}</DataTable>}
      </section>
      <section className="work-section secondary-section"><div className="section-toolbar"><div className="toolbar-title"><CheckCircle2 size={17} /><strong>Historial de intervenciones</strong><span>{records.length}</span></div></div>{records.length > 0 && <DataTable headings={["Activo", "Motivo", "Inicio", "Cierre", "Estado actual"]}>{records.map((record) => <tr key={record.id}><td className="mono-cell">{record.asset.serialNumber}</td><td>{record.reason || "—"}</td><td>{record.startDate || "—"}</td><td>{record.endDate || "En curso"}</td><td><StatusTag value={record.asset.status} /></td></tr>)}</DataTable>}</section>
      {formOpen && <div className="modal-backdrop" role="presentation"><section className="work-modal" role="dialog" aria-modal="true" aria-labelledby="maintenance-title"><div className="modal-heading"><div><p className="work-eyebrow">CONTROL TÉCNICO</p><h2 id="maintenance-title">Nueva intervención</h2></div><button className="table-action" type="button" aria-label="Cerrar" onClick={() => setFormOpen(false)}>×</button></div><form className="work-form" onSubmit={createRecord}><FormField label="Activo"><select className="work-input" value={assetId} onChange={(event) => setAssetId(event.target.value)} required><option value="">Selecciona un equipo</option>{availableAssets.map((asset) => <option value={asset.id} key={asset.id}>{asset.serialNumber} · {asset.model}</option>)}</select></FormField><FormField label="Motivo de intervención"><TextInput value={reason} onChange={(event) => setReason(event.target.value)} required /></FormField><FormField label="Proveedor técnico"><TextInput value={providerName} onChange={(event) => setProviderName(event.target.value)} /></FormField><FormField label="Costo estimado"><TextInput type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} /></FormField><p className="form-hint">El activo cambia a UNDER_MAINTENANCE al guardar.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Iniciar mantenimiento"}</Button></div></form></section></div>}
    </div>
  );
}