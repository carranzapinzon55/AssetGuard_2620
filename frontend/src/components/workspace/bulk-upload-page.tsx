"use client";

import { useState, type ChangeEvent } from "react";
import { CheckCircle2, FileSpreadsheet, FileUp, FileWarning, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useCurrency } from "@/components/currency-provider";
import { Button, DataTable, Feedback, PageTitle, StatusTag } from "@/components/workspace/ui";
import { UPLOAD_ASSETS } from "@/lib/operations";
import { errorMessage, queryGraphQL, type AssetItem } from "@/lib/workspace";

type UploadResult = { uploadAssetsBulk: { importedCount: number; assets: AssetItem[] } };

function fileToBase64(file: File, onProgress: (progress: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("No se pudo procesar el archivo."));
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function BulkUploadPage() {
  const { session } = useAuth();
  const { formatMoney } = useCurrency();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<"reading" | "sending" | "complete" | null>(null);
  const [result, setResult] = useState<UploadResult["uploadAssetsBulk"] | null>(null);
  const [error, setError] = useState("");

  function chooseFile(nextFile?: File) {
    setError(""); setResult(null);
    setUploadStage(null); setReadProgress(0);
    if (!nextFile) return;
    const extension = nextFile.name.toLowerCase().split(".").pop();
    if (extension !== "csv" && extension !== "xlsx") {
      setFile(null); setError("Formato no compatible. Selecciona un archivo .csv o .xlsx."); return;
    }
    if (!nextFile.size) { setFile(null); setError("El archivo está vacío."); return; }
    setFile(nextFile);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
    event.target.value = "";
  }

  async function upload() {
    if (!file || !session) return;
    setUploading(true); setError(""); setResult(null); setUploadStage("reading"); setReadProgress(0);
    try {
      const contentBase64 = await fileToBase64(file, setReadProgress);
      setUploadStage("sending");
      const response = await queryGraphQL<UploadResult>(UPLOAD_ASSETS, { input: { filename: file.name, contentBase64 } });
      setResult(response.uploadAssetsBulk);
      setUploadStage("complete"); setReadProgress(100);
      setFile(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
      setUploadStage(null);
    } finally { setUploading(false); }
  }

  return (
    <div className="work-page">
      <PageTitle eyebrow="INVENTARIO · ADMINISTRACIÓN" title="Carga masiva" description="Importa activos desde Excel o CSV; el lote se confirma completo o no se guarda." />
      <Feedback error={error} success={result ? `${result.importedCount} activos importados correctamente.` : undefined} />
      <section className="work-section upload-section">
        <div className="section-toolbar"><div className="toolbar-title"><FileSpreadsheet size={17} /><strong>Importar archivo</strong></div><span className="toolbar-note">.XLSX · .CSV</span></div>
        <label className={`upload-dropzone${dragging ? " dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}>
          <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onInputChange} />
          <span className="upload-symbol"><FileUp size={22} /></span><strong>Arrastra el archivo o explora tu equipo</strong><small>Formato CSV o XLSX. La primera fila debe contener los encabezados.</small>
          <span className="upload-filetypes"><span>CSV</span><span>XLSX</span></span>
        </label>
        {file && <div className="selected-file"><FileSpreadsheet size={18} /><div><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(1)} KB</small></div><button className="table-action" type="button" onClick={() => setFile(null)} aria-label="Quitar archivo"><X size={15} /></button></div>}
        <div className="upload-columns"><div><p className="work-eyebrow">COLUMNAS REQUERIDAS</p><p>Modelo (<code>model</code>), valor estimado (<code>estimatedValue</code>) y fecha de compra (<code>purchaseDate</code>). El número de serie es opcional; se genera al importar.</p></div><div><p className="work-eyebrow">VALIDACIÓN</p><p>Los importes del archivo se interpretan en USD. Se requiere un valor positivo y una fecha válida; el estado inicial será &quot;Disponible&quot;.</p></div></div>
        {uploadStage && <div className={`upload-progress ${uploadStage === "complete" ? "complete" : ""}`} role="status" aria-live="polite">
          <div className="upload-progress-copy"><span>{uploadStage === "reading" ? "Preparando archivo" : uploadStage === "sending" ? "Validando e importando lote" : "Importación completada"}</span><strong>{uploadStage === "reading" ? `${readProgress}%` : uploadStage === "complete" ? "100%" : ""}</strong></div>
          <div className="upload-progress-track" role="progressbar" aria-label="Progreso de carga" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadStage === "complete" ? 100 : uploadStage === "reading" ? readProgress : undefined}>
            <span className={uploadStage === "sending" ? "indeterminate" : ""} style={uploadStage === "reading" ? { width: `${readProgress}%` } : uploadStage === "complete" ? { width: "100%" } : undefined} />
          </div>
          {uploadStage === "sending" && <small>El servidor está procesando el lote; el porcentaje se confirmará al finalizar.</small>}
        </div>}
        <div className="upload-actions"><span><FileWarning size={15} /> Si una fila falla, se revierte el lote completo.</span><Button onClick={upload} loading={uploading} disabled={!file}>{uploading ? "Procesando archivo" : "Importar activos"}</Button></div>
      </section>
      {result && <section className="work-section results-section"><div className="section-toolbar"><div className="toolbar-title"><CheckCircle2 size={17} /><strong>Activos importados</strong><span>{result.importedCount}</span></div></div><DataTable headings={["Número de serie", "Modelo", "Valor estimado", "Fecha de compra", "Estado"]}>{result.assets.map((asset) => <tr key={asset.id}><td className="mono-cell">{asset.serialNumber}</td><td>{asset.model}</td><td>{asset.estimatedValue == null ? "—" : formatMoney(asset.estimatedValue)}</td><td>{asset.purchaseDate}</td><td><StatusTag value={asset.status} /></td></tr>)}</DataTable></section>}
    </div>
  );
}