"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Boxes, ChevronLeft, ChevronRight, Edit3, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, DataTable, EmptyState, Feedback, FormField, LoadingRows, PageTitle, SelectInput, StatusTag, TextInput } from "@/components/workspace/ui";
import { ASSETS_QUERY, CREATE_ASSET, UPDATE_ASSET } from "@/lib/operations";
import { errorMessage, queryGraphQL, type AssetItem } from "@/lib/workspace";

type AssetsResult = { assets: AssetItem[] };
type AssetResult = { createAsset: AssetItem; updateAsset: AssetItem };
const pageSize = 8;
const blankAsset = { serialNumber: "", model: "", estimatedValue: "", purchaseDate: "", status: "AVAILABLE" };

export function AssetsPage() {
  const { session } = useAuth();
  const isAdmin = session?.user.role === "ADMIN";
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<AssetItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankAsset);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    queryGraphQL<AssetsResult>(ASSETS_QUERY)
      .then((result) => { if (active) setAssets(result.assets); })
      .catch((error: unknown) => { if (active) setFeedback({ error: errorMessage(error) }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token, refresh]);

  const filtered = useMemo(() => assets.filter((asset) => {
    const matchesText = `${asset.serialNumber} ${asset.model ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === "ALL" || asset.status === statusFilter;
    return matchesText && matchesStatus;
  }), [assets, query, statusFilter]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  function openForm(asset?: AssetItem) {
    setEditing(asset ?? null);
    setForm(asset ? {
      serialNumber: asset.serialNumber,
      model: asset.model ?? "",
      estimatedValue: asset.estimatedValue?.toString() ?? "",
      purchaseDate: asset.purchaseDate ?? "",
      status: asset.status,
    } : blankAsset);
    setFeedback({});
    setFormOpen(true);
  }

  async function saveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback({});
    const input = {
      serialNumber: form.serialNumber.trim(),
      model: form.model.trim() || null,
      estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null,
      purchaseDate: form.purchaseDate || null,
      status: form.status,
    };
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
      <PageTitle eyebrow={isAdmin ? "INVENTARIO · ADMINISTRACIÓN" : "INVENTARIO · CATÁLOGO"} title="Activos" description={isAdmin ? "Registra, actualiza y localiza equipos del inventario." : "Busca equipos disponibles y revisa su estado de custodia."} action={isAdmin ? <Button onClick={() => openForm()}><Plus size={16} /> Registrar activo</Button> : undefined} />
      <Feedback {...feedback} />
      <section className="work-section">
        <div className="section-toolbar">
          <div className="toolbar-title"><Boxes size={17} /><strong>{isAdmin ? "Inventario" : "Catálogo de equipos"}</strong><span>{filtered.length}</span></div>
          <div className="toolbar-controls">
            <label className="search-control"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Serial o modelo" aria-label="Buscar serial o modelo" /></label>
            <SelectInput className="filter-select" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }} aria-label="Filtrar por estado"><option value="ALL">Todos los estados</option><option value="AVAILABLE">Disponible</option><option value="LOANED">En préstamo</option><option value="UNDER_MAINTENANCE">Mantenimiento</option><option value="LOST">Perdido</option></SelectInput>
          </div>
        </div>
        {loading ? <LoadingRows label="Cargando activos" /> : visible.length === 0 ? <EmptyState title="No hay resultados" detail="Prueba otro serial, modelo o estado." /> : <DataTable headings={["Serial", "Modelo", "Valor estimado", "Compra", "Estado", ...(isAdmin ? ["Acciones"] : [])]}>
          {visible.map((asset) => <tr key={asset.id}><td><span className="table-primary mono-cell">{asset.serialNumber}</span></td><td>{asset.model || "—"}</td><td>{asset.estimatedValue == null ? "—" : new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(asset.estimatedValue)}</td><td>{asset.purchaseDate ?? "—"}</td><td><StatusTag value={asset.status} /></td>{isAdmin && <td><button className="table-action" type="button" onClick={() => openForm(asset)} aria-label={`Editar ${asset.serialNumber}`} title="Editar activo"><Edit3 size={15} /></button></td>}</tr>)}
        </DataTable>}
        <div className="table-footer"><span>Mostrando {filtered.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, filtered.length)} de {filtered.length}</span><div className="pagination"><button type="button" className="table-action" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0} aria-label="Página anterior"><ChevronLeft size={16} /></button><span>{page + 1} / {pages}</span><button type="button" className="table-action" onClick={() => setPage((value) => Math.min(pages - 1, value + 1))} disabled={page >= pages - 1} aria-label="Página siguiente"><ChevronRight size={16} /></button></div></div>
      </section>
      {formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}><section className="work-modal" role="dialog" aria-modal="true" aria-labelledby="asset-form-title"><div className="modal-heading"><div><p className="work-eyebrow">INVENTARIO</p><h2 id="asset-form-title">{editing ? "Editar activo" : "Registrar activo"}</h2></div><button type="button" className="table-action" aria-label="Cerrar" onClick={() => setFormOpen(false)}><X size={17} /></button></div>
        <form className="work-form" onSubmit={saveAsset}><FormField label="Número de serie"><TextInput value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} required /></FormField><FormField label="Modelo"><TextInput value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} required /></FormField><div className="form-grid two-col"><FormField label="Valor estimado"><TextInput type="number" min="0.01" step="0.01" value={form.estimatedValue} onChange={(event) => setForm({ ...form, estimatedValue: event.target.value })} required /></FormField><FormField label="Fecha de compra"><TextInput type="date" value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} required /></FormField></div><FormField label="Estado"><SelectInput value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="AVAILABLE">AVAILABLE</option><option value="LOANED">LOANED</option><option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option><option value="LOST">LOST</option></SelectInput></FormField><Feedback error={feedback.error} /><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar activo"}</Button></div></form>
      </section></div>}
    </div>
  );
}