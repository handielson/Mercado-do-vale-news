import React, { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, History, Image, Loader2, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { SignedWarrantyDocument, SignedWarrantySnapshot } from '../../../types/signedWarrantyDocument';
import {
  downloadSignedWarrantyOriginal,
  downloadSignedWarrantyPdf,
  getSignedWarrantySnapshot,
  syncSignedWarrantyFolder,
  uploadSignedWarranty,
} from '../../../services/signedWarrantyDocumentService';
import { SignedWarrantyCaptureModal } from './SignedWarrantyCaptureModal';

interface SignedWarrantyDocumentSectionProps {
  saleId: string;
  saleCode: string;
}

function openBlob(blob: Blob, fileName: string, mode: 'open' | 'download' | 'print') {
  const url = URL.createObjectURL(blob);
  if (mode === 'download') {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }
  const win = window.open(url, '_blank');
  if (!win) {
    toast.error('Permita popups para abrir o documento.');
    URL.revokeObjectURL(url);
    return;
  }
  if (mode === 'print') {
    win.addEventListener('load', () => win.print(), { once: true });
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function versionLabel(document: SignedWarrantyDocument) {
  return `v${document.version_number || 1} • ${document.status}`;
}

export function SignedWarrantyDocumentSection({ saleId, saleCode }: SignedWarrantyDocumentSectionProps) {
  const [snapshot, setSnapshot] = useState<SignedWarrantySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const active = snapshot?.active || null;

  async function load() {
    setLoading(true);
    try {
      setSnapshot(await getSignedWarrantySnapshot(saleId));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar termo assinado.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [saleId]);

  async function handleUpload(file: File) {
    setBusy(true);
    try {
      setSnapshot(await uploadSignedWarranty(saleId, file));
      setCaptureOpen(false);
      toast.success('Termo assinado digitalizado com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao enviar termo assinado.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setBusy(true);
    try {
      const result = await syncSignedWarrantyFolder();
      await load();
      toast.success(`Sincronização concluída: ${result.processed || 0} processado(s), ${result.failed || 0} pendência(s).`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao sincronizar pasta termos-garantia.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePdf(mode: 'open' | 'download' | 'print') {
    if (!active) return;
    setBusy(true);
    try {
      const blob = await downloadSignedWarrantyPdf(active.id);
      openBlob(blob, `termo-garantia-venda-${saleCode}.pdf`, mode);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao abrir PDF do termo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleOriginal() {
    if (!active) return;
    setBusy(true);
    try {
      const blob = await downloadSignedWarrantyOriginal(active.id);
      openBlob(blob, `termo-garantia-venda-${saleCode}-original.jpg`, 'open');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao abrir imagem original.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-950">
            <FileText size={16} /> Termo assinado da venda {saleCode}
          </h3>
          <p className="mt-1 text-xs text-emerald-800">
            {active
              ? (active.discard_message || 'Documento físico digitalizado, destruído e descartado.')
              : 'Termo assinado pendente. Digitalize pela venda específica para não misturar documentos.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCaptureOpen(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            <Upload size={14} /> {active ? 'Substituir' : 'Digitalizar termo assinado'}
          </button>
          <button type="button" onClick={handleSync} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Sincronizar agora
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-800">
          <Loader2 size={14} className="animate-spin" /> Carregando termo...
        </div>
      ) : active ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => handlePdf('open')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <ExternalLink size={14} /> Abrir PDF
          </button>
          <button type="button" onClick={() => handlePdf('download')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Download size={14} /> Baixar
          </button>
          <button type="button" onClick={() => handlePdf('print')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Imprimir
          </button>
          <button type="button" onClick={handleOriginal} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Image size={14} /> Ver original
          </button>
        </div>
      ) : null}

      {(snapshot?.history?.length || snapshot?.pending?.length) ? (
        <div className="mt-4 grid gap-3 text-xs text-slate-700 sm:grid-cols-2">
          {Boolean(snapshot?.history?.length) && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-1.5 font-bold text-slate-800"><History size={13} /> Histórico</div>
              <ul className="space-y-1">
                {snapshot!.history.map((document) => (
                  <li key={document.id}>{versionLabel(document)}</li>
                ))}
              </ul>
            </div>
          )}
          {Boolean(snapshot?.pending?.length) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="mb-2 font-bold text-amber-900">Pendências</div>
              <ul className="space-y-1">
                {snapshot!.pending.map((document) => (
                  <li key={document.id}>{document.original_file_name}: {document.error_code || document.status}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      <SignedWarrantyCaptureModal
        open={captureOpen}
        busy={busy}
        onClose={() => setCaptureOpen(false)}
        onConfirm={handleUpload}
      />
    </section>
  );
}
