"use client";

import { useEffect, useState, type PointerEvent } from "react";
import { Activity, AlertTriangle, CalendarDays, PackageCheck, RotateCcw, Wrench } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, CurrencyDisplay, Dialog, EmptyState, Feedback, FormField, InsightCard, LoadingRows, PageTitle, TextInput } from "@/components/workspace/ui";
import { DASHBOARD_QUERY } from "@/lib/operations";
import { errorMessage, queryGraphQL } from "@/lib/workspace";

type Metrics = {
  estimatedLossValue: number;
  maintenanceCostsValue: number;
  onTimeReturnPercentage: number;
  assetsCurrentlyInField: number;
  totalAssets: number;
  availableAssets: number;
  assetsUnderMaintenance: number;
  lostAssets: number;
  assetsByModel: Array<{ model: string; total: number; available: number }>;
};
type MetricsResult = { dashboardMetrics: Metrics };
type MetricKey = "loss" | "maintenance" | "onTime" | "inField";

export function DashboardPage() {
  const { session } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedRange, setAppliedRange] = useState({ startDate: "", endDate: "" });
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);

  useEffect(() => {
    let active = true;
    queryGraphQL<MetricsResult>(DASHBOARD_QUERY, {
      startDate: appliedRange.startDate || null,
      endDate: appliedRange.endDate || null,
    })
      .then((result) => { if (active) { setMetrics(result.dashboardMetrics); setError(""); } })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token, refresh, appliedRange]);

  const punctuality = metrics ? Math.max(0, Math.min(100, metrics.onTimeReturnPercentage)) : 0;
  const metricDetails = selectedMetric ? {
    loss: {
      eyebrow: "MERMAS · PERIODO",
      title: "Mermas por pérdida o daño",
      value: metrics ? <CurrencyDisplay usdAmount={metrics.estimatedLossValue} /> : "—",
      summary: "Valor estimado de activos reportados como perdidos o dañados en el periodo.",
      note: "El rango aplicado filtra las devoluciones por su fecha de registro; sin rango, muestra el total histórico de activos marcados como perdidos o dañados.",
    },
    maintenance: {
      eyebrow: "MANTENIMIENTO · PERIODO",
      title: "Gastos de mantenimiento",
      value: metrics ? <CurrencyDisplay usdAmount={metrics.maintenanceCostsValue} /> : "—",
      summary: "Suma de los costos registrados en órdenes de mantenimiento.",
      note: "El rango aplicado filtra los costos por la fecha de inicio de la intervención; sin rango, muestra el total histórico registrado.",
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
      <PageTitle eyebrow="GLOBALNET · RESUMEN EJECUTIVO" title="Panel de control de activos" description="Salud financiera y operativa de la flota de activos." />
      <Feedback error={error} />
      <section className="work-section dashboard-filters"><div className="filter-heading"><CalendarDays size={16} /><strong>Periodo de devoluciones</strong><span>Las existencias en campo muestran el estado actual.</span></div><div className="date-filter-controls"><FormField label="Desde"><TextInput type="date" max={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></FormField><FormField label="Hasta"><TextInput type="date" min={today} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></FormField><Button onClick={() => setAppliedRange({ startDate, endDate })}><Activity size={15} /> Aplicar periodo</Button><Button variant="quiet" onClick={() => { setStartDate(""); setEndDate(""); setAppliedRange({ startDate: "", endDate: "" }); setRefresh((value) => value + 1); }}><RotateCcw size={15} /> Limpiar</Button></div></section>
      {loading ? <LoadingRows label="Calculando métricas" /> : !metrics ? <EmptyState title="No hay métricas disponibles" detail="No se encontraron datos para el periodo seleccionado." /> : <>
        <section className="metric-grid">
          <button type="button" className="metric-panel loss" aria-label="Ver detalle de mermas por pérdida o daño" aria-haspopup="dialog" onClick={() => setSelectedMetric("loss")} onPointerMove={updateMetricSpotlight}><div className="metric-panel-top"><span className="metric-icon"><AlertTriangle size={17} /></span><span className="work-eyebrow">MERMAS · PERIODO</span></div><strong className="metric-value telemetry-value"><CurrencyDisplay usdAmount={metrics.estimatedLossValue} /></strong><p>Valor estimado de activos perdidos o dañados.</p><div className="metric-signal" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="metric-foot"><span>PÉRDIDA + DAÑO</span><span>VER DESGLOSE <span aria-hidden="true">↗</span></span></div></button>
          <button type="button" className="metric-panel maintenance-cost" aria-label="Ver detalle de gastos de mantenimiento" aria-haspopup="dialog" onClick={() => setSelectedMetric("maintenance")} onPointerMove={updateMetricSpotlight}><div className="metric-panel-top"><span className="metric-icon"><Wrench size={17} /></span><span className="work-eyebrow">MANTENIMIENTO · PERIODO</span></div><strong className="metric-value telemetry-value"><CurrencyDisplay usdAmount={metrics.maintenanceCostsValue} /></strong><p>Costos registrados en órdenes de mantenimiento.</p><div className="metric-signal field-signal" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="metric-foot"><span>COSTOS DE INTERVENCIÓN</span><span>VER DESGLOSE <span aria-hidden="true">↗</span></span></div></button>
          <button type="button" className="metric-panel" aria-label="Ver detalle de devoluciones puntuales" aria-haspopup="dialog" onClick={() => setSelectedMetric("onTime")} onPointerMove={updateMetricSpotlight}><div className="metric-panel-top"><span className="metric-icon"><RotateCcw size={17} /></span><span className="work-eyebrow">PUNTUALIDAD · PERIODO</span></div><strong className="metric-value telemetry-value">{punctuality.toFixed(1)}<small>%</small></strong><p>Préstamos devueltos en o antes de su vencimiento.</p><div className="metric-progress"><span style={{ width: `${punctuality}%` }} /></div><div className="metric-foot"><span>DEVOLUCIONES A TIEMPO</span><strong className="telemetry-value">{punctuality.toFixed(0)}%</strong></div></button>
          <button type="button" className="metric-panel field" aria-label="Ver detalle de activos actualmente en campo" aria-haspopup="dialog" onClick={() => setSelectedMetric("inField")} onPointerMove={updateMetricSpotlight}><div className="metric-panel-top"><span className="metric-icon"><PackageCheck size={17} /></span><span className="work-eyebrow">CUSTODIA · ACTUAL</span></div><strong className="metric-value telemetry-value">{metrics.assetsCurrentlyInField}</strong><p>Activos actualmente asignados en préstamo.</p><div className="metric-signal field-signal" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="metric-foot"><span>ESTADO ACTUAL DE LA FLOTA</span><span>VER DETALLE <span aria-hidden="true">↗</span></span></div></button>
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
            <div><span className="work-eyebrow">DISPONIBILIDAD POR MODELO</span><p>Equipos disponibles frente al total registrado por modelo.</p></div>
            {metrics.assetsByModel.length === 0 ? <span className="model-availability-empty">No hay modelos registrados.</span> : <ul>{metrics.assetsByModel.map((item) => (
              <li key={item.model}>
                <span className="model-availability-name">{item.model}</span>
                <span className="model-availability-track" aria-hidden="true"><i style={{ width: `${item.total ? (item.available / item.total) * 100 : 0}%` }} /></span>
                <span className="model-availability-count telemetry-value">{item.available}/{item.total}</span>
              </li>
            ))}</ul>}
          </div>
        </section>
        <section className="dashboard-detail-band"><div><span className="work-eyebrow">INDICADOR DE ENTREGA</span><h2>Devoluciones puntuales</h2><p>Porcentaje calculado sobre préstamos cerrados en el periodo seleccionado.</p></div><div className="delivery-visual"><div className="delivery-value">{punctuality.toFixed(0)}<small>%</small></div><div className="delivery-bars"><span style={{ height: `${Math.max(4, punctuality)}%` }} /><span style={{ height: `${Math.max(4, 100 - punctuality)}%` }} /></div><div className="delivery-legend"><span><i className="legend-good" /> A tiempo</span><span><i className="legend-late" /> Fuera de plazo</span></div></div></section>
      </>}
      {metricDetails && <Dialog open title={metricDetails.title} eyebrow={metricDetails.eyebrow} onClose={() => setSelectedMetric(null)}>
        <div className="metric-detail">
          <strong className="metric-detail-value telemetry-value">{metricDetails.value}</strong>
          <p>{metricDetails.summary}</p>
          {selectedMetric === "onTime" && <div className="metric-progress detail-progress"><span style={{ width: `${punctuality}%` }} /></div>}
          <div className="metric-detail-note"><span className="work-eyebrow">LECTURA DEL INDICADOR</span><p>{metricDetails.note}</p></div>
        </div>
      </Dialog>}
    </div>
  );
}