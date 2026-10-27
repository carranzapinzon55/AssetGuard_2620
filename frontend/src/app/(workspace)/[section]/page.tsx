import { notFound } from "next/navigation";

const sections: Record<string, { title: string; eyebrow: string; description: string }> = {
  assets: { title: "Activos", eyebrow: "INVENTARIO", description: "Consulta y gestiona los activos registrados en GlobalNet." },
  loans: { title: "Préstamos", eyebrow: "CUSTODIAS", description: "Solicitudes, aprobaciones y devoluciones de activos." },
  history: { title: "Mi historial", eyebrow: "CUSTODIA PERSONAL", description: "Movimientos asociados a tu cuenta de técnico." },
  audit: { title: "Auditoría", eyebrow: "TRAZABILIDAD GLOBAL", description: "Movimientos de custodia con filtros por activo, técnico y fecha." },
  metrics: { title: "Indicadores", eyebrow: "DASHBOARD", description: "Métricas financieras, devoluciones y activos en campo." },
};

export default async function SectionPage({ params }: PageProps<"/[section]">) {
  const { section } = await params;
  const content = sections[section];
  if (!content) notFound();

  return (
    <section className="module-page">
      <div className="page-heading"><div><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p className="page-subtitle">{content.description}</p></div></div>
      <div className="module-empty-state"><span className="empty-rule" /><p className="eyebrow">MÓDULO</p><h2>{content.title}</h2><p>El espacio está listo para conectar las operaciones de este módulo.</p></div>
    </section>
  );
}