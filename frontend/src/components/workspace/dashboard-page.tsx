"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Layers,
  PackageCheck,
  RotateCcw,
  Search,
  TrendingDown,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  Button,
  CopyButton,
  CurrencyDisplay,
  Dialog,
  DonutChart,
  EmptyState,
  Feedback,
  FormField,
  HorizontalBarChart,
  InsightCard,
  LoadingRows,
  ModalKpiGrid,
  PageTitle,
  SelectInput,
  StatusTag,
  TextInput,
  type BarChartItem,
  type DonutSegment,
} from "@/components/workspace/ui";
import { LostReportsBanner, LostReportsBell } from "@/components/workspace/lost-reports-dialog";
import { getDisplayUserName } from "@/lib/auth";
import {
  ASSETS_CATALOG_QUERY,
  DASHBOARD_QUERY,
  LOANS_QUERY,
  LOST_ASSET_REPORTS_QUERY,
  MAINTENANCE_QUERY,
} from "@/lib/operations";
import {
  errorMessage,
  queryGraphQL,
  type AssetItem,
  type LoanItem,
  type LostAssetReportItem,
  type MaintenanceItem,
} from "@/lib/workspace";

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
type MetricKey =
  | "loss"
  | "maintenance"
  | "totalLoss"
  | "onTime"
  | "inField"
  | "invTotal"
  | "invAvailable"
  | "invMaintenance"
  | "invLost";

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

