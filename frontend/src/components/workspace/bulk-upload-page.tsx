"use client";

import { useState, type ChangeEvent } from "react";
import { CheckCircle2, FileSpreadsheet, FileUp, FileWarning, Upload, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, DataTable, Feedback, PageTitle, StatusTag } from "@/components/workspace/ui";
import { UPLOAD_ASSETS } from "@/lib/operations";
import { errorMessage, queryGraphQL, type AssetItem } from "@/lib/workspace";

type UploadResult = { uploadAssetsBulk: { importedCount: number; assets: AssetItem[] } };

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function BulkUploadPage() {
  const { session } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult["uploadAssetsBulk"] | null>(null);
  const [error, setError] = useState("");

  function chooseFile(nextFile?: File) {
    setError(""); setResult(null);
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
    setUploading(true); setError(""); setResult(null);
    try {
      const contentBase64 = await fileToBase64(file);
      const response = await queryGraphQL<UploadResult>(UPLOAD_ASSETS, { input: { filename: file.name, contentBase64 } });
      setResult(response.uploadAssetsBulk);
      setFile(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
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
        {file && <div className="selected-file"><FileSpreadsheet size={18} /><div><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(1)} KB · {file.type || "Archivo"}</small></div><button className="table-action" type="button" onClick={() => setFile(null)} aria-label="Quitar archivo"><X size={15} /></button></div>}
        <div className="upload-columns"><div><p className="work-eyebrow">COLUMNAS REQUERIDAS</p><p><code>serialNumber</code> · <code>model</code> · <code>estimatedValue</code> · <code>purchaseDate</code></p></div><div><p className="work-eyebrow">VALIDACIÓN</p><p>Serial único, importe positivo y fecha válida. El estado inicial será AVAILABLE.</p></div></div>
        <div className="upload-actions"><span><FileWarning size={15} /> Si una fila falla, se revierte el lote completo.</span><Button onClick={upload} disabled={!file || uploading}><Upload size={15} />{uploading ? "Validando e importando…" : "Importar activos"}</Button></div>
      </section>
      {result && <section className="work-section results-section"><div className="section-toolbar"><div className="toolbar-title"><CheckCircle2 size={17} /><strong>Activos importados</strong><span>{result.importedCount}</span></div></div><DataTable headings={["Serial", "Modelo", "Valor estimado", "Fecha de compra", "Estado"]}>{result.assets.map((asset) => <tr key={asset.id}><td className="mono-cell">{asset.serialNumber}</td><td>{asset.model}</td><td>{asset.estimatedValue}</td><td>{asset.purchaseDate}</td><td><StatusTag value={asset.status} /></td></tr>)}</DataTable></section>}
    </div>
  );
}