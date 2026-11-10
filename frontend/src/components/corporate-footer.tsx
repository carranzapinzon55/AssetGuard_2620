"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useEscapeKey, useModalFocus } from "@/components/workspace/ui";

type Notice = "privacy" | "custody";

const notices: Record<Notice, { title: string; description: string }> = {
  privacy: {
    title: "Aviso de Privacidad Interno",
    description: "Los registros de auditoría y accesos de AssetGuard se tratan estrictamente para el control operativo y la seguridad de los activos y de la plataforma.",
  },
  custody: {
    title: "Términos de Custodia de Activos",
    description: "El personal al que se asigne equipamiento tecnológico es responsable de su cuidado, uso adecuado y devolución de acuerdo con la normativa interna de GlobalNet Telecom.",
  },
};

export function CorporateFooter({ className = "" }: { className?: string }) {
  const [activeNotice, setActiveNotice] = useState<Notice | null>(null);
  const dialogRef = useModalFocus(activeNotice !== null);

  useEscapeKey(activeNotice !== null, () => setActiveNotice(null));

  function openNotice(notice: Notice, trigger: HTMLButtonElement) {
    trigger.focus();
    setActiveNotice(notice);
  }

  const notice = activeNotice ? notices[activeNotice] : null;

  return (
    <>
      <footer className={`corporate-footer ${className}`.trim()}>
        <p>© 2026 GlobalNet Telecom · AssetGuard 2620 · Sistema de Control de Activos</p>
        <nav aria-label="Información institucional">
          <button type="button" onClick={(event) => openNotice("privacy", event.currentTarget)}>Aviso de Privacidad Interno</button>
          <button type="button" onClick={(event) => openNotice("custody", event.currentTarget)}>Términos de Custodia de Activos</button>
        </nav>
      </footer>
      {notice && <div className="modal-backdrop legal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setActiveNotice(null);
      }}>
        <section ref={dialogRef} className="work-modal legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-notice-title" tabIndex={-1}>
          <div className="modal-heading">
            <div><p className="work-eyebrow">GLOBALNET TELECOM · ASSETGUARD 2620</p><h2 id="legal-notice-title">{notice.title}</h2></div>
            <button type="button" className="table-action" title="Cerrar aviso" aria-label="Cerrar aviso" onClick={() => setActiveNotice(null)}><X size={17} /></button>
          </div>
          <p className="legal-notice-copy">{notice.description}</p>
        </section>
      </div>}
    </>
  );
}