/* ========================================================================
   Componente Principal DashboardPage
   ======================================================================== */

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

  // Modal analítico abierto
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalFilter, setModalFilter] = useState("ALL");

  // Estados interactivos para "Disponibilidad por modelo"
  const [modelSearch, setModelSearch] = useState("");
  const [modelAvailabilityFilter, setModelAvailabilityFilter] = useState<
    "ALL" | "WITH_AVAILABLE" | "OUT_OF_STOCK" | "WITH_MAINTENANCE"
  >("ALL");
  const [modelSortBy, setModelSortBy] = useState<
    "MODEL_ASC" | "MODEL_DESC" | "AVAIL_DESC" | "AVAIL_ASC" | "TOTAL_DESC"
  >("MODEL_ASC");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelDetailSearch, setModelDetailSearch] = useState("");
  const [modelDetailStatus, setModelDetailStatus] = useState<
    "ALL" | "AVAILABLE" | "LOANED" | "UNDER_MAINTENANCE" | "LOST"
  >("ALL");

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
    return () => {
      active = false;
    };
  }, [session?.token, refresh, appliedRange]);

  function openMetricModal(key: MetricKey) {
    setSelectedMetric(key);
    setModalSearch("");
    setModalFilter("ALL");
  }

  const punctuality = metrics ? Math.max(0, Math.min(100, metrics.onTimeReturnPercentage)) : 0;

  const totalInventoryValue = useMemo(() => {
    return assets.reduce((sum, a) => sum + (a.estimatedValue ?? 0), 0);
  }, [assets]);

  const modelStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { total: number; available: number; loaned: number; maintenance: number; lost: number }
    >();
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

  /* ========================================================================
     Desgloses analíticos para cada modal métrico
     ======================================================================== */

  // 1. MERMAS
  const lostAssetsBreakdown = useMemo(() => {
    const lostList = assets.filter((a) => a.status === "LOST");
    return lostList
      .map((asset) => {
        const report = lostReports.find(
          (r) => r.asset?.id === asset.id || r.asset?.serialNumber === asset.serialNumber
        );
        return {
          asset,
          report,
          date: report?.reportedAt ? report.reportedAt.split("T")[0] : asset.purchaseDate || null,
          notes: report?.notes || "Equipo reportado como perdido / baja definitiva",
        };
      })
      .filter((item) => {
        if (!appliedRange.startDate && !appliedRange.endDate) return true;
        if (!item.date) return true;
        if (appliedRange.startDate && item.date < appliedRange.startDate) return false;
        if (appliedRange.endDate && item.date > appliedRange.endDate) return false;
        return true;
      });
  }, [assets, lostReports, appliedRange]);

  const lostByModelDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of lostAssetsBreakdown) {
      const m = item.asset.model?.trim() || "Sin modelo";
      map.set(m, (map.get(m) || 0) + (item.asset.estimatedValue ?? 0));
    }
    const totalLost = metrics?.estimatedLossValue || 1;
    return Array.from(map.entries())
      .map(([model, val]) => ({
        label: model,
        value: val,
        formattedValue: <CurrencyDisplay usdAmount={val} />,
        percentage: (val / totalLost) * 100,
        color: "#ef4444",
      }))
      .sort((a, b) => b.value - a.value);
  }, [lostAssetsBreakdown, metrics?.estimatedLossValue]);

  // 2. MANTENIMIENTO CON COSTO > 0
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

  const providerMaintenanceDistribution = useMemo(() => {
    const map = new Map<string, { totalCost: number; count: number }>();
    for (const rec of maintenanceBreakdown) {
      const p = rec.providerName?.trim() || "Interno / Taller propio";
      const entry = map.get(p) || { totalCost: 0, count: 0 };
      entry.totalCost += rec.cost ?? 0;
      entry.count += 1;
      map.set(p, entry);
    }
    const totalMaint = metrics?.maintenanceCostsValue || 1;
    return Array.from(map.entries())
      .map(([provider, data]) => ({
        label: provider,
        value: data.totalCost,
        formattedValue: <CurrencyDisplay usdAmount={data.totalCost} />,
        percentage: (data.totalCost / totalMaint) * 100,
        color: "#f59e0b",
      }))
      .sort((a, b) => b.value - a.value);
  }, [maintenanceBreakdown, metrics?.maintenanceCostsValue]);

  // 3. PÉRDIDA ECONÓMICA TOTAL (MERMAS + MANTENIMIENTO)
  const totalLossItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: "LOST" | "MAINTENANCE";
      serialNumber: string;
      model: string;
      detail: string;
      date: string;
      cost: number;
    }> = [];

    for (const { asset, date, notes } of lostAssetsBreakdown) {
      items.push({
        id: `lost-${asset.id}`,
        type: "LOST",
        serialNumber: asset.serialNumber,
        model: asset.model || "—",
        detail: notes || "Pérdida / Baja definitiva",
        date: date || "—",
        cost: asset.estimatedValue ?? 0,
      });
    }

    for (const rec of maintenanceBreakdown) {
      items.push({
        id: `maint-${rec.id}`,
        type: "MAINTENANCE",
        serialNumber: rec.asset?.serialNumber || "—",
        model: rec.asset?.model || "—",
        detail: `${rec.providerName || "Interno"}: ${rec.reason || "Mantenimiento general"}`,
        date: rec.startDate ? rec.startDate.split("T")[0] : "—",
        cost: rec.cost ?? 0,
      });
    }

    return items.sort((a, b) => b.cost - a.cost);
  }, [lostAssetsBreakdown, maintenanceBreakdown]);

  // 4. PUNTUALIDAD · DEVOLUCIONES CERRADAS
  const returnedLoansBreakdown = useMemo(() => {
    return loans.filter((l) => {
      const isReturned = l.status === "RETURNED" || (l.returnDateTime != null && l.returnDateTime.trim() !== "");
      if (!isReturned) return false;
      const returnDate = l.returnDateTime ? l.returnDateTime.split("T")[0] : null;
      if (appliedRange.startDate && returnDate && returnDate < appliedRange.startDate) return false;
      if (appliedRange.endDate && returnDate && returnDate > appliedRange.endDate) return false;
      return true;
    });
  }, [loans, appliedRange]);

  const onTimeLoans = useMemo(() => {
    return returnedLoansBreakdown.filter((l) => l.delayDays == null || l.delayDays <= 0);
  }, [returnedLoansBreakdown]);

  const delayedLoans = useMemo(() => {
    return returnedLoansBreakdown.filter((l) => l.delayDays != null && l.delayDays > 0);
  }, [returnedLoansBreakdown]);

  const avgDelayDays = useMemo(() => {
    if (delayedLoans.length === 0) return 0;
    const sum = delayedLoans.reduce((acc, l) => acc + (l.delayDays ?? 0), 0);
    return sum / delayedLoans.length;
  }, [delayedLoans]);

  // 5. CUSTODIA · ACTUAL (EN CAMPO)
  const inFieldLoansBreakdown = useMemo(() => {
    return loans.filter(
      (l) => l.status === "APPROVED" && (!l.returnDateTime || l.returnDateTime.trim() === "")
    );
  }, [loans]);

  const inFieldTotalValue = useMemo(() => {
    return inFieldLoansBreakdown.reduce((sum, l) => sum + (l.asset?.estimatedValue ?? 0), 0);
  }, [inFieldLoansBreakdown]);

  const inFieldByTechnician = useMemo(() => {
    const map = new Map<string, { name: string; email: string; count: number; totalValue: number }>();
    for (const loan of inFieldLoansBreakdown) {
      const email = loan.user?.email || "Sin asignar";
      const name = loan.user ? getDisplayUserName(loan.user) : "Desconocido";
      const entry = map.get(email) || { name, email, count: 0, totalValue: 0 };
      entry.count += 1;
      entry.totalValue += loan.asset?.estimatedValue ?? 0;
      map.set(email, entry);
    }
    const totalCount = inFieldLoansBreakdown.length || 1;
    return Array.from(map.values())
      .map((item) => ({
        label: `${item.name} (${item.email})`,
        value: item.count,
        formattedValue: `${item.count} ${item.count === 1 ? "equipo" : "equipos"}`,
        percentage: (item.count / totalCount) * 100,
        color: "#3b82f6",
      }))
      .sort((a, b) => b.value - a.value);
  }, [inFieldLoansBreakdown]);

  // 6, 7, 8, 9. MODALES DE INVENTARIO
  const availableAssetsList = useMemo(() => assets.filter((a) => a.status === "AVAILABLE"), [assets]);
  const availableAssetsValue = useMemo(
    () => availableAssetsList.reduce((sum, a) => sum + (a.estimatedValue ?? 0), 0),
    [availableAssetsList]
  );

  const maintenanceAssetsList = useMemo(
    () => assets.filter((a) => a.status === "UNDER_MAINTENANCE"),
    [assets]
  );
  const maintenanceAssetsValue = useMemo(
    () => maintenanceAssetsList.reduce((sum, a) => sum + (a.estimatedValue ?? 0), 0),
    [maintenanceAssetsList]
  );

  const lostAssetsList = useMemo(() => assets.filter((a) => a.status === "LOST"), [assets]);
  const lostAssetsValue = useMemo(
    () => lostAssetsList.reduce((sum, a) => sum + (a.estimatedValue ?? 0), 0),
    [lostAssetsList]
  );

  const loanedAssetsCount = useMemo(
    () => assets.filter((a) => a.status === "LOANED" || a.status === "ON_LOAN").length,
    [assets]
  );

  function getTopModelsBarData(list: AssetItem[], color: string) {
    const map = new Map<string, number>();
    for (const a of list) {
      const m = a.model?.trim() || "Sin modelo";
      map.set(m, (map.get(m) || 0) + 1);
    }
    const total = list.length || 1;
    return Array.from(map.entries())
      .map(([model, count]) => ({
        label: model,
        value: count,
        formattedValue: `${count} ${count === 1 ? "unidad" : "unidades"}`,
        percentage: (count / total) * 100,
        color,
      }))
      .sort((a, b) => b.value - a.value);
  }

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
              onClick={() => openMetricModal("loss")}
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
              onClick={() => openMetricModal("maintenance")}
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
              onClick={() => openMetricModal("totalLoss")}
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
              onClick={() => openMetricModal("onTime")}
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
              onClick={() => openMetricModal("inField")}
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
              <InsightCard
                label="TOTAL DE EQUIPOS"
                value={metrics.totalAssets}
                description="Activos registrados en el inventario."
                progress={100}
                detail={`${metrics.totalAssets} equipos registrados en total.`}
                onClick={() => openMetricModal("invTotal")}
              />
              <InsightCard
                label="DISPONIBLES"
                value={metrics.availableAssets}
                description="Listos para asignación."
                progress={metrics.totalAssets ? (metrics.availableAssets / metrics.totalAssets) * 100 : 0}
                detail={`${metrics.availableAssets} de ${metrics.totalAssets} equipos están disponibles.`}
                onClick={() => openMetricModal("invAvailable")}
              />
              <InsightCard
                label="EN MANTENIMIENTO"
                value={metrics.assetsUnderMaintenance}
                description="Equipos con una intervención abierta."
                progress={metrics.totalAssets ? (metrics.assetsUnderMaintenance / metrics.totalAssets) * 100 : 0}
                detail={`${metrics.assetsUnderMaintenance} equipos están actualmente en mantenimiento.`}
                onClick={() => openMetricModal("invMaintenance")}
              />
              <InsightCard
                label="PERDIDOS"
                value={metrics.lostAssets}
                description="Equipos reportados como perdidos."
                progress={metrics.totalAssets ? (metrics.lostAssets / metrics.totalAssets) * 100 : 0}
                detail={`${metrics.lostAssets} equipos figuran con estado perdido.`}
                onClick={() => openMetricModal("invLost")}
              />
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
                            {availPct > 0 && (
                              <span
                                className="bar-seg bar-seg-available"
                                style={{ width: `${availPct}%` }}
                                title={`${stats.available} disponibles`}
                              />
                            )}
                            {loanPct > 0 && (
                              <span
                                className="bar-seg bar-seg-loaned"
                                style={{ width: `${loanPct}%` }}
                                title={`${stats.loaned} en préstamo`}
                              />
                            )}
                            {maintPct > 0 && (
                              <span
                                className="bar-seg bar-seg-maintenance"
                                style={{ width: `${maintPct}%` }}
                                title={`${stats.maintenance} en mantenimiento`}
                              />
                            )}
                            {lostPct > 0 && (
                              <span
                                className="bar-seg bar-seg-lost"
                                style={{ width: `${lostPct}%` }}
                                title={`${stats.lost} perdidos`}
                              />
                            )}
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

      {/* ========================================================================
          MODALES DE DESGLOSE ANALÍTICO ("VER DESGLOSE")
          ======================================================================== */}

      {selectedMetric && (
        <Dialog
          open
          title={
            selectedMetric === "loss"
              ? "Mermas por activos perdidos o baja definitiva"
              : selectedMetric === "maintenance"
              ? "Gastos e intervenciones de mantenimiento"
              : selectedMetric === "totalLoss"
              ? "Pérdida económica total consolidada"
              : selectedMetric === "onTime"
              ? "Puntualidad en devoluciones de préstamos"
              : selectedMetric === "inField"
              ? "Activos actualmente en campo"
              : selectedMetric === "invTotal"
              ? "Inventario completo de la flota"
              : selectedMetric === "invAvailable"
              ? "Equipos disponibles para préstamo"
              : selectedMetric === "invMaintenance"
              ? "Equipos en taller o mantenimiento activo"
              : "Equipos declarados en pérdida o merma"
          }
          eyebrow={
            selectedMetric === "loss"
              ? "REPORTE ANALÍTICO · MERMAS"
              : selectedMetric === "maintenance"
              ? "REPORTE ANALÍTICO · MANTENIMIENTO"
              : selectedMetric === "totalLoss"
              ? "REPORTE FINANCIERO CONSOLIDADO"
              : selectedMetric === "onTime"
              ? "REPORTE ANALÍTICO · LOGÍSTICA"
              : selectedMetric === "inField"
              ? "REPORTE OPERATIVO · CUSTODIA"
              : "REPORTE DE FLOTA · INVENTARIO"
          }
          onClose={() => setSelectedMetric(null)}
        >
          <div className="space-y-4 pt-1">
            {/* 1. MODAL MERMAS */}
            {selectedMetric === "loss" && (
              <>
                <ModalKpiGrid
                  items={[
                    {
                      label: "Total perdidos",
                      value: lostAssetsBreakdown.length,
                      sub: "Activos con baja",
                    },
                    {
                      label: "Impacto financiero",
                      value: <CurrencyDisplay usdAmount={metrics?.estimatedLossValue ?? 0} />,
                      sub: "Valor estimado",
                    },
                    {
                      label: "Promedio / equipo",
                      value: (
                        <CurrencyDisplay
                          usdAmount={
                            lostAssetsBreakdown.length > 0
                              ? (metrics?.estimatedLossValue ?? 0) / lostAssetsBreakdown.length
                              : 0
                          }
                        />
                      ),
                      sub: "Costo unitario medio",
                    },
                    {
                      label: "% del inventario",
                      value: `${(
                        ((metrics?.estimatedLossValue ?? 0) / Math.max(1, totalInventoryValue)) *
                        100
                      ).toFixed(1)}%`,
                      sub: "Impacto sobre flota",
                    },
                  ]}
                />

                <div className="modal-chart-card">
                  <div className="modal-chart-title">
                    <span>Distribución del valor perdido por modelo</span>
                    <span className="font-mono text-xs text-rose-600 dark:text-rose-400 font-bold">
                      <CurrencyDisplay usdAmount={metrics?.estimatedLossValue ?? 0} />
                    </span>
                  </div>
                  <HorizontalBarChart items={lostByModelDistribution} maxCount={6} />
                </div>

                <div>
                  <div className="modal-table-controls">
                    <label className="search-control">
                      <Search size={14} />
                      <input
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        placeholder="Buscar por serie o modelo..."
                        aria-label="Buscar equipos perdidos"
                      />
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      {
                        lostAssetsBreakdown.filter((item) => {
                          const s = normalizeText(modalSearch.trim());
                          return (
                            !s ||
                            normalizeText(item.asset.serialNumber).includes(s) ||
                            normalizeText(item.asset.model || "").includes(s)
                          );
                        }).length
                      }{" "}
                      de {lostAssetsBreakdown.length} equipos
                    </span>
                  </div>

                  <div className="metric-breakdown-table-wrap">
                    <table className="metric-breakdown-table">
                      <thead>
                        <tr>
                          <th>Serie</th>
                          <th>Modelo</th>
                          <th>Fecha reporte/baja</th>
                          <th>Observaciones</th>
                          <th className="text-right">Valor estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lostAssetsBreakdown
                          .filter((item) => {
                            const s = normalizeText(modalSearch.trim());
                            return (
                              !s ||
                              normalizeText(item.asset.serialNumber).includes(s) ||
                              normalizeText(item.asset.model || "").includes(s)
                            );
                          })
                          .map(({ asset, date, notes }) => (
                            <tr key={asset.id}>
                              <td>
                                <span className="flex items-center gap-1 font-mono font-semibold">
                                  {asset.serialNumber}
                                  <CopyButton
                                    text={asset.serialNumber}
                                    label={`Copiar serie ${asset.serialNumber}`}
                                  />
                                </span>
                              </td>
                              <td>{asset.model || "—"}</td>
                              <td className="font-mono text-slate-500">{date || "—"}</td>
                              <td className="max-w-xs truncate" title={notes}>
                                {notes}
                              </td>
                              <td className="text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                                <CurrencyDisplay usdAmount={asset.estimatedValue ?? 0} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 2. MODAL MANTENIMIENTO */}
            {selectedMetric === "maintenance" && (
              <>
                <ModalKpiGrid
                  items={[
                    {
                      label: "Intervenciones facturadas",
                      value: maintenanceBreakdown.length,
                      sub: "Con costo mayor a $0",
                    },
                    {
                      label: "Gasto total acumulado",
                      value: <CurrencyDisplay usdAmount={metrics?.maintenanceCostsValue ?? 0} />,
                      sub: "Facturado en órdenes",
                    },
                    {
                      label: "Costo promedio",
                      value: (
                        <CurrencyDisplay
                          usdAmount={
                            maintenanceBreakdown.length > 0
                              ? (metrics?.maintenanceCostsValue ?? 0) / maintenanceBreakdown.length
                              : 0
                          }
                        />
                      ),
                      sub: "Por intervención",
                    },
                    {
                      label: "Mayor proveedor",
                      value: providerMaintenanceDistribution[0]?.label || "—",
                      sub: `${providerMaintenanceDistribution[0]?.percentage.toFixed(0) ?? 0}% del gasto`,
                    },
                  ]}
                />

                <div className="modal-chart-card">
                  <div className="modal-chart-title">
                    <span>Gasto consolidado por Proveedor Técnico</span>
                    <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-bold">
                      <CurrencyDisplay usdAmount={metrics?.maintenanceCostsValue ?? 0} />
                    </span>
                  </div>
                  <HorizontalBarChart items={providerMaintenanceDistribution} maxCount={6} />
                </div>

                <div>
                  <div className="modal-table-controls">
                    <label className="search-control">
                      <Search size={14} />
                      <input
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        placeholder="Buscar por serie, modelo o proveedor..."
                        aria-label="Buscar intervenciones de mantenimiento"
                      />
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      {
                        maintenanceBreakdown.filter((rec) => {
                          const s = normalizeText(modalSearch.trim());
                          return (
                            !s ||
                            normalizeText(rec.asset?.serialNumber || "").includes(s) ||
                            normalizeText(rec.asset?.model || "").includes(s) ||
                            normalizeText(rec.providerName || "").includes(s)
                          );
                        }).length
                      }{" "}
                      de {maintenanceBreakdown.length} intervenciones
                    </span>
                  </div>

                  <div className="metric-breakdown-table-wrap">
                    <table className="metric-breakdown-table">
                      <thead>
                        <tr>
                          <th>Serie</th>
                          <th>Modelo</th>
                          <th>Motivo</th>
                          <th>Proveedor</th>
                          <th>Fecha inicio</th>
                          <th className="text-right">Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maintenanceBreakdown
                          .filter((rec) => {
                            const s = normalizeText(modalSearch.trim());
                            return (
                              !s ||
                              normalizeText(rec.asset?.serialNumber || "").includes(s) ||
                              normalizeText(rec.asset?.model || "").includes(s) ||
                              normalizeText(rec.providerName || "").includes(s)
                            );
                          })
                          .map((rec) => (
                            <tr key={rec.id}>
                              <td>
                                <span className="flex items-center gap-1 font-mono font-semibold">
                                  {rec.asset?.serialNumber || "—"}
                                  {rec.asset?.serialNumber && (
                                    <CopyButton
                                      text={rec.asset.serialNumber}
                                      label={`Copiar serie ${rec.asset.serialNumber}`}
                                    />
                                  )}
                                </span>
                              </td>
                              <td>{rec.asset?.model || "—"}</td>
                              <td className="max-w-xs truncate" title={rec.reason || ""}>
                                {rec.reason || "Mantenimiento general"}
                              </td>
                              <td>{rec.providerName || "Interno"}</td>
                              <td className="font-mono text-slate-500">
                                {rec.startDate ? rec.startDate.split("T")[0] : "—"}
                              </td>
                              <td className="text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                                <CurrencyDisplay usdAmount={rec.cost ?? 0} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 3. MODAL PÉRDIDA ECONÓMICA TOTAL */}
            {selectedMetric === "totalLoss" && (
              <>
                <ModalKpiGrid
                  items={[
                    {
                      label: "Pérdida total",
                      value: <CurrencyDisplay usdAmount={metrics?.totalEconomicLoss ?? 0} />,
                      sub: "Impacto consolidado",
                    },
                    {
                      label: "Mermas (activos)",
                      value: <CurrencyDisplay usdAmount={metrics?.estimatedLossValue ?? 0} />,
                      sub: `${(
                        ((metrics?.estimatedLossValue ?? 0) /
                          Math.max(1, metrics?.totalEconomicLoss ?? 1)) *
                        100
                      ).toFixed(1)}% del impacto`,
                    },
                    {
                      label: "Mantenimiento",
                      value: <CurrencyDisplay usdAmount={metrics?.maintenanceCostsValue ?? 0} />,
                      sub: `${(
                        ((metrics?.maintenanceCostsValue ?? 0) /
                          Math.max(1, metrics?.totalEconomicLoss ?? 1)) *
                        100
                      ).toFixed(1)}% del impacto`,
                    },
                    {
                      label: "Total eventos",
                      value: totalLossItems.length,
                      sub: `${lostAssetsBreakdown.length} mermas / ${maintenanceBreakdown.length} mant.`,
                    },
                  ]}
                />

                <div className="modal-chart-card">
                  <div className="modal-chart-title">
                    <span>Composición financiera del impacto económico<i> (eventos)</i></span> 
                    <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                      <CurrencyDisplay usdAmount={metrics?.totalEconomicLoss ?? 0} />
                    </span>
                  </div>
                  <DonutChart
                    segments={[
                      {
                        label: "Mermas (activos perdidos)",
                        value: metrics?.estimatedLossValue ?? 0,
                        color: "#ef4444",
                        formattedValue: <CurrencyDisplay usdAmount={metrics?.estimatedLossValue ?? 0} />,
                      },
                      {
                        label: "Reparaciones y mantenimiento",
                        value: metrics?.maintenanceCostsValue ?? 0,
                        color: "#f59e0b",
                        formattedValue: <CurrencyDisplay usdAmount={metrics?.maintenanceCostsValue ?? 0} />,
                      },
                    ]}
                    centerValue={`${totalLossItems.length} ev.`}
                    centerLabel="CONSOLIDADO"
                  />
                </div>

                <div>
                  <div className="modal-table-controls">
                    <label className="search-control">
                      <Search size={14} />
                      <input
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        placeholder="Buscar por serie, modelo o detalle..."
                        aria-label="Buscar eventos de pérdida económica"
                      />
                    </label>
                    <SelectInput
                      className="filter-select w-44 text-xs"
                      value={modalFilter}
                      onChange={(e) => setModalFilter(e.target.value)}
                      aria-label="Filtrar por tipo de pérdida"
                    >
                      <option value="ALL">Todos los tipos</option>
                      <option value="LOST">Solo mermas / activos</option>
                      <option value="MAINTENANCE">Solo mantenimientos</option>
                    </SelectInput>
                    <span className="text-[11px] font-mono text-slate-500">
                      {
                        totalLossItems
                          .filter((item) => {
                            if (modalFilter !== "ALL" && item.type !== modalFilter) return false;
                            const s = normalizeText(modalSearch.trim());
                            return (
                              !s ||
                              normalizeText(item.serialNumber).includes(s) ||
                              normalizeText(item.model).includes(s) ||
                              normalizeText(item.detail).includes(s)
                            );
                          }).length
                      }{" "}
                      de {totalLossItems.length} registros
                    </span>
                  </div>

                  <div className="metric-breakdown-table-wrap">
                    <table className="metric-breakdown-table">
                      <thead>
                        <tr>
                          <th className="whitespace-nowrap">Tipo</th>
                          <th className="whitespace-nowrap">Serie / Equipo</th>
                          <th>Modelo</th>
                          <th>Detalle / Proveedor</th>
                          <th className="whitespace-nowrap">Fecha</th>
                          <th className="text-right whitespace-nowrap">Impacto económico</th>
                        </tr>
                      </thead>
                      <tbody>
                        {totalLossItems
                          .filter((item) => {
                            if (modalFilter !== "ALL" && item.type !== modalFilter) return false;
                            const s = normalizeText(modalSearch.trim());
                            return (
                              !s ||
                              normalizeText(item.serialNumber).includes(s) ||
                              normalizeText(item.model).includes(s) ||
                              normalizeText(item.detail).includes(s)
                            );
                          })
                          .map((item) => (
                            <tr key={item.id}>
                              <td className="whitespace-nowrap">
                                {item.type === "LOST" ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300">
                                    Merma
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                                    Mantenimiento
                                  </span>
                                )}
                              </td>
                              <td className="whitespace-nowrap">
                                <span className="flex items-center gap-1 font-mono font-semibold">
                                  {item.serialNumber}
                                  {item.serialNumber !== "—" && (
                                    <CopyButton
                                      text={item.serialNumber}
                                      label={`Copiar serie ${item.serialNumber}`}
                                    />
                                  )}
                                </span>
                              </td>
                              <td>{item.model}</td>
                              <td className="max-w-xs truncate" title={item.detail}>
                                {item.detail}
                              </td>
                              <td className="font-mono text-slate-500 whitespace-nowrap">{item.date}</td>
                              <td
                                className={`text-right font-mono font-semibold whitespace-nowrap ${
                                  item.type === "LOST"
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                <CurrencyDisplay usdAmount={item.cost} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 4. MODAL PUNTUALIDAD */}
            {selectedMetric === "onTime" && (
              <>
                <ModalKpiGrid
                  items={[
                    {
                      label: "Total devoluciones",
                      value: returnedLoansBreakdown.length,
                      sub: "Préstamos cerrados",
                    },
                    {
                      label: "Tasa puntualidad",
                      value: `${punctuality.toFixed(1)}%`,
                      sub: `${onTimeLoans.length} a tiempo`,
                    },
                    {
                      label: "Devoluciones con mora",
                      value: delayedLoans.length,
                      sub: `${(100 - punctuality).toFixed(1)}% fuera de plazo`,
                    },
                    {
                      label: "Retraso promedio",
                      value: `${avgDelayDays.toFixed(1)} días`,
                      sub: "En préstamos con mora",
                    },
                  ]}
                />

                <div className="modal-chart-card">
                  <div className="modal-chart-title">
                    <span>Balance de entregas en el periodo</span>
                    <span className="font-mono text-xs text-emerald-600 font-bold">
                      {punctuality.toFixed(0)}% a tiempo
                    </span>
                  </div>
                  <DonutChart
                    segments={[
                      {
                        label: "Devueltos a tiempo",
                        value: onTimeLoans.length,
                        color: "#10b981",
                        formattedValue: `${onTimeLoans.length} préstamos`,
                      },
                      {
                        label: "Devueltos fuera de plazo",
                        value: delayedLoans.length,
                        color: "#ef4444",
                        formattedValue: `${delayedLoans.length} préstamos`,
                      },
                    ]}
                    centerValue={`${punctuality.toFixed(0)}%`}
                    centerLabel="A TIEMPO"
                  />
                </div>

                <div>
                  <div className="modal-table-controls">
                    <label className="search-control">
                      <Search size={14} />
                      <input
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        placeholder="Buscar por serie, modelo o técnico..."
                        aria-label="Buscar préstamos devueltos"
                      />
                    </label>
                    <SelectInput
                      className="filter-select w-44 text-xs"
                      value={modalFilter}
                      onChange={(e) => setModalFilter(e.target.value)}
                      aria-label="Filtrar por puntualidad"
                    >
                      <option value="ALL">Todas las devoluciones</option>
                      <option value="ON_TIME">Solo a tiempo</option>
                      <option value="DELAYED">Solo con mora</option>
                    </SelectInput>
                    <span className="text-[11px] font-mono text-slate-500">
                      {
                        returnedLoansBreakdown.filter((l) => {
                          const isDelayed = l.delayDays != null && l.delayDays > 0;
                          if (modalFilter === "ON_TIME" && isDelayed) return false;
                          if (modalFilter === "DELAYED" && !isDelayed) return false;
                          const s = normalizeText(modalSearch.trim());
                          return (
                            !s ||
                            normalizeText(l.asset?.serialNumber || "").includes(s) ||
                            normalizeText(l.asset?.model || "").includes(s) ||
                            normalizeText(l.user?.fullName || "").includes(s) ||
                            normalizeText(l.user?.email || "").includes(s)
                          );
                        }).length
                      }{" "}
                      de {returnedLoansBreakdown.length} devoluciones
                    </span>
                  </div>

                  <div className="metric-breakdown-table-wrap">
                    <table className="metric-breakdown-table">
                      <thead>
                        <tr>
                          <th>Serie</th>
                          <th>Modelo</th>
                          <th>Técnico</th>
                          <th>Fecha límite</th>
                          <th>Fecha devolución</th>
                          <th>Estado / Mora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnedLoansBreakdown
                          .filter((l) => {
                            const isDelayed = l.delayDays != null && l.delayDays > 0;
                            if (modalFilter === "ON_TIME" && isDelayed) return false;
                            if (modalFilter === "DELAYED" && !isDelayed) return false;
                            const s = normalizeText(modalSearch.trim());
                            return (
                              !s ||
                              normalizeText(l.asset?.serialNumber || "").includes(s) ||
                              normalizeText(l.asset?.model || "").includes(s) ||
                              normalizeText(l.user?.fullName || "").includes(s) ||
                              normalizeText(l.user?.email || "").includes(s)
                            );
                          })
                          .map((loan) => {
                            const isDelayed = loan.delayDays != null && loan.delayDays > 0;
                            return (
                              <tr key={loan.id}>
                                <td>
                                  <span className="flex items-center gap-1 font-mono font-semibold">
                                    {loan.asset?.serialNumber || "—"}
                                    {loan.asset?.serialNumber && (
                                      <CopyButton
                                        text={loan.asset.serialNumber}
                                        label={`Copiar serie ${loan.asset.serialNumber}`}
                                      />
                                    )}
                                  </span>
                                </td>
                                <td>{loan.asset?.model || "—"}</td>
                                <td>
                                  {loan.user ? (
                                    <span title={loan.user.email}>
                                      <strong className="text-slate-800 dark:text-slate-200">
                                        {getDisplayUserName(loan.user)}
                                      </strong>
                                      <span className="block text-[10px] text-slate-500 font-mono">
                                        {loan.user.email}
                                      </span>
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="font-mono">{loan.dueLocalDate || "—"}</td>
                                <td className="font-mono text-slate-500">
                                  {loan.returnDateTime ? loan.returnDateTime.split("T")[0] : "—"}
                                </td>
                                <td>
                                  {isDelayed ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300">
                                      +{loan.delayDays}d mora
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                                      A tiempo
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 5. MODAL CUSTODIA · ACTUAL */}
            {selectedMetric === "inField" && (
              <>
                <ModalKpiGrid
                  items={[
                    {
                      label: "Equipos en campo",
                      value: inFieldLoansBreakdown.length,
                      sub: "Actualmente asignados",
                    },
                    {
                      label: "Valor desplegado",
                      value: <CurrencyDisplay usdAmount={inFieldTotalValue} />,
                      sub: "Bajo custodia técnica",
                    },
                    {
                      label: "Técnicos activos",
                      value: inFieldByTechnician.length,
                      sub: "Con equipos a cargo",
                    },
                    {
                      label: "Mayor custodio",
                      value: inFieldByTechnician[0]?.label.split(" (")[0] || "—",
                      sub: inFieldByTechnician[0]?.formattedValue || "0 equipos",
                    },
                  ]}
                />

                <div className="modal-chart-card">
                  <div className="modal-chart-title">
                    <span>Equipos desplegados por Técnico de Campo</span>
                    <span className="font-mono text-xs text-blue-600 font-bold">
                      {inFieldLoansBreakdown.length} equipos activos
                    </span>
                  </div>
                  <HorizontalBarChart items={inFieldByTechnician} maxCount={6} />
                </div>

                <div>
                  <div className="modal-table-controls">
                    <label className="search-control">
                      <Search size={14} />
                      <input
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        placeholder="Buscar por serie, modelo o técnico..."
                        aria-label="Buscar equipos en campo"
                      />
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      {
                        inFieldLoansBreakdown.filter((loan) => {
                          const s = normalizeText(modalSearch.trim());
                          return (
                            !s ||
                            normalizeText(loan.asset?.serialNumber || "").includes(s) ||
                            normalizeText(loan.asset?.model || "").includes(s) ||
                            normalizeText(loan.user?.fullName || "").includes(s) ||
                            normalizeText(loan.user?.email || "").includes(s)
                          );
                        }).length
                      }{" "}
                      de {inFieldLoansBreakdown.length} equipos
                    </span>
                  </div>

                  <div className="metric-breakdown-table-wrap">
                    <table className="metric-breakdown-table">
                      <thead>
                        <tr>
                          <th>Serie</th>
                          <th>Modelo</th>
                          <th>Técnico responsable</th>
                          <th>Fecha entrega</th>
                          <th>Fecha límite</th>
                          <th className="text-right">Valor custodiado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inFieldLoansBreakdown
                          .filter((loan) => {
                            const s = normalizeText(modalSearch.trim());
                            return (
                              !s ||
                              normalizeText(loan.asset?.serialNumber || "").includes(s) ||
                              normalizeText(loan.asset?.model || "").includes(s) ||
                              normalizeText(loan.user?.fullName || "").includes(s) ||
                              normalizeText(loan.user?.email || "").includes(s)
                            );
                          })
                          .map((loan) => (
                            <tr key={loan.id}>
                              <td>
                                <span className="flex items-center gap-1 font-mono font-semibold">
                                  {loan.asset?.serialNumber || "—"}
                                  {loan.asset?.serialNumber && (
                                    <CopyButton
                                      text={loan.asset.serialNumber}
                                      label={`Copiar serie ${loan.asset.serialNumber}`}
                                    />
                                  )}
                                </span>
                              </td>
                              <td>{loan.asset?.model || "—"}</td>
                              <td>
                                {loan.user ? (
                                  <span title={loan.user.email}>
                                    <strong className="text-slate-800 dark:text-slate-200">
                                      {getDisplayUserName(loan.user)}
                                    </strong>
                                    <span className="block text-[10px] text-slate-500 font-mono">
                                      {loan.user.email}
                                    </span>
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="font-mono text-slate-500">
                                {loan.requestDate ? loan.requestDate.split("T")[0] : "—"}
                              </td>
                              <td className="font-mono font-semibold">{loan.dueLocalDate || "—"}</td>
                              <td className="text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                                <CurrencyDisplay usdAmount={loan.asset?.estimatedValue ?? 0} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 6. MODAL TOTAL DE EQUIPOS */}
            {selectedMetric === "invTotal" && (
              <>
                <ModalKpiGrid
                  items={[
                    {
                      label: "Total flota",
                      value: assets.length,
                      sub: "Activos en inventario",
                    },
                    {
                      label: "Valorización total",
                      value: <CurrencyDisplay usdAmount={totalInventoryValue} />,
                      sub: "Activos patrimoniales",
                    },
                    {
                      label: "Flota operativa",
                      value: availableAssetsList.length + loanedAssetsCount,
                      sub: "Disponibles + Préstamos",
                    },
                    {
                      label: "Disponibilidad",
                      value: `${(
                        (availableAssetsList.length / Math.max(1, assets.length)) *
                        100
                      ).toFixed(1)}%`,
                      sub: "En bodega",
                    },
                  ]}
                />

                <div className="modal-chart-card">
                  <div className="modal-chart-title">
                    <span>Estado integral de la flota de activos</span>
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      {assets.length} unidades
                    </span>
                  </div>
                  <DonutChart
                    segments={[
                      {
                        label: "Disponibles",
                        value: availableAssetsList.length,
                        color: "#10b981",
                        formattedValue: `${availableAssetsList.length} equipos`,
                      },
                      {
                        label: "En préstamo",
                        value: loanedAssetsCount,
                        color: "#3b82f6",
                        formattedValue: `${loanedAssetsCount} equipos`,
                      },
                      {
                        label: "En mantenimiento",
                        value: maintenanceAssetsList.length,
                        color: "#f59e0b",
                        formattedValue: `${maintenanceAssetsList.length} equipos`,
                      },
                      {
                        label: "Perdidos / Mermas",
                        value: lostAssetsList.length,
                        color: "#ef4444",
                        formattedValue: `${lostAssetsList.length} equipos`,
                      },
                    ]}
                    centerValue={assets.length}
                    centerLabel="TOTAL"
                  />
                </div>

                <div>
                  <div className="modal-table-controls">
                    <label className="search-control">
                      <Search size={14} />
                      <input
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        placeholder="Buscar por serie o modelo..."
                        aria-label="Buscar equipos en inventario"
                      />
                    </label>
                    <SelectInput
                      className="filter-select w-44 text-xs"
                      value={modalFilter}
                      onChange={(e) => setModalFilter(e.target.value)}
                      aria-label="Filtrar por estado"
                    >
                      <option value="ALL">Todos los estados</option>
                      <option value="AVAILABLE">Disponible</option>
                      <option value="LOANED">En préstamo</option>
                      <option value="UNDER_MAINTENANCE">En mantenimiento</option>
                      <option value="LOST">Perdido</option>
                    </SelectInput>
                    <span className="text-[11px] font-mono text-slate-500">
                      {
                        assets.filter((a) => {
                          if (modalFilter !== "ALL") {
                            if (modalFilter === "LOANED") {
                              if (a.status !== "LOANED" && a.status !== "ON_LOAN") return false;
                            } else if (a.status !== modalFilter) {
                              return false;
                            }
                          }
                          const s = normalizeText(modalSearch.trim());
                          return (
                            !s ||
                            normalizeText(a.serialNumber).includes(s) ||
                            normalizeText(a.model || "").includes(s)
                          );
                        }).length
                      }{" "}
                      de {assets.length} equipos
                    </span>
                  </div>

                  <div className="metric-breakdown-table-wrap">
                    <table className="metric-breakdown-table">
                      <thead>
                        <tr>
                          <th>Serie</th>
                          <th>Modelo</th>
                          <th>Fecha compra</th>
                          <th>Estado</th>
                          <th className="text-right">Valor estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assets
                          .filter((a) => {
                            if (modalFilter !== "ALL") {
                              if (modalFilter === "LOANED") {
                                if (a.status !== "LOANED" && a.status !== "ON_LOAN") return false;
                              } else if (a.status !== modalFilter) {
                                return false;
                              }
                            }
                            const s = normalizeText(modalSearch.trim());
                            return (
                              !s ||
                              normalizeText(a.serialNumber).includes(s) ||
                              normalizeText(a.model || "").includes(s)
                            );
                          })
                          .map((a) => (
                            <tr key={a.id}>
                              <td>
                                <span className="flex items-center gap-1 font-mono font-semibold">
                                  {a.serialNumber}
                                  <CopyButton text={a.serialNumber} label={`Copiar serie ${a.serialNumber}`} />
                                </span>
                              </td>
                              <td>{a.model || "—"}</td>
                              <td className="font-mono text-slate-500">{a.purchaseDate || "—"}</td>
                              <td>
                                <StatusTag value={a.status} />
                              </td>
                              <td className="text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                                <CurrencyDisplay usdAmount={a.estimatedValue ?? 0} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 7. MODAL DISPONIBLES */}
            {selectedMetric === "invAvailable" && (
              <>
                <ModalKpiGrid
                  items={[
                    {
                      label: "Equipos disponibles",
                      value: availableAssetsList.length,
                      sub: "En bodega para préstamo",
                    },
                    {
                      label: "Valorización disponible",
                      value: <CurrencyDisplay usdAmount={availableAssetsValue} />,
                      sub: "Listo para desplegar",
                    },
                    {
                      label: "% de la flota",
                      value: `${(
                        (availableAssetsList.length / Math.max(1, assets.length)) *
                        100
                      ).toFixed(1)}%`,
                      sub: "Stock activo",
                    },
                    {
                      label: "Modelos con stock",
                      value: new Set(availableAssetsList.map((a) => a.model)).size,
                      sub: "Variantes en inventario",
                    },
                  ]}
                />

                <div className="modal-chart-card">
                  <div className="modal-chart-title">
                    <span>Modelos con mayor stock disponible</span>
                    <span className="font-mono text-xs font-bold text-emerald-600">
                      {availableAssetsList.length} equipos
                    </span>
                  </div>
                  <HorizontalBarChart
                    items={getTopModelsBarData(availableAssetsList, "#10b981")}
                    maxCount={6}
                  />
                </div>

                <div>
                  <div className="modal-table-controls">
                    <label className="search-control">
                      <Search size={14} />
                      <input
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        placeholder="Buscar por serie o modelo..."
                        aria-label="Buscar equipos disponibles"
                      />
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      {
                        availableAssetsList.filter((a) => {
                          const s = normalizeText(modalSearch.trim());
                          return (
                            !s ||
                            normalizeText(a.serialNumber).includes(s) ||
                            normalizeText(a.model || "").includes(s)
                          );
                        }).length
                      }{" "}
                      de {availableAssetsList.length} equipos disponibles
                    </span>
                  </div>

                  <div className="metric-breakdown-table-wrap">
                    <table className="metric-breakdown-table">
                      <thead>
                        <tr>
                          <th>Serie</th>
                          <th>Modelo</th>
                          <th>Fecha compra</th>
                          <th className="text-right">Valor estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableAssetsList
                          .filter((a) => {
                            const s = normalizeText(modalSearch.trim());
                            return (
                              !s ||
                              normalizeText(a.serialNumber).includes(s) ||
                              normalizeText(a.model || "").includes(s)
                            );
                          })
                          .map((a) => (
                            <tr key={a.id}>
                              <td>
                                <span className="flex items-center gap-1 font-mono font-semibold">
                                  {a.serialNumber}
                                  <CopyButton text={a.serialNumber} label={`Copiar serie ${a.serialNumber}`} />
                                </span>
                              </td>
                              <td>{a.model || "—"}</td>
                              <td className="font-mono text-slate-500">{a.purchaseDate || "—"}</td>
                              <td className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                <CurrencyDisplay usdAmount={a.estimatedValue ?? 0} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 8. MODAL EN MANTENIMIENTO */}
            {selectedMetric === "invMaintenance" && (
              <>
                <ModalKpiGrid
                  items={[
                    {
                      label: "En mantenimiento",
                      value: maintenanceAssetsList.length,
                      sub: "Equipos en taller",
                    },
                    {
                      label: "Valorización afectada",
                      value: <CurrencyDisplay usdAmount={maintenanceAssetsValue} />,
                      sub: "Activos fuera de servicio",
                    },
                    {
                      label: "% de la flota",
                      value: `${(
                        (maintenanceAssetsList.length / Math.max(1, assets.length)) *
                        100
                      ).toFixed(1)}%`,
                      sub: "En reparación",
                    },
                    {
                      label: "Órdenes abiertas",
                      value: maintenanceRecords.filter((r) => !r.endDate || r.endDate.trim() === "").length,
                      sub: "Intervenciones activas",
                    },
                  ]}
                />

                <div className="modal-chart-card">
                  <div className="modal-chart-title">
                    <span>Modelos con mayor volumen en mantenimiento</span>
                    <span className="font-mono text-xs font-bold text-amber-600">
                      {maintenanceAssetsList.length} equipos
                    </span>
                  </div>
                  <HorizontalBarChart
                    items={getTopModelsBarData(maintenanceAssetsList, "#f59e0b")}
                    maxCount={6}
                  />
                </div>

                <div>
                  <div className="modal-table-controls">
                    <label className="search-control">
                      <Search size={14} />
                      <input
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        placeholder="Buscar por serie, modelo o proveedor..."
                        aria-label="Buscar equipos en mantenimiento"
                      />
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      {
                        maintenanceAssetsList.filter((a) => {
                          const s = normalizeText(modalSearch.trim());
                          return (
                            !s ||
                            normalizeText(a.serialNumber).includes(s) ||
                            normalizeText(a.model || "").includes(s)
                          );
                        }).length
                      }{" "}
                      de {maintenanceAssetsList.length} equipos en taller
                    </span>
                  </div>

                  <div className="metric-breakdown-table-wrap">
                    <table className="metric-breakdown-table">
                      <thead>
                        <tr>
                          <th>Serie</th>
                          <th>Modelo</th>
                          <th>Motivo intervención</th>
                          <th>Proveedor</th>
                          <th>Fecha inicio</th>
                          <th className="text-right">Costo presupuestado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maintenanceAssetsList
                          .filter((a) => {
                            const s = normalizeText(modalSearch.trim());
                            return (
                              !s ||
                              normalizeText(a.serialNumber).includes(s) ||
                              normalizeText(a.model || "").includes(s)
                            );
                          })
                          .map((a) => {
                            const rec = maintenanceRecords.find(
                              (r) => r.asset?.id === a.id || r.asset?.serialNumber === a.serialNumber
                            );
                            return (
                              <tr key={a.id}>
                                <td>
                                  <span className="flex items-center gap-1 font-mono font-semibold">
                                    {a.serialNumber}
                                    <CopyButton text={a.serialNumber} label={`Copiar serie ${a.serialNumber}`} />
                                  </span>
                                </td>
                                <td>{a.model || "—"}</td>
                                <td className="max-w-xs truncate" title={rec?.reason || ""}>
                                  {rec?.reason || "Mantenimiento preventivo / correctivo"}
                                </td>
                                <td>{rec?.providerName || "Interno / Taller"}</td>
                                <td className="font-mono text-slate-500">
                                  {rec?.startDate ? rec.startDate.split("T")[0] : a.purchaseDate || "—"}
                                </td>
                                <td className="text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                                  <CurrencyDisplay usdAmount={rec?.cost ?? 0} />
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 9. MODAL PERDIDOS */}
            {selectedMetric === "invLost" && (
              <>
                <ModalKpiGrid
                  items={[
                    {
                      label: "Equipos perdidos",
                      value: lostAssetsList.length,
                      sub: "Declarados en merma",
                    },
                    {
                      label: "Valor patrimonial perdido",
                      value: <CurrencyDisplay usdAmount={lostAssetsValue} />,
                      sub: "Pérdida en inventario",
                    },
                    {
                      label: "% de la flota",
                      value: `${((lostAssetsList.length / Math.max(1, assets.length)) * 100).toFixed(1)}%`,
                      sub: "Tasa de merma",
                    },
                    {
                      label: "Modelo más afectado",
                      value: getTopModelsBarData(lostAssetsList, "#ef4444")[0]?.label || "—",
                      sub: getTopModelsBarData(lostAssetsList, "#ef4444")[0]?.formattedValue || "0 unidades",
                    },
                  ]}
                />

                <div className="modal-chart-card">
                  <div className="modal-chart-title">
                    <span>Modelos con mayor volumen de pérdida</span>
                    <span className="font-mono text-xs font-bold text-rose-600">
                      {lostAssetsList.length} equipos
                    </span>
                  </div>
                  <HorizontalBarChart
                    items={getTopModelsBarData(lostAssetsList, "#ef4444")}
                    maxCount={6}
                  />
                </div>

                <div>
                  <div className="modal-table-controls">
                    <label className="search-control">
                      <Search size={14} />
                      <input
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        placeholder="Buscar por serie o modelo..."
                        aria-label="Buscar equipos perdidos"
                      />
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      {
                        lostAssetsList.filter((a) => {
                          const s = normalizeText(modalSearch.trim());
                          return (
                            !s ||
                            normalizeText(a.serialNumber).includes(s) ||
                            normalizeText(a.model || "").includes(s)
                          );
                        }).length
                      }{" "}
                      de {lostAssetsList.length} equipos perdidos
                    </span>
                  </div>

                  <div className="metric-breakdown-table-wrap">
                    <table className="metric-breakdown-table">
                      <thead>
                        <tr>
                          <th>Serie</th>
                          <th>Modelo</th>
                          <th>Fecha reporte / compra</th>
                          <th>Observaciones</th>
                          <th className="text-right">Valor estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lostAssetsList
                          .filter((a) => {
                            const s = normalizeText(modalSearch.trim());
                            return (
                              !s ||
                              normalizeText(a.serialNumber).includes(s) ||
                              normalizeText(a.model || "").includes(s)
                            );
                          })
                          .map((a) => {
                            const report = lostReports.find(
                              (r) => r.asset?.id === a.id || r.asset?.serialNumber === a.serialNumber
                            );
                            return (
                              <tr key={a.id}>
                                <td>
                                  <span className="flex items-center gap-1 font-mono font-semibold">
                                    {a.serialNumber}
                                    <CopyButton text={a.serialNumber} label={`Copiar serie ${a.serialNumber}`} />
                                  </span>
                                </td>
                                <td>{a.model || "—"}</td>
                                <td className="font-mono text-slate-500">
                                  {report?.reportedAt ? report.reportedAt.split("T")[0] : a.purchaseDate || "—"}
                                </td>
                                <td className="max-w-xs truncate" title={report?.notes || ""}>
                                  {report?.notes || "Equipo declarado como perdido o dado de baja"}
                                </td>
                                <td className="text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                                  <CurrencyDisplay usdAmount={a.estimatedValue ?? 0} />
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setSelectedMetric(null)}>
                Cerrar reporte
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ========================================================================
          MODAL DESGLOSE POR MODELO DE FLOTA
          ======================================================================== */}

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
                className={`model-breakdown-kpi available clickable ${
                  modelDetailStatus === "AVAILABLE" ? "active-filter" : ""
                }`}
                onClick={() => setModelDetailStatus((curr) => (curr === "AVAILABLE" ? "ALL" : "AVAILABLE"))}
                title="Filtrar por disponibles"
              >
                <span className="work-eyebrow !text-emerald-700 dark:!text-emerald-400">DISPONIBLES</span>
                <strong className="telemetry-value font-mono">{selectedModelData.available}</strong>
                <small className="text-[10px] text-emerald-800 dark:text-emerald-300">En bodega para préstamo</small>
              </button>
              <button
                type="button"
                className={`model-breakdown-kpi loaned clickable ${
                  modelDetailStatus === "LOANED" ? "active-filter" : ""
                }`}
                onClick={() => setModelDetailStatus((curr) => (curr === "LOANED" ? "ALL" : "LOANED"))}
                title="Filtrar por en préstamo"
              >
                <span className="work-eyebrow !text-blue-700 dark:!text-blue-400">EN PRÉSTAMO</span>
                <strong className="telemetry-value font-mono">{selectedModelData.onLoan}</strong>
                <small className="text-[10px] text-blue-800 dark:text-blue-300">Asignados a técnicos</small>
              </button>
              <button
                type="button"
                className={`model-breakdown-kpi maintenance clickable ${
                  modelDetailStatus === "UNDER_MAINTENANCE" ? "active-filter" : ""
                }`}
                onClick={() =>
                  setModelDetailStatus((curr) => (curr === "UNDER_MAINTENANCE" ? "ALL" : "UNDER_MAINTENANCE"))
                }
                title="Filtrar por en mantenimiento"
              >
                <span className="work-eyebrow !text-amber-700 dark:!text-amber-400">EN MANTENIMIENTO</span>
                <strong className="telemetry-value font-mono">{selectedModelData.inMaintenance}</strong>
                <small className="text-[10px] text-amber-800 dark:text-amber-300">En orden técnica activa</small>
              </button>
              <button
                type="button"
                className={`model-breakdown-kpi lost clickable ${
                  modelDetailStatus === "LOST" ? "active-filter" : ""
                }`}
                onClick={() => setModelDetailStatus((curr) => (curr === "LOST" ? "ALL" : "LOST"))}
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
