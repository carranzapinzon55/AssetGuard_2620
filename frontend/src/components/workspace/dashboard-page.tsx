"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { Activity, AlertTriangle, CalendarDays, PackageCheck, RotateCcw, Search, TrendingDown, Wrench } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, CopyButton, CurrencyDisplay, Dialog, EmptyState, Feedback, FormField, InsightCard, LoadingRows, PageTitle, SelectInput, StatusTag, TextInput } from "@/components/workspace/ui";
import { LostReportsBanner, LostReportsBell } from "@/components/workspace/lost-reports-dialog";
import { getDisplayUserName } from "@/lib/auth";
import { ASSETS_CATALOG_QUERY, DASHBOARD_QUERY, LOANS_QUERY, LOST_ASSET_REPORTS_QUERY, MAINTENANCE_QUERY } from "@/lib/operations";
import { errorMessage, queryGraphQL, type AssetItem, type LoanItem, type LostAssetReportItem, type MaintenanceItem } from "@/lib/workspace";

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
  const [lostReports, setLostReports] = useState<LostAssetReportItem[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceItem[]>([]);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);

  // Estados interactivos para "Disponibilidad por modelo"
  const [modelSearch, setModelSearch] = useState("");
  const [modelAvailabilityFilter, setModelAvailabilityFilter] = useState<"ALL" | "WITH_AVAILABLE" | "OUT_OF_STOCK" | "WITH_MAINTENANCE">("ALL");
  const [modelSortBy, setModelSortBy] = useState<"MODEL_ASC" | "MODEL_DESC" | "AVAIL_DESC" | "AVAIL_ASC" | "TOTAL_DESC">("MODEL_ASC");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelDetailSearch, setModelDetailSearch] = useState("");
  const [modelDetailStatus, setModelDetailStatus] = useState<"ALL" | "AVAILABLE" | "LOANED" | "UNDER_MAINTENANCE" | "LOST">("ALL");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      queryGraphQL<MetricsResult>(DASHBOARD_QUERY, {
        startDate: appliedRange.startDate || null,
        endDate: appliedRange.endDate || null,
      }),
      queryGraphQL<{ assets: AssetItem[] }>(ASSETS_CATALOG_QUERY, { limit: 50000 }),
      queryGraphQL<{ lostAssetReports: LostAssetReportItem[] }>(LOST_ASSET_REPORTS_QUERY),
      queryGraphQL<{ maintenanceRecords: MaintenanceItem[] }>(MAINTENANCE_QUERY),
      queryGraphQL<{ loans: LoanItem[] }>(LOANS_QUERY),
    ])
      .then(([metricsRes, assetsRes, lostRes, maintRes, loansRes]) => {
        if (active) {
          setMetrics(metricsRes.dashboardMetrics);
          setAssets(assetsRes.assets || []);
          setLostReports(lostRes.lostAssetReports || []);
          setMaintenanceRecords(maintRes.maintenanceRecords || []);
          setLoans(loansRes.loans || []);
          setError("");
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [session?.token, refresh, appliedRange]);

  const punctuality = metrics ? Math.max(0, Math.min(100, metrics.onTimeReturnPercentage)) : 0;

  const modelStatsMap = useMemo(() => {
    const map = new Map<string, { total: number; available: number; loaned: number; maintenance: number; lost: number }>();
    for (const a of assets) {
      const m = a.model?.trim() || "Sin modelo";
      const entry = map.get(m) || { total: 0, available: 0, loaned: 0, maintenance: 0, lost: 0 };
      entry.total++;
      if (a.status === "AVAILABLE") entry.available++;
      else if (a.status === "LOANED" || a.status === "ON_LOAN") entry.loaned++;
      else if (a.status === "UNDER_MAINTENANCE") entry.maintenance++;
      else if (a.status === "LOST") entry.lost++;
      map.set(m, entry);
    }
    return map;
  }, [assets]);

  const filteredAndSortedModels = useMemo(() => {
    if (!metrics?.assetsByModel) return [];

    return metrics.assetsByModel
      .filter((item) => {
        if (modelSearch.trim()) {
          const searchNorm = normalizeText(modelSearch.trim());
          const modelNorm = normalizeText(item.model);
          if (!modelNorm.includes(searchNorm)) return false;
        }

        const stats = modelStatsMap.get(item.model) || {
          total: item.total,
          available: item.available,
          loaned: 0,
          maintenance: 0,
          lost: 0,
        };

        if (modelAvailabilityFilter === "WITH_AVAILABLE") {
          return stats.available > 0;
        }
        if (modelAvailabilityFilter === "OUT_OF_STOCK") {
          return stats.available === 0;
        }
        if (modelAvailabilityFilter === "WITH_MAINTENANCE") {
          return stats.maintenance > 0;
        }
        return true;
      })
      .sort((a, b) => {
        const statsA = modelStatsMap.get(a.model) || { total: a.total, available: a.available };
        const statsB = modelStatsMap.get(b.model) || { total: b.total, available: b.available };
        switch (modelSortBy) {
          case "MODEL_ASC":
            return a.model.localeCompare(b.model);
          case "MODEL_DESC":
            return b.model.localeCompare(a.model);
          case "AVAIL_DESC":
            return statsB.available - statsA.available;
          case "AVAIL_ASC":
            return statsA.available - statsB.available;
          case "TOTAL_DESC":
            return statsB.total - statsA.total;
          default:
            return 0;
        }
      });
  }, [metrics?.assetsByModel, modelSearch, modelAvailabilityFilter, modelSortBy, modelStatsMap]);

  const selectedModelData = useMemo(() => {
    if (!selectedModel) return null;
    const modelItem = metrics?.assetsByModel.find(
      (m) => m.model.trim().toLowerCase() === selectedModel.trim().toLowerCase()
    );
    const modelAssets = assets.filter(
      (a) => a.model?.trim().toLowerCase() === selectedModel.trim().toLowerCase()
    );

    const stats = modelStatsMap.get(selectedModel) || {
      total: modelItem?.total ?? modelAssets.length,
      available: modelAssets.filter((a) => a.status === "AVAILABLE").length || (modelItem?.available ?? 0),
      loaned: modelAssets.filter((a) => a.status === "LOANED" || a.status === "ON_LOAN").length,
      maintenance: modelAssets.filter((a) => a.status === "UNDER_MAINTENANCE").length,
      lost: modelAssets.filter((a) => a.status === "LOST").length,
    };

    return {
      model: selectedModel,
      total: stats.total,
      available: stats.available,
      onLoan: stats.loaned,
      inMaintenance: stats.maintenance,
      lost: stats.lost,
      assets: modelAssets,
    };
  }, [selectedModel, metrics?.assetsByModel, assets, modelStatsMap]);

  const filteredModelAssets = useMemo(() => {
    if (!selectedModelData) return [];
    return selectedModelData.assets.filter((asset) => {
      if (modelDetailSearch.trim()) {
        const searchNorm = normalizeText(modelDetailSearch.trim());
        const serialNorm = normalizeText(asset.serialNumber || "");
        const idNorm = normalizeText(asset.id || "");
        if (!serialNorm.includes(searchNorm) && !idNorm.includes(searchNorm)) {
          return false;
        }
      }
      if (modelDetailStatus !== "ALL") {
        if (modelDetailStatus === "LOANED") {
          if (asset.status !== "LOANED" && asset.status !== "ON_LOAN") return false;
        } else if (asset.status !== modelDetailStatus) {
          return false;
        }
      }
      return true;
    });
  }, [selectedModelData, modelDetailSearch, modelDetailStatus]);

  // Desgloses enriquecidos para tarjetas métricas
  const lostAssetsBreakdown = useMemo(() => {
    const lostList = assets.filter((a) => a.status === "LOST");
    return lostList.map((asset) => {
      const report = lostReports.find(
        (r) => r.asset?.id === asset.id || r.asset?.serialNumber === asset.serialNumber
      );
      return {
        asset,
        report,
        date: report?.reportedAt ? report.reportedAt.split("T")[0] : null,
        notes: report?.notes || "Sin observaciones",
      };
    }).filter((item) => {
      if (!appliedRange.startDate && !appliedRange.endDate) return true;
      if (!item.date) return true;
      if (appliedRange.startDate && item.date < appliedRange.startDate) return false;
      if (appliedRange.endDate && item.date > appliedRange.endDate) return false;
      return true;
    });
  }, [assets, lostReports, appliedRange]);

  const maintenanceBreakdown = useMemo(() => {
    return maintenanceRecords
      .filter((rec) => rec.cost != null && Number(rec.cost) > 0)
      .filter((rec) => {
        const startDate = rec.startDate ? rec.startDate.split("T")[0] : null;
        if (appliedRange.startDate && startDate && startDate < appliedRange.startDate) return false;
        if (appliedRange.endDate && startDate && startDate > appliedRange.endDate) return false;
        return true;
      });
  }, [maintenanceRecords, appliedRange]);

  const inFieldLoansBreakdown = useMemo(() => {
    return loans.filter(
      (l) => l.status === "APPROVED" && (!l.returnDateTime || l.returnDateTime.trim() === "")
    );
  }, [loans]);

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
      summary: "Suma de los costos registrados en órdenes de mantenimiento (excluye intervenciones sin costo).",
      note: "El rango aplicado filtra los costos por la fecha de inicio de la intervención; sin rango, muestra el total histórico registrado con costo facturado.",
    },
    totalLoss: {
      eyebrow: "IMPACTO FINANCIERO · PERIODO",
      title: "Pérdida económica total",
      value: metrics ? <CurrencyDisplay usdAmount={metrics.totalEconomicLoss} /> : "—",
      summary: "Impacto económico consolidado: Mermas por activos perdidos o dados de baja + Costos de mantenimiento.",
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
      {loading ? (
        <LoadingRows label="Calculando métricas" />
      ) : !metrics ? (
        <EmptyState title="No hay métricas disponibles" detail="No se encontraron datos para el periodo seleccionado." />
      ) : (
        <>
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
            <div className="section-toolbar">
              <div className="toolbar-title">
                <PackageCheck size={17} />
                <strong>Inventario actual</strong>
                <span>{metrics.totalAssets}</span>
              </div>
              <span className="toolbar-note">ESTADO DE LA FLOTA · ACTUAL</span>
            </div>
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
                  <div className="model-availability-legend" aria-hidden="true">
                    <span className="legend-item"><i className="legend-dot available" /> Disponibles</span>
                    <span className="legend-item"><i className="legend-dot loaned" /> En préstamo</span>
                    <span className="legend-item"><i className="legend-dot maintenance" /> En mantenimiento</span>
                    <span className="legend-item"><i className="legend-dot lost" /> Perdidos / Mermas</span>
                  </div>
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
                  {filteredAndSortedModels.map((item) => {
                    const stats = modelStatsMap.get(item.model) || {
                      total: item.total,
                      available: item.available,
                      loaned: Math.max(0, item.total - item.available),
                      maintenance: 0,
                      lost: 0,
                    };
                    const t = Math.max(1, stats.total);
                    const availPct = (stats.available / t) * 100;
                    const loanPct = (stats.loaned / t) * 100;
                    const maintPct = (stats.maintenance / t) * 100;
                    const lostPct = (stats.lost / t) * 100;

                    return (
                      <li key={item.model}>
                        <button
                          type="button"
                          className="model-availability-row"
                          onClick={() => {
                            setSelectedModel(item.model);
                            setModelDetailSearch("");
                            setModelDetailStatus("ALL");
                          }}
                          title={`Ver desglose del modelo ${item.model}`}
                        >
                          <span className="model-availability-name">{item.model}</span>
                          <span className="model-availability-track stacked-bar" aria-hidden="true">
                            {availPct > 0 && <span className="bar-seg bar-seg-available" style={{ width: `${availPct}%` }} title={`${stats.available} disponibles`} />}
                            {loanPct > 0 && <span className="bar-seg bar-seg-loaned" style={{ width: `${loanPct}%` }} title={`${stats.loaned} en préstamo`} />}
                            {maintPct > 0 && <span className="bar-seg bar-seg-maintenance" style={{ width: `${maintPct}%` }} title={`${stats.maintenance} en mantenimiento`} />}
                            {lostPct > 0 && <span className="bar-seg bar-seg-lost" style={{ width: `${lostPct}%` }} title={`${stats.lost} perdidos`} />}
                          </span>
                          <span className="model-availability-counts font-mono">
                            <strong>{stats.available}</strong> disp. / {stats.loaned} prést. / {stats.maintenance} mant. / {stats.lost} perd.
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="dashboard-detail-band">
            <div>
              <span className="work-eyebrow">INDICADOR DE ENTREGA</span>
              <h2>Devoluciones puntuales</h2>
              <p>Porcentaje calculado sobre préstamos cerrados en el periodo seleccionado.</p>
            </div>
            <div className="delivery-visual">
              <div className="delivery-value">{punctuality.toFixed(0)}<small>%</small></div>
              <div className="delivery-bars">
                <span style={{ height: `${Math.max(4, punctuality)}%` }} />
                <span style={{ height: `${Math.max(4, 100 - punctuality)}%` }} />
              </div>
              <div className="delivery-legend">
                <span><i className="legend-good" /> A tiempo</span>
                <span><i className="legend-late" /> Fuera de plazo</span>
              </div>
            </div>
          </section>
        </>
      )}

      {metricDetails && (
        <Dialog open title={metricDetails.title} eyebrow={metricDetails.eyebrow} onClose={() => setSelectedMetric(null)}>
          <div className="metric-detail space-y-3">
            <strong className="metric-detail-value telemetry-value">{metricDetails.value}</strong>
            <p>{metricDetails.summary}</p>

            {/* Desglose para MERMAS */}
            {selectedMetric === "loss" && (
              <div>
                <div className="metric-breakdown-section-title">
                  <span>Activos declarados en pérdida o baja definitiva ({lostAssetsBreakdown.length})</span>
                  <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">
                    <CurrencyDisplay usdAmount={metrics?.estimatedLossValue ?? 0} />
                  </span>
                </div>
                {lostAssetsBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center">
                    No se registran activos perdidos o dados de baja en el periodo seleccionado.
                  </p>
                ) : (
                  <div className="metric-breakdown-table-wrap">
                    <table className="metric-breakdown-table">
                      <thead>
                        <tr>
                          <th>Serie</th>
                          <th>Modelo</th>
                          <th>Fecha reporte</th>
                          <th>Observaciones</th>
                          <th className="text-right">Valor estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lostAssetsBreakdown.map(({ asset, date, notes }) => (
                          <tr key={asset.id}>
                            <td>
                              <span className="flex items-center gap-1 font-mono font-semibold">
                                {asset.serialNumber}
                                <CopyButton text={asset.serialNumber} label={`Copiar serie ${asset.serialNumber}`} />
                              </span>
                            </td>
                            <td>{asset.model || "—"}</td>
                            <td className="font-mono text-slate-500 dark:text-slate-400">{date || "—"}</td>
                            <td className="max-w-xs truncate" title={notes}>{notes}</td>
                            <td className="text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                              <CurrencyDisplay usdAmount={asset.estimatedValue ?? 0} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Desglose para MANTENIMIENTO */}
            {selectedMetric === "maintenance" && (
              <div>
                <div className="metric-breakdown-section-title">
                  <span>Intervenciones técnicas facturadas con costo ({maintenanceBreakdown.length})</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                    <CurrencyDisplay usdAmount={metrics?.maintenanceCostsValue ?? 0} />
                  </span>
                </div>
                {maintenanceBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center">
                    No se registran intervenciones de mantenimiento con costo facturado en este periodo.
                  </p>
                ) : (
                  <div className="metric-breakdown-table-wrap">
                    <table className="metric-breakdown-table">
                      <thead>
                        <tr>
                          <th>Serie</th>
                          <th>Modelo</th>
                          <th>Proveedor</th>
                          <th>Fecha</th>
                          <th>Motivo</th>
                          <th className="text-right">Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maintenanceBreakdown.map((rec) => (
                          <tr key={rec.id}>
                            <td>
                              <span className="flex items-center gap-1 font-mono font-semibold">
                                {rec.asset?.serialNumber || "—"}
                                {rec.asset?.serialNumber && (
                                  <CopyButton text={rec.asset.serialNumber} label={`Copiar serie ${rec.asset.serialNumber}`} />
                                )}
                              </span>
                            </td>
                            <td>{rec.asset?.model || "—"}</td>
                            <td>{rec.providerName || "Interno"}</td>
                            <td className="font-mono text-slate-500 dark:text-slate-400">
                              {rec.startDate ? rec.startDate.split("T")[0] : "—"}
                            </td>
                            <td className="max-w-xs truncate" title={rec.reason || ""}>
                              {rec.reason || "Mantenimiento general"}
                            </td>
                            <td className="text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                              <CurrencyDisplay usdAmount={rec.cost ?? 0} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Desglose consolidado para PÉRDIDA ECONÓMICA TOTAL */}
            {selectedMetric === "totalLoss" && metrics && (
              <div className="space-y-3">
                <div className="total-loss-breakdown my-2 space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3 text-xs">
                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                    <span>Mermas (activos perdidos / baja):</span>
                    <span className="font-mono font-semibold"><CurrencyDisplay usdAmount={metrics.estimatedLossValue} /></span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                    <span>Costos de mantenimiento facturados:</span>
                    <span className="font-mono font-semibold"><CurrencyDisplay usdAmount={metrics.maintenanceCostsValue} /></span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-slate-100">
                    <span>Pérdida económica consolidada:</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400 font-bold"><CurrencyDisplay usdAmount={metrics.totalEconomicLoss} /></span>
                  </div>
                </div>

                <div>
                  <div className="metric-breakdown-section-title">
                    <span>1. Activos en merma / pérdida ({lostAssetsBreakdown.length})</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400 font-semibold">
                      <CurrencyDisplay usdAmount={metrics.estimatedLossValue} />
                    </span>
                  </div>
                  {lostAssetsBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-2 text-center">
                      No hay mermas en el periodo.
                    </p>
                  ) : (
                    <div className="metric-breakdown-table-wrap">
                      <table className="metric-breakdown-table">
                        <thead>
                          <tr>
                            <th>Serie</th>
                            <th>Modelo</th>
                            <th>Fecha</th>
                            <th>Observaciones</th>
                            <th className="text-right">Valor estimado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lostAssetsBreakdown.map(({ asset, date, notes }) => (
                            <tr key={asset.id}>
                              <td>
                                <span className="flex items-center gap-1 font-mono font-semibold">
                                  {asset.serialNumber}
                                  <CopyButton text={asset.serialNumber} label={`Copiar serie ${asset.serialNumber}`} />
                                </span>
                              </td>
                              <td>{asset.model || "—"}</td>
                              <td className="font-mono text-slate-500 dark:text-slate-400">{date || "—"}</td>
                              <td className="max-w-xs truncate" title={notes}>{notes}</td>
                              <td className="text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                                <CurrencyDisplay usdAmount={asset.estimatedValue ?? 0} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <div className="metric-breakdown-section-title">
                    <span>2. Intervenciones técnicas con costo ({maintenanceBreakdown.length})</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">
                      <CurrencyDisplay usdAmount={metrics.maintenanceCostsValue} />
                    </span>
                  </div>
                  {maintenanceBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-2 text-center">
                      No hay mantenimientos con costo en el periodo.
                    </p>
                  ) : (
                    <div className="metric-breakdown-table-wrap">
                      <table className="metric-breakdown-table">
                        <thead>
                          <tr>
                            <th>Serie</th>
                            <th>Modelo</th>
                            <th>Proveedor</th>
                            <th>Fecha</th>
                            <th>Motivo</th>
                            <th className="text-right">Costo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {maintenanceBreakdown.map((rec) => (
                            <tr key={rec.id}>
                              <td>
                                <span className="flex items-center gap-1 font-mono font-semibold">
                                  {rec.asset?.serialNumber || "—"}
                                  {rec.asset?.serialNumber && (
                                    <CopyButton text={rec.asset.serialNumber} label={`Copiar serie ${rec.asset.serialNumber}`} />
                                  )}
                                </span>
                              </td>
                              <td>{rec.asset?.model || "—"}</td>
                              <td>{rec.providerName || "Interno"}</td>
                              <td className="font-mono text-slate-500 dark:text-slate-400">
                                {rec.startDate ? rec.startDate.split("T")[0] : "—"}
                              </td>
                              <td className="max-w-xs truncate" title={rec.reason || ""}>
                                {rec.reason || "Mantenimiento general"}
                              </td>
                              <td className="text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                                <CurrencyDisplay usdAmount={rec.cost ?? 0} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Desglose para CUSTODIA · ACTUAL */}
            {selectedMetric === "inField" && (
              <div>
                <div className="metric-breakdown-section-title">
                  <span>Equipos actualmente asignados en custodia ({inFieldLoansBreakdown.length})</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {inFieldLoansBreakdown.length} activos
                  </span>
                </div>
                {inFieldLoansBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center">
                    No hay activos asignados en campo en este momento.
                  </p>
                ) : (
                  <div className="metric-breakdown-table-wrap">
                    <table className="metric-breakdown-table">
                      <thead>
                        <tr>
                          <th>Serie</th>
                          <th>Modelo</th>
                          <th>Técnico asignado</th>
                          <th>Fecha préstamo</th>
                          <th>Vencimiento</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inFieldLoansBreakdown.map((loan) => (
                          <tr key={loan.id}>
                            <td>
                              <span className="flex items-center gap-1 font-mono font-semibold">
                                {loan.asset?.serialNumber || "—"}
                                {loan.asset?.serialNumber && (
                                  <CopyButton text={loan.asset.serialNumber} label={`Copiar serie ${loan.asset.serialNumber}`} />
                                )}
                              </span>
                            </td>
                            <td>{loan.asset?.model || "—"}</td>
                            <td>
                              {loan.user ? (
                                <span title={loan.user.email}>
                                  <strong className="text-slate-800 dark:text-slate-200">{getDisplayUserName(loan.user)}</strong>
                                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-mono">{loan.user.email}</span>
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="font-mono text-slate-500 dark:text-slate-400">
                              {loan.requestDate ? loan.requestDate.split("T")[0] : "—"}
                            </td>
                            <td className="font-mono font-semibold">
                              {loan.dueLocalDate || "—"}
                            </td>
                            <td>
                              <StatusTag value={loan.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {selectedMetric === "onTime" && (
              <div className="metric-progress detail-progress">
                <span style={{ width: `${punctuality}%` }} />
              </div>
            )}

            <div className="metric-detail-note pt-2">
              <span className="work-eyebrow">LECTURA DEL INDICADOR</span>
              <p>{metricDetails.note}</p>
            </div>
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
              <button
                type="button"
                className={`model-breakdown-kpi available clickable ${modelDetailStatus === "AVAILABLE" ? "active-filter" : ""}`}
                onClick={() => setModelDetailStatus((curr) => curr === "AVAILABLE" ? "ALL" : "AVAILABLE")}
                title="Filtrar por disponibles"
              >
                <span className="work-eyebrow !text-emerald-700 dark:!text-emerald-400">DISPONIBLES</span>
                <strong className="telemetry-value font-mono">{selectedModelData.available}</strong>
                <small className="text-[10px] text-emerald-800 dark:text-emerald-300">En bodega para préstamo</small>
              </button>
              <button
                type="button"
                className={`model-breakdown-kpi loaned clickable ${modelDetailStatus === "LOANED" ? "active-filter" : ""}`}
                onClick={() => setModelDetailStatus((curr) => curr === "LOANED" ? "ALL" : "LOANED")}
                title="Filtrar por en préstamo"
              >
                <span className="work-eyebrow !text-blue-700 dark:!text-blue-400">EN PRÉSTAMO</span>
                <strong className="telemetry-value font-mono">{selectedModelData.onLoan}</strong>
                <small className="text-[10px] text-blue-800 dark:text-blue-300">Asignados a técnicos</small>
              </button>
              <button
                type="button"
                className={`model-breakdown-kpi maintenance clickable ${modelDetailStatus === "UNDER_MAINTENANCE" ? "active-filter" : ""}`}
                onClick={() => setModelDetailStatus((curr) => curr === "UNDER_MAINTENANCE" ? "ALL" : "UNDER_MAINTENANCE")}
                title="Filtrar por en mantenimiento"
              >
                <span className="work-eyebrow !text-amber-700 dark:!text-amber-400">EN MANTENIMIENTO</span>
                <strong className="telemetry-value font-mono">{selectedModelData.inMaintenance}</strong>
                <small className="text-[10px] text-amber-800 dark:text-amber-300">En orden técnica activa</small>
              </button>
              <button
                type="button"
                className={`model-breakdown-kpi lost clickable ${modelDetailStatus === "LOST" ? "active-filter" : ""}`}
                onClick={() => setModelDetailStatus((curr) => curr === "LOST" ? "ALL" : "LOST")}
                title="Filtrar por perdidas / mermas"
              >
                <span className="work-eyebrow !text-rose-700 dark:!text-rose-400">PERDIDAS / MERMAS</span>
                <strong className="telemetry-value font-mono">{selectedModelData.lost}</strong>
                <small className="text-[10px] text-rose-800 dark:text-rose-300">No localizados / Merma</small>
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <label className="search-control flex-1">
                  <Search size={14} />
                  <input
                    value={modelDetailSearch}
                    onChange={(e) => setModelDetailSearch(e.target.value)}
                    placeholder="Buscar por serie o ID..."
                    aria-label="Buscar unidad por serie o ID"
                  />
                </label>
                <SelectInput
                  className="filter-select w-44 text-xs"
                  value={modelDetailStatus}
                  onChange={(e) => setModelDetailStatus(e.target.value as typeof modelDetailStatus)}
                  aria-label="Filtrar unidades por estado"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="AVAILABLE">Disponible</option>
                  <option value="LOANED">En préstamo</option>
                  <option value="UNDER_MAINTENANCE">En mantenimiento</option>
                  <option value="LOST">Perdido</option>
                </SelectInput>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {filteredModelAssets.length} de {selectedModelData.assets.length} unidades
              </span>
            </div>

            {filteredModelAssets.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                No hay unidades que coincidan con la búsqueda o filtro aplicado.
              </p>
            ) : (
              <div className="model-breakdown-serials">
                {filteredModelAssets.map((asset) => (
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
