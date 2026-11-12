"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Boxes, ChevronLeft, ChevronRight, Edit3, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useCurrency } from "@/components/currency-provider";
import { Button, DataTable, EmptyState, Feedback, FormField, LoadingRows, PageTitle, SelectInput, StatusTag, TextInput, useEscapeKey, useModalFocus } from "@/components/workspace/ui";
import { ASSETS_QUERY, CREATE_ASSET, UPDATE_ASSET } from "@/lib/operations";
import { errorMessage, queryGraphQL, type AssetItem } from "@/lib/workspace";

type AssetsResult = { assets: AssetItem[] };
type AssetResult = { createAsset: AssetItem; updateAsset: AssetItem };
const pageSize = 8;
const blankAsset = { model: "", estimatedValue: "", purchaseDate: "", status: "AVAILABLE" };

function getLocalTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AssetsPage() {
  const { session } = useAuth();
  const { currency, formatMoney, convertToUsd, convertFromUsd } = useCurrency();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = session?.user.role === "ADMIN";
  const todayIso = getLocalTodayIso();

  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(() => searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<AssetItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankAsset);
  const [assetCurrency, setAssetCurrency] = useState(currency);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);

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
    setAssetCurrency(currency);
    setForm(asset ? {
      model: asset.model ?? "",
      estimatedValue: asset.estimatedValue == null
        ? ""
        : convertFromUsd(asset.estimatedValue, currency).toFixed(2),
      purchaseDate: asset.purchaseDate ?? "",
      status: asset.status,
    } : blankAsset);
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
    if (!form.estimatedValue || Number.isNaN(numericValue) || numericValue <= 0) {
      setFeedback({ error: "El valor estimado debe ser mayor a cero." });
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

    if (editing) {
      setConfirmEditOpen(true);
      return;
    }
    await persistAsset();
  }

  async function persistAsset() {
    setSaving(true);
    setFeedback({});
    const input = {
      model: form.model.trim() || null,
      estimatedValue: form.estimatedValue
        ? convertToUsd(Number(form.estimatedValue), assetCurrency)
        : null,
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
          </div>
        </div>
        {loading ? <LoadingRows label="Cargando activos" /> : visible.length === 0 ? (
          <EmptyState
            title={assets.length === 0 ? "Inventario sin activos" : "No hay resultados"}
            detail={assets.length === 0 ? "No se encontraron equipos tecnológicos disponibles en el inventario." : "Prueba con otro número de serie, modelo o estado."}
          />
        ) : (
          <DataTable headings={["Número de serie", "Modelo", "Valor estimado", "Fecha de compra", "Estado", ...(isAdmin ? ["Acciones"] : [])]}>
            {visible.map((asset) => (
              <tr key={asset.id}>
                <td><span className="table-primary mono-cell">{asset.serialNumber}</span></td>
                <td>{asset.model || "—"}</td>
                <td>{asset.estimatedValue == null ? "—" : formatMoney(asset.estimatedValue)}</td>
                <td>{asset.purchaseDate ?? "—"}</td>
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
        <div className="table-footer">
          <span>Mostrando {filtered.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, filtered.length)} de {filtered.length}</span>
          <div className="pagination">
            <button type="button" className="table-action" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0} aria-label="Página anterior"><ChevronLeft size={16} /></button>
            <span>{page + 1} / {pages}</span>
            <button type="button" className="table-action" onClick={() => setPage((value) => Math.min(pages - 1, value + 1))} disabled={page >= pages - 1} aria-label="Página siguiente"><ChevronRight size={16} /></button>
          </div>
        </div>
      </section>

      {formOpen && (
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
              <FormField label="Número de serie">
                <TextInput value={editing?.serialNumber ?? "Autogenerado por el sistema"} readOnly />
              </FormField>
              <FormField label="Modelo">
                <TextInput value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} required />
              </FormField>
              <div className="form-grid two-col">
                <FormField label="Valor estimado">
                  <div className="money-entry">
                    <TextInput type="number" min="0.01" step="0.01" value={form.estimatedValue} onChange={(event) => setForm({ ...form, estimatedValue: event.target.value })} required />
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
              <Feedback error={feedback.error} />
              <div className="modal-actions">
                <Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button type="submit" loading={saving}>Guardar activo</Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {confirmEditOpen && (
        <div className="modal-backdrop confirmation-backdrop" role="presentation">
          <section ref={confirmDialogRef} tabIndex={-1} className="work-modal" role="alertdialog" aria-modal="true" aria-labelledby="asset-confirm-title" aria-describedby="asset-confirm-description">
            <div className="modal-heading">
              <div>
                <p className="work-eyebrow">INVENTARIO · EDICIÓN</p>
                <h2 id="asset-confirm-title">Confirmar cambios</h2>
              </div>
            </div>
            <p id="asset-confirm-description" className="legal-notice-copy">¿Deseas guardar los cambios realizados en el activo {editing?.serialNumber}?</p>
            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => setConfirmEditOpen(false)}>Volver a editar</Button>
              <Button type="button" loading={saving} onClick={() => { setConfirmEditOpen(false); void persistAsset(); }}>Guardar cambios</Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}