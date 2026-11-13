"use client";

import { useEffect, useState, type PointerEvent } from "react";
import { Activity, AlertTriangle, CalendarDays, PackageCheck, RotateCcw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useCurrency } from "@/components/currency-provider";
import { Button, Dialog, EmptyState, Feedback, FormField, LoadingRows, PageTitle, TextInput } from "@/components/workspace/ui";
import { DASHBOARD_QUERY } from "@/lib/operations";
import { formatCurrency } from "@/lib/utils";
import { errorMessage, queryGraphQL } from "@/lib/workspace";

type Metrics = { estimatedLossValue: number; onTimeReturnPercentage: number; assetsCurrentlyInField: number };
type MetricsResult = { dashboardMetrics: Metrics };
type MetricKey = "loss" | "onTime" | "inField";

export function DashboardPage() {
  const { session } = useAuth();
  const { currency, convertFromUsd } = useCurrency();
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

  const money = metrics
    ? formatCurrency(convertFromUsd(metrics.estimatedLossValue, currency), currency)
    : "—";
  const punctuality = metrics ? Math.max(0, Math.min(100, metrics.onTimeReturnPercentage)) : 0;
  const metricDetails = selectedMetric ? {
    loss: {
      eyebrow: "MERMAS · PERIODO",
      title: "Valor de activos dañados o perdidos",
      value: money,
      summary: "Estimación monetaria asociada a las mermas registradas dentro del periodo consultado.",
      note: "El rango de fechas aplicado al panel determina el periodo de devoluciones incluido.",
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
          <button type="button" className="metric-panel loss" aria-label="Ver detalle de mermas del periodo" aria-haspopup="dialog" onClick={() => setSelectedMetric("loss")} onPointerMove={updateMetricSpotlight}><div className="metric-panel-top"><span className="metric-icon"><AlertTriangle size={17} /></span><span className="work-eyebrow">MERMAS · PERIODO</span></div><strong className="metric-value telemetry-value">{money}</strong><p>Valor estimado de equipos dañados o perdidos.</p><div className="metric-signal" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="metric-foot"><span>ACTIVOS DAÑADOS + PERDIDOS</span><span>VER DESGLOSE <span aria-hidden="true">↗</span></span></div></button>
          <button type="button" className="metric-panel" aria-label="Ver detalle de devoluciones puntuales" aria-haspopup="dialog" onClick={() => setSelectedMetric("onTime")} onPointerMove={updateMetricSpotlight}><div className="metric-panel-top"><span className="metric-icon"><RotateCcw size={17} /></span><span className="work-eyebrow">PUNTUALIDAD · PERIODO</span></div><strong className="metric-value telemetry-value">{punctuality.toFixed(1)}<small>%</small></strong><p>Préstamos devueltos en o antes de su vencimiento.</p><div className="metric-progress"><span style={{ width: `${punctuality}%` }} /></div><div className="metric-foot"><span>DEVOLUCIONES A TIEMPO</span><strong className="telemetry-value">{punctuality.toFixed(0)}%</strong></div></button>
          <button type="button" className="metric-panel field" aria-label="Ver detalle de activos actualmente en campo" aria-haspopup="dialog" onClick={() => setSelectedMetric("inField")} onPointerMove={updateMetricSpotlight}><div className="metric-panel-top"><span className="metric-icon"><PackageCheck size={17} /></span><span className="work-eyebrow">CUSTODIA · ACTUAL</span></div><strong className="metric-value telemetry-value">{metrics.assetsCurrentlyInField}</strong><p>Activos actualmente asignados en préstamo.</p><div className="metric-signal field-signal" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="metric-foot"><span>ESTADO ACTUAL DE LA FLOTA</span><span>VER DETALLE <span aria-hidden="true">↗</span></span></div></button>
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