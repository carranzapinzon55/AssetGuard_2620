"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CalendarDays, PackageCheck, RotateCcw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useCurrency } from "@/components/currency-provider";
import { Button, EmptyState, Feedback, FormField, LoadingRows, PageTitle, TextInput } from "@/components/workspace/ui";
import { DASHBOARD_QUERY } from "@/lib/operations";
import { errorMessage, queryGraphQL } from "@/lib/workspace";

type Metrics = { estimatedLossValue: number; onTimeReturnPercentage: number; assetsCurrentlyInField: number };
type MetricsResult = { dashboardMetrics: Metrics };

export function DashboardPage() {
  const { session } = useAuth();
  const { formatMoney } = useCurrency();
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedRange, setAppliedRange] = useState({ startDate: "", endDate: "" });
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

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

  const money = metrics ? formatMoney(metrics.estimatedLossValue) : "—";
  const punctuality = metrics ? Math.max(0, Math.min(100, metrics.onTimeReturnPercentage)) : 0;

  return (
    <div className="work-page">
      <PageTitle eyebrow="GLOBALNET · RESUMEN EJECUTIVO" title="Panel de control de activos" description="Salud financiera y operativa de la flota de activos." />
      <Feedback error={error} />
      <section className="work-section dashboard-filters"><div className="filter-heading"><CalendarDays size={16} /><strong>Periodo de devoluciones</strong><span>Las existencias en campo muestran el estado actual.</span></div><div className="date-filter-controls"><FormField label="Desde"><TextInput type="date" max={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></FormField><FormField label="Hasta"><TextInput type="date" min={today} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></FormField><Button onClick={() => setAppliedRange({ startDate, endDate })}><Activity size={15} /> Aplicar periodo</Button><Button variant="quiet" onClick={() => { setStartDate(""); setEndDate(""); setAppliedRange({ startDate: "", endDate: "" }); setRefresh((value) => value + 1); }}><RotateCcw size={15} /> Limpiar</Button></div></section>
      {loading ? <LoadingRows label="Calculando métricas" /> : !metrics ? <EmptyState title="No hay métricas disponibles" detail="No se encontraron datos para el periodo seleccionado." /> : <>
        <section className="metric-grid">
          <article className="metric-panel loss"><div className="metric-panel-top"><span className="metric-icon"><AlertTriangle size={17} /></span><span className="work-eyebrow">MERMAS · PERIODO</span></div><strong className="metric-value">{money}</strong><p>Valor estimado de equipos dañados o perdidos.</p><div className="metric-foot"><span>ACTIVOS DAÑADOS + PERDIDOS</span></div></article>
          <article className="metric-panel"><div className="metric-panel-top"><span className="metric-icon"><RotateCcw size={17} /></span><span className="work-eyebrow">PUNTUALIDAD · PERIODO</span></div><strong className="metric-value">{punctuality.toFixed(1)}<small>%</small></strong><p>Préstamos devueltos en o antes de su vencimiento.</p><div className="metric-progress"><span style={{ width: `${punctuality}%` }} /></div><div className="metric-foot"><span>DEVOLUCIONES A TIEMPO</span><strong>{punctuality.toFixed(0)}%</strong></div></article>
          <article className="metric-panel field"><div className="metric-panel-top"><span className="metric-icon"><PackageCheck size={17} /></span><span className="work-eyebrow">CUSTODIA · ACTUAL</span></div><strong className="metric-value">{metrics.assetsCurrentlyInField}</strong><p>Activos actualmente asignados en préstamo.</p><div className="metric-foot"><span>ESTADO ACTUAL DE LA FLOTA</span></div></article>
        </section>
        <section className="dashboard-detail-band"><div><span className="work-eyebrow">INDICADOR DE ENTREGA</span><h2>Devoluciones puntuales</h2><p>Porcentaje calculado sobre préstamos cerrados en el periodo seleccionado.</p></div><div className="delivery-visual"><div className="delivery-value">{punctuality.toFixed(0)}<small>%</small></div><div className="delivery-bars"><span style={{ height: `${Math.max(4, punctuality)}%` }} /><span style={{ height: `${Math.max(4, 100 - punctuality)}%` }} /></div><div className="delivery-legend"><span><i className="legend-good" /> A tiempo</span><span><i className="legend-late" /> Fuera de plazo</span></div></div></section>
      </>}
    </div>
  );
}