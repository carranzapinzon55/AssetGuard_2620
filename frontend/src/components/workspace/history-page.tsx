"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Search } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { DataTable, EmptyState, Feedback, LoadingRows, PageTitle, SelectInput, StatusTag } from "@/components/workspace/ui";
import { MY_LOAN_HISTORY } from "@/lib/operations";
import { errorMessage, queryGraphQL, type LoanItem } from "@/lib/workspace";

type HistoryResult = { myLoanHistory: LoanItem[] };

export function HistoryPage() {
  const { session } = useAuth();
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    queryGraphQL<HistoryResult>(MY_LOAN_HISTORY)
      .then((result) => { if (active) setLoans(result.myLoanHistory); })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token]);

  const filtered = useMemo(() => loans.filter((loan) => {
    const matchesText = `${loan.asset.serialNumber} ${loan.asset.model ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const current = loan.status === "APPROVED" || loan.status === "PENDING";
    const matchesView = view === "ALL" || (view === "CURRENT" ? current : !current);
    return matchesText && matchesView;
  }), [loans, query, view]);

  return (
    <div className="work-page">
      <PageTitle eyebrow="CUSTODIAS · TÉCNICO" title="Mis custodias" description="Historial personal de solicitudes, entregas y devoluciones vinculadas a tu cuenta." />
      <Feedback error={error} />
      <section className="work-section"><div className="section-toolbar"><div className="toolbar-title"><Activity size={17} /><strong>Movimientos personales</strong><span>{filtered.length}</span></div><div className="toolbar-controls"><label className="search-control"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar activo" aria-label="Buscar activo" /></label><SelectInput className="filter-select" value={view} onChange={(event) => setView(event.target.value)} aria-label="Filtrar movimientos"><option value="ALL">Todos</option><option value="CURRENT">Activos</option><option value="CLOSED">Cerrados</option></SelectInput></div></div>
        {loading ? <LoadingRows label="Cargando historial" /> : filtered.length === 0 ? <EmptyState title="Sin custodias" detail="No se encontraron movimientos para estos filtros." /> : <DataTable headings={["Activo", "Solicitud", "Vencimiento", "Devolución", "Días de mora", "Condición", "Estado"]}>{filtered.map((loan) => <tr key={loan.id}><td><span className="table-primary mono-cell">{loan.asset.serialNumber}</span><small className="table-secondary">{loan.asset.model || "Activo"}</small></td><td>{loan.requestDate?.slice(0, 10) ?? "—"}</td><td>{loan.dueLocalDate ?? "—"}</td><td>{loan.returnDateTime?.slice(0, 10) ?? "—"}</td><td>{loan.delayDays != null ? <span className={loan.delayDays > 0 ? "overdue-copy" : ""}>{loan.delayDays}</span> : "—"}</td><td>{loan.returnCondition ?? "—"}</td><td><StatusTag value={loan.status} /></td></tr>)}</DataTable>}
      </section>
    </div>
  );
}