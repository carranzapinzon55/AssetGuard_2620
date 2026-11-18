"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock, Search, ShieldAlert, UserCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, Dialog, EmptyState, Feedback, LoadingRows } from "@/components/workspace/ui";
import { ACKNOWLEDGE_LOST_REPORT, LOST_ASSET_REPORTS_QUERY } from "@/lib/operations";
import { errorMessage, queryGraphQL, type LostAssetReportItem } from "@/lib/workspace";

function formatReportDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(date);
  } catch {
    return dateString;
  }
}

export function useLostReports() {
  const { session } = useAuth();
  const [reports, setReports] = useState<LostAssetReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canAccess = session?.user.role === "ADMIN" || session?.user.role === "INSPECTOR";

  const fetchReports = useCallback(async () => {
    if (!canAccess) return;
    try {
      setLoading(true);
      setError("");
      const result = await queryGraphQL<{ lostAssetReports: LostAssetReportItem[] }>(
        LOST_ASSET_REPORTS_QUERY
      );
      setReports(result.lostAssetReports || []);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [canAccess]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    function handleUpdate() {
      fetchReports();
    }
    window.addEventListener("lost-reports-updated", handleUpdate);
    return () => window.removeEventListener("lost-reports-updated", handleUpdate);
  }, [fetchReports]);

  const unacknowledgedCount = reports.filter((r) => !r.acknowledged).length;

  return {
    reports,
    unacknowledgedCount,
    loading,
    error,
    refetch: fetchReports,
    canAccess,
  };
}

export function LostReportsModal({
  open,
  onClose,
  reports,
  loading,
  error,
  onReportAcknowledged,
}: {
  open: boolean;
  onClose: () => void;
  reports: LostAssetReportItem[];
  loading: boolean;
  error?: string;
  onReportAcknowledged?: () => void;
}) {
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [search, setSearch] = useState("");

  async function handleAcknowledge(id: string) {
    try {
      setAcknowledgingId(id);
      setLocalError("");
      await queryGraphQL<{ acknowledgeLostAssetReport: { id: string; acknowledged: boolean } }>(
        ACKNOWLEDGE_LOST_REPORT,
        { id }
      );
      window.dispatchEvent(new CustomEvent("lost-reports-updated"));
      if (onReportAcknowledged) {
        onReportAcknowledged();
      }
    } catch (err: unknown) {
      setLocalError(errorMessage(err));
    } finally {
      setAcknowledgingId(null);
    }
  }

  const filtered = reports.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const serial = r.asset?.serialNumber?.toLowerCase() || "";
    const model = r.asset?.model?.toLowerCase() || "";
    const user = (r.reportedByUser?.fullName || r.reportedByUser?.email || "").toLowerCase();
    const notes = (r.notes || "").toLowerCase();
    return serial.includes(q) || model.includes(q) || user.includes(q) || notes.includes(q);
  });

  return (
    <Dialog
      open={open}
      title="Equipos reportados como perdidos"
      eyebrow="AUDITORÍA · ALERTAS DE PÉRDIDAS"
      onClose={onClose}
    >
      <div className="space-y-4 pt-1">
        <Feedback error={localError || error} />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registro de activos declarados en pérdida con trazabilidad de custodio, fecha exacta y notas.
          </p>
          <div className="search-control !w-60">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar en reportes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar en reportes de pérdida"
            />
          </div>
        </div>

        {loading ? (
          <LoadingRows label="Cargando reportes de pérdida" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Sin reportes de pérdida"
            detail={
              search
                ? "No se encontraron reportes que coincidan con la búsqueda."
                : "No existen activos registrados con reporte formal de pérdida pendiente."
            }
          />
        ) : (
          <div className="max-h-[min(65vh,520px)] overflow-y-auto space-y-3 pr-1">
            {filtered.map((report) => (
              <div
                key={report.id}
                className={`rounded-lg border p-4 transition-colors ${
                  report.acknowledged
                    ? "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50 opacity-80"
                    : "border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/20 shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                        {report.asset?.serialNumber || "SIN SERIAL"}
                      </span>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {report.asset?.model || "Modelo no especificado"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          report.acknowledged
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        }`}
                      >
                        {report.acknowledged ? "Revisado" : "Pendiente de revisión"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <UserCheck size={13} className="text-slate-400" />
                        <strong>Responsable:</strong>{" "}
                        {report.reportedByUser?.fullName || report.reportedByUser?.email || "Sin usuario asignado"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={13} className="text-slate-400" />
                        <strong>Fecha y hora:</strong> {formatReportDate(report.reportedAt)}
                      </span>
                    </div>
                  </div>

                  {!report.acknowledged && (
                    <Button
                      variant="quiet"
                      loading={acknowledgingId === report.id}
                      onClick={() => handleAcknowledge(report.id)}
                      className="!text-xs !py-1 !px-3 shrink-0 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600"
                    >
                      <CheckCircle2 size={14} className="mr-1 inline text-emerald-600 dark:text-emerald-400" />
                      Marcar revisado
                    </Button>
                  )}
                </div>

                {report.notes && (
                  <div className="mt-3 rounded border border-slate-200/80 bg-white/80 p-2.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
                    <strong className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                      Observación / Trazabilidad:
                    </strong>
                    <p className="whitespace-pre-wrap">{report.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function LostReportsBell() {
  const { reports, unacknowledgedCount, loading, error, refetch, canAccess } = useLostReports();
  const [modalOpen, setModalOpen] = useState(false);

  if (!canAccess) return null;

  return (
    <>
      <button
        type="button"
        className="workspace-tool-button alert-bell relative transition-all"
        onClick={() => setModalOpen(true)}
        aria-label={`Alertas de equipos perdidos (${unacknowledgedCount} pendientes)`}
        title={`Alertas de equipos perdidos (${unacknowledgedCount} pendientes)`}
      >
        <Bell size={15} className={unacknowledgedCount > 0 ? "text-rose-600 dark:text-rose-400 animate-pulse" : ""} />
        {unacknowledgedCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
            {unacknowledgedCount}
          </span>
        )}
      </button>

      <LostReportsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        reports={reports}
        loading={loading}
        error={error}
        onReportAcknowledged={refetch}
      />
    </>
  );
}

export function LostReportsBanner() {
  const { reports, unacknowledgedCount, loading, error, refetch, canAccess } = useLostReports();
  const [modalOpen, setModalOpen] = useState(false);

  if (!canAccess || unacknowledgedCount === 0) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-300/80 bg-rose-50/90 px-4 py-3 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 shadow-sm mb-4">
        <div className="flex items-center gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
            <ShieldAlert size={18} />
          </div>
          <div>
            <strong className="block text-xs font-semibold leading-tight">
              {unacknowledgedCount === 1
                ? "1 equipo reportado como perdido pendiente de revisión"
                : `${unacknowledgedCount} equipos reportados como perdidos pendientes de revisión`}
            </strong>
            <span className="text-[11px] text-rose-700 dark:text-rose-300/80">
              Requieren validación formal por Inspector o Administrador.
            </span>
          </div>
        </div>
        <Button
          variant="quiet"
          onClick={() => setModalOpen(true)}
          className="!text-xs !py-1 !px-3 shrink-0 !bg-white/80 hover:!bg-white text-rose-900 border border-rose-200 dark:!bg-slate-900 dark:border-rose-900 dark:text-rose-200"
        >
          Revisar reportes ({unacknowledgedCount})
        </Button>
      </div>

      <LostReportsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        reports={reports}
        loading={loading}
        error={error}
        onReportAcknowledged={refetch}
      />
    </>
  );
}
