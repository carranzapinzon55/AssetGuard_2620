"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { Activity, AlertTriangle, CalendarDays, PackageCheck, RotateCcw, Search, TrendingDown, Wrench } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, CopyButton, CurrencyDisplay, Dialog, EmptyState, Feedback, FormField, InsightCard, LoadingRows, PageTitle, SelectInput, StatusTag, TextInput } from "@/components/workspace/ui";
import { LostReportsBanner, LostReportsBell } from "@/components/workspace/lost-reports-dialog";
import { ASSETS_CATALOG_QUERY, DASHBOARD_QUERY } from "@/lib/operations";
import { errorMessage, queryGraphQL, type AssetItem } from "@/lib/workspace";

type Metrics = {
  estimatedLossValue: number;
  maintenanceCostsValue: number;
  totalEconomicLoss: number;
  onTimeReturnPercentage: number;
  assetsCurrentlyInField: number;
  totalAssets: number;
  availableAssets: number;
  assetsUnderMaintenance: number;
  lostAssets: number;
  assetsByModel: Array<{ model: string; total: number; available: number }>;
};
type MetricsResult = { dashboardMetrics: Metrics };
type MetricKey = "loss" | "maintenance" | "totalLoss" | "onTime" | "inField";

function getLocalTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function DashboardPage() {
  const { session } = useAuth();
  const todayIso = getLocalTodayIso();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedRange, setAppliedRange] = useState({ startDate: "", endDate: "" });
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);

  // Estados interactivos para "Disponibilidad por modelo"
  const [modelSearch, setModelSearch] = useState("");
  const [modelAvailabilityFilter, setModelAvailabilityFilter] = useState<"ALL" | "WITH_AVAILABLE" | "OUT_OF_STOCK" | "WITH_MAINTENANCE">("ALL");
  const [modelSortBy, setModelSortBy] = useState<"MODEL_ASC" | "MODEL_DESC" | "AVAIL_DESC" | "AVAIL_ASC" | "TOTAL_DESC">("MODEL_ASC");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      queryGraphQL<MetricsResult>(DASHBOARD_QUERY, {
        startDate: appliedRange.startDate || null,
        endDate: appliedRange.endDate || null,
      }),
      queryGraphQL<{ assets: AssetItem[] }>(ASSETS_CATALOG_QUERY, { limit: 5000 }),
    ])
      .then(([metricsRes, assetsRes]) => {
        if (active) {
          setMetrics(metricsRes.dashboardMetrics);
          setAssets(assetsRes.assets || []);
          setError("");
        }
      })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token, refresh, appliedRange]);

  const punctuality = metrics ? Math.max(0, Math.min(100, metrics.onTimeReturnPercentage)) : 0;
  const metricDetails = selectedMetric ? {
    loss: {
      eyebrow: "MERMAS · PERIODO",
      title: "Mermas por activos perdidos o dados de baja",
      value: metrics ? <CurrencyDisplay usdAmount={metrics.estimatedLossValue} /> : "—",
      summary: "Valor estimado de activos perdidos o dados de baja en el periodo.",
      note: "El rango aplicado filtra los reportes de pérdida y préstamos no recuperados por su fecha; no incluye equipos en mantenimiento técnico.",
    },
    maintenance: {
      eyebrow: "MANTENIMIENTO · PERIODO",
      title: "Gastos de mantenimiento",
      value: metrics ? <CurrencyDisplay usdAmount={metrics.maintenanceCostsValue} /> : "—",
      summary: "Suma de los costos registrados en órdenes de mantenimiento.",
      note: "El rango aplicado filtra los costos por la fecha de inicio de la intervención; sin rango, muestra el total histórico registrado.",
    },
    totalLoss: {
      eyebrow: "IMPACTO FINANCIERO · PERIODO",
      title: "Pérdida económica total",
      value: metrics ? <CurrencyDisplay usdAmount={metrics.totalEconomicLoss} /> : "—",
      summary: "Impacto económico consolidado: Mermas por activos perdidos o dados de baja + Costos de mantenimiento.",
      breakdown: metrics ? (
        <div className="total-loss-breakdown my-3 space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3 text-xs">
          <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
            <span>Mermas (activos perdidos / baja):</span>
            <span className="font-mono font-semibold"><CurrencyDisplay usdAmount={metrics.estimatedLossValue} /></span>
          </div>
          <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
            <span>Costos de mantenimiento:</span>
            <span className="font-mono font-semibold"><CurrencyDisplay usdAmount={metrics.maintenanceCostsValue} /></span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-slate-100">
            <span>Pérdida económica consolidada:</span>
            <span className="font-mono text-rose-600 dark:text-rose-400 font-bold"><CurrencyDisplay usdAmount={metrics.totalEconomicLoss} /></span>
          </div>
        </div>
      ) : null,
      note: "Consolidación financiera que suma el costo total de los activos declarados como merma o baja definitiva más las facturas de intervención y reparación técnica en el periodo seleccionado.",
    },
    onTime: {
      eyebrow: "PUNTUALIDAD · PERIODO",
      title: "Devoluciones puntuales",
      value: `${punctuality.toFixed(1)}%`,
      summary: "Porcentaje de préstamos cerrados que se devolvieron en o antes de su vencimiento.",
      note: `${(100 - punctuality).toFixed(1)}% de las devoluciones del periodo quedó fuera de plazo.`,
    },
    inField: {
      eyebrow: "CUSTODIA · ACTUAL",
      title: "Activos actualmente en campo",
      value: String(metrics?.assetsCurrentlyInField ?? 0),
      summary: "Cantidad de equipos que permanecen asignados en préstamo en este momento.",
      note: "Es una lectura del estado actual de la flota y no cambia al filtrar el periodo.",
    },
  }[selectedMetric] : null;

  const filteredAndSortedModels = useMemo(() => {
    if (!metrics?.assetsByModel) return [];

    return metrics.assetsByModel
      .filter((item) => {
        if (modelSearch.trim()) {
          const searchNorm = normalizeText(modelSearch.trim());
          const modelNorm = normalizeText(item.model);
          if (!modelNorm.includes(searchNorm)) return false;
        }

        if (modelAvailabilityFilter === "WITH_AVAILABLE") {
          return item.available > 0;
        }
        if (modelAvailabilityFilter === "OUT_OF_STOCK") {
          return item.available === 0;
        }
        if (modelAvailabilityFilter === "WITH_MAINTENANCE") {
          const itemAssets = assets.filter(
            (a) => a.model?.trim().toLowerCase() === item.model.trim().toLowerCase()
          );
          return itemAssets.some((a) => a.status === "UNDER_MAINTENANCE");
        }
        return true;
      })
      .sort((a, b) => {
        switch (modelSortBy) {
          case "MODEL_ASC":
            return a.model.localeCompare(b.model);
          case "MODEL_DESC":
            return b.model.localeCompare(a.model);
          case "AVAIL_DESC":
            return b.available - a.available;
          case "AVAIL_ASC":
            return a.available - b.available;
          case "TOTAL_DESC":
            return b.total - a.total;
          default:
            return 0;
        }
      });
  }, [metrics?.assetsByModel, modelSearch, modelAvailabilityFilter, modelSortBy, assets]);

  const selectedModelData = useMemo(() => {
    if (!selectedModel) return null;
    const modelItem = metrics?.assetsByModel.find(
      (m) => m.model.trim().toLowerCase() === selectedModel.trim().toLowerCase()
    );
    const modelAssets = assets.filter(
      (a) => a.model?.trim().toLowerCase() === selectedModel.trim().toLowerCase()
    );

    const total = modelItem?.total ?? modelAssets.length;
    const available = modelAssets.filter((a) => a.status === "AVAILABLE").length || (modelItem?.available ?? 0);
    const onLoan = modelAssets.filter((a) => a.status === "LOANED" || a.status === "ON_LOAN").length;
    const inMaintenance = modelAssets.filter((a) => a.status === "UNDER_MAINTENANCE").length;
    const lost = modelAssets.filter((a) => a.status === "LOST").length;

    return {
      model: selectedModel,
      total,
      available,
      onLoan,
      inMaintenance,
      lost,
      assets: modelAssets,
    };
  }, [selectedModel, metrics?.assetsByModel, assets]);

  function updateMetricSpotlight(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mouse-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--mouse-y", `${event.clientY - bounds.top}px`);
  }

  return (
    <div className="work-page">
      <PageTitle
        eyebrow="GLOBALNET · RESUMEN EJECUTIVO"
        title="Panel de control de activos"
        description="Salud financiera y operativa de la flota de activos."
        action={<LostReportsBell />}
      />
      <Feedback error={error} />
      <LostReportsBanner />
      <section className="work-section dashboard-filters">
        <div className="filter-heading">
          <CalendarDays size={16} />
          <strong>Periodo de devoluciones</strong>
          <span>Las existencias en campo muestran el estado actual.</span>
        </div>
        <div className="date-filter-controls">
          <FormField label="Desde">
            <TextInput
              type="date"
              max={endDate || todayIso}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </FormField>
          <FormField label="Hasta">
            <TextInput
              type="date"
              min={startDate || undefined}
              max={todayIso}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </FormField>
          <Button
            onClick={() => {
              if (startDate && startDate > todayIso) {
                setError("La fecha de inicio no puede ser posterior a hoy.");
                return;
              }
              if (endDate && endDate > todayIso) {
                setError("La fecha de fin no puede ser posterior a hoy.");
                return;
              }
              if (startDate && endDate && startDate > endDate) {
                setError("La fecha de inicio debe ser anterior o igual a la fecha final.");
                return;
              }
              setError("");
              setAppliedRange({ startDate, endDate });
            }}
          >
            <Activity size={15} /> Aplicar periodo
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setError("");
              setAppliedRange({ startDate: "", endDate: "" });
              setRefresh((value) => value + 1);
            }}
          >
            <RotateCcw size={15} /> Limpiar
          </Button>
        </div>
      </section>
      {loading ? <LoadingRows label="Calculando métricas" /> : !metrics ? <EmptyState title="No hay métricas disponibles" detail="No se encontraron datos para el periodo seleccionado." /> : <>
        <section className="metric-grid">
          <button
            type="button"
            className="metric-panel loss"
            aria-label="Ver detalle de mermas por activos perdidos o dados de baja"
            aria-haspopup="dialog"
            onClick={() => setSelectedMetric("loss")}
            onPointerMove={updateMetricSpotlight}
          >
            <div className="metric-panel-top">
              <span className="metric-icon"><AlertTriangle size={17} /></span>
              <span className="work-eyebrow">MERMAS · PERIODO</span>
            </div>
            <strong className="metric-value telemetry-value">
              <CurrencyDisplay usdAmount={metrics.estimatedLossValue} />
            </strong>
            <p>Valor estimado de activos perdidos o dados de baja.</p>
            <div className="metric-signal" aria-hidden="true">
              <i /><i /><i /><i /><i /><i /><i /><i />
            </div>
            <div className="metric-foot">
              <span>ACTIVOS PERDIDOS / BAJA</span>
              <span>VER DESGLOSE <span aria-hidden="true">↗</span></span>
            </div>
          </button>
          <button
            type="button"
            className="metric-panel maintenance-cost"
            aria-label="Ver detalle de gastos de mantenimiento"
            aria-haspopup="dialog"
            onClick={() => setSelectedMetric("maintenance")}
            onPointerMove={updateMetricSpotlight}
          >
            <div className="metric-panel-top">
              <span className="metric-icon"><Wrench size={17} /></span>
              <span className="work-eyebrow">MANTENIMIENTO · PERIODO</span>
            </div>
            <strong className="metric-value telemetry-value">
              <CurrencyDisplay usdAmount={metrics.maintenanceCostsValue} />
            </strong>
            <p>Costos registrados en órdenes de mantenimiento.</p>
            <div className="metric-signal field-signal" aria-hidden="true">
              <i /><i /><i /><i /><i /><i /><i /><i />
            </div>
            <div className="metric-foot">
              <span>COSTOS DE INTERVENCIÓN</span>
              <span>VER DESGLOSE <span aria-hidden="true">↗</span></span>
            </div>
          </button>
          <button
            type="button"
            className="metric-panel total-loss"
            aria-label="Ver detalle de pérdida económica total"
            aria-haspopup="dialog"
            onClick={() => setSelectedMetric("totalLoss")}
            onPointerMove={updateMetricSpotlight}
          >
            <div className="metric-panel-top">
              <span className="metric-icon"><TrendingDown size={17} /></span>
              <span className="work-eyebrow">PÉRDIDA ECONÓMICA TOTAL</span>
            </div>
            <strong className="metric-value telemetry-value">
              <CurrencyDisplay usdAmount={metrics.totalEconomicLoss} />
            </strong>
            <p>Mermas por pérdidas + Costos de mantenimiento.</p>
            <div className="metric-signal total-loss-signal" aria-hidden="true">
              <i /><i /><i /><i /><i /><i /><i /><i />
            </div>
            <div className="metric-foot">
              <span>CONSOLIDADO FINANCIERO</span>
              <span>VER DESGLOSE <span aria-hidden="true">↗</span></span>
            </div>
          </button>
          <button
            type="button"
            className="metric-panel"
            aria-label="Ver detalle de devoluciones puntuales"
            aria-haspopup="dialog"
            onClick={() => setSelectedMetric("onTime")}
            onPointerMove={updateMetricSpotlight}
          >
            <div className="metric-panel-top">
              <span className="metric-icon"><RotateCcw size={17} /></span>
              <span className="work-eyebrow">PUNTUALIDAD · PERIODO</span>
            </div>
            <strong className="metric-value telemetry-value">{punctuality.toFixed(1)}<small>%</small></strong>
            <p>Préstamos devueltos en o antes de su vencimiento.</p>
            <div className="metric-progress"><span style={{ width: `${punctuality}%` }} /></div>
            <div className="metric-foot">
              <span>DEVOLUCIONES A TIEMPO</span>
              <strong className="telemetry-value">{punctuality.toFixed(0)}%</strong>
            </div>
          </button>
          <button
            type="button"
            className="metric-panel field"
            aria-label="Ver detalle de activos actualmente en campo"
            aria-haspopup="dialog"
            onClick={() => setSelectedMetric("inField")}
            onPointerMove={updateMetricSpotlight}
          >
            <div className="metric-panel-top">
              <span className="metric-icon"><PackageCheck size={17} /></span>
              <span className="work-eyebrow">CUSTODIA · ACTUAL</span>
            </div>
            <strong className="metric-value telemetry-value">{metrics.assetsCurrentlyInField}</strong>
            <p>Activos actualmente asignados en préstamo.</p>
            <div className="metric-signal field-signal" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
            <div className="metric-foot"><span>ESTADO ACTUAL DE LA FLOTA</span><span>VER DETALLE <span aria-hidden="true">↗</span></span></div>
          </button>
        </section>
        <section className="dashboard-inventory" aria-label="Indicadores del inventario actual">
          <div className="section-toolbar"><div className="toolbar-title"><PackageCheck size={17} /><strong>Inventario actual</strong><span>{metrics.totalAssets}</span></div><span className="toolbar-note">ESTADO DE LA FLOTA · ACTUAL</span></div>
          <div className="insight-grid inventory-kpi-grid">
            <InsightCard label="TOTAL DE EQUIPOS" value={metrics.totalAssets} description="Activos registrados en el inventario." progress={100} detail={`${metrics.totalAssets} equipos registrados en total.`} />
            <InsightCard label="DISPONIBLES" value={metrics.availableAssets} description="Listos para asignación." progress={metrics.totalAssets ? (metrics.availableAssets / metrics.totalAssets) * 100 : 0} detail={`${metrics.availableAssets} de ${metrics.totalAssets} equipos están disponibles.`} />
            <InsightCard label="EN MANTENIMIENTO" value={metrics.assetsUnderMaintenance} description="Equipos con una intervención abierta." progress={metrics.totalAssets ? (metrics.assetsUnderMaintenance / metrics.totalAssets) * 100 : 0} detail={`${metrics.assetsUnderMaintenance} equipos están actualmente en mantenimiento.`} />
            <InsightCard label="PERDIDOS" value={metrics.lostAssets} description="Equipos reportados como perdidos." progress={metrics.totalAssets ? (metrics.lostAssets / metrics.totalAssets) * 100 : 0} detail={`${metrics.lostAssets} equipos figuran con estado perdido.`} />
          </div>
          <div className="model-availability">
            <div className="model-availability-header">
              <div className="model-availability-intro">
                <span className="work-eyebrow">DISPONIBILIDAD POR MODELO</span>
                <p>Equipos disponibles frente al total registrado por modelo. Haz clic en una fila para ver el desglose completo.</p>
              </div>
              <div className="model-availability-controls">
                <label className="search-control">
                  <Search size={14} />
                  <input
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder="Buscar modelo..."
                    aria-label="Buscar por nombre de modelo"
                  />
                </label>
                <SelectInput
                  className="filter-select"
                  value={modelAvailabilityFilter}
                  onChange={(e) => setModelAvailabilityFilter(e.target.value as typeof modelAvailabilityFilter)}
                  aria-label="Filtrar por disponibilidad de modelo"
                >
                  <option value="ALL">Todos los modelos</option>
                  <option value="WITH_AVAILABLE">Con disponibles</option>
                  <option value="OUT_OF_STOCK">Sin disponibles / Agotados</option>
                  <option value="WITH_MAINTENANCE">Con equipos en mantenimiento</option>
                </SelectInput>
                <SelectInput
                  className="filter-select"
                  value={modelSortBy}
                  onChange={(e) => setModelSortBy(e.target.value as typeof modelSortBy)}
                  aria-label="Ordenar modelos por"
                >
                  <option value="MODEL_ASC">Modelo (A–Z)</option>
                  <option value="MODEL_DESC">Modelo (Z–A)</option>
                  <option value="AVAIL_DESC">Mayor disponibilidad</option>
                  <option value="AVAIL_ASC">Menor disponibilidad</option>
                  <option value="TOTAL_DESC">Mayor cantidad total</option>
                </SelectInput>
              </div>
            </div>

            {filteredAndSortedModels.length === 0 ? (
              <span className="model-availability-empty">
                {metrics.assetsByModel.length === 0
                  ? "No hay modelos registrados."
                  : "No se encontraron modelos con los filtros aplicados."}
              </span>
            ) : (
              <ul>
                {filteredAndSortedModels.map((item) => (
                  <li key={item.model}>
                    <button
                      type="button"
                      className="model-availability-row"
                      onClick={() => setSelectedModel(item.model)}
                      title={`Ver desglose del modelo ${item.model}`}
                    >
                      <span className="model-availability-name">{item.model}</span>
                      <span className="model-availability-track" aria-hidden="true">
                        <i style={{ width: `${item.total ? (item.available / item.total) * 100 : 0}%` }} />
                      </span>
                      <span className="model-availability-count telemetry-value font-mono">
                        {item.available}/{item.total} disp.
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="dashboard-detail-band"><div><span className="work-eyebrow">INDICADOR DE ENTREGA</span><h2>Devoluciones puntuales</h2><p>Porcentaje calculado sobre préstamos cerrados en el periodo seleccionado.</p></div><div className="delivery-visual"><div className="delivery-value">{punctuality.toFixed(0)}<small>%</small></div><div className="delivery-bars"><span style={{ height: `${Math.max(4, punctuality)}%` }} /><span style={{ height: `${Math.max(4, 100 - punctuality)}%` }} /></div><div className="delivery-legend"><span><i className="legend-good" /> A tiempo</span><span><i className="legend-late" /> Fuera de plazo</span></div></div></section>
      </>}
      {metricDetails && (
        <Dialog open title={metricDetails.title} eyebrow={metricDetails.eyebrow} onClose={() => setSelectedMetric(null)}>
          <div className="metric-detail">
            <strong className="metric-detail-value telemetry-value">{metricDetails.value}</strong>
            <p>{metricDetails.summary}</p>
            {"breakdown" in metricDetails && metricDetails.breakdown}
            {selectedMetric === "onTime" && <div className="metric-progress detail-progress"><span style={{ width: `${punctuality}%` }} /></div>}
            <div className="metric-detail-note"><span className="work-eyebrow">LECTURA DEL INDICADOR</span><p>{metricDetails.note}</p></div>
          </div>
        </Dialog>
      )}
      {selectedModelData && (
        <Dialog
          open
          title={selectedModelData.model}
          eyebrow="DESGLOSE DE FLOTA · MODELO"
          onClose={() => setSelectedModel(null)}
        >
          <div className="space-y-4 pt-1">
            <div className="model-breakdown-grid">
              <div className="model-breakdown-kpi available">
                <span className="work-eyebrow !text-emerald-700 dark:!text-emerald-400">DISPONIBLES</span>
                <strong className="telemetry-value font-mono">{selectedModelData.available}</strong>
                <small className="text-[10px] text-emerald-800 dark:text-emerald-300">En bodega para préstamo</small>
              </div>
              <div className="model-breakdown-kpi loaned">
                <span className="work-eyebrow !text-blue-700 dark:!text-blue-400">EN PRÉSTAMO</span>
                <strong className="telemetry-value font-mono">{selectedModelData.onLoan}</strong>
                <small className="text-[10px] text-blue-800 dark:text-blue-300">Asignados a técnicos</small>
              </div>
              <div className="model-breakdown-kpi maintenance">
                <span className="work-eyebrow !text-amber-700 dark:!text-amber-400">EN MANTENIMIENTO</span>
                <strong className="telemetry-value font-mono">{selectedModelData.inMaintenance}</strong>
                <small className="text-[10px] text-amber-800 dark:text-amber-300">En orden técnica activa</small>
              </div>
              <div className="model-breakdown-kpi lost">
                <span className="work-eyebrow !text-rose-700 dark:!text-rose-400">PERDIDAS / MERMAS</span>
                <strong className="telemetry-value font-mono">{selectedModelData.lost}</strong>
                <small className="text-[10px] text-rose-800 dark:text-rose-300">No localizados / Merma</small>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Unidades registradas ({selectedModelData.total} en total)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {selectedModelData.assets.length} números de serie listados
              </span>
            </div>

            {selectedModelData.assets.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                No hay activos individuales vinculados a este modelo en el inventario.
              </p>
            ) : (
              <div className="model-breakdown-serials">
                {selectedModelData.assets.map((asset) => (
                  <div key={asset.id} className="model-breakdown-row">
                    <span className="copy-value flex items-center gap-2">
                      <span className="font-mono font-semibold telemetry-value">{asset.serialNumber}</span>
                      <CopyButton text={asset.serialNumber} label={`Copiar serie ${asset.serialNumber}`} />
                    </span>
                    <StatusTag value={asset.status} />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setSelectedModel(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}