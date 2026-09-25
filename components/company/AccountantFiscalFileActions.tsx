import React, { useState } from 'react';
import { accountantPortalService, type AccountantFiscalFile } from '../../services/accountantPortalService';

export function AccountantFiscalFileActions({ companyId, documentId, saleId, fileAvailable = false, adminMode = false }: { companyId: string; documentId?: string; saleId?: string; fileAvailable?: boolean; adminMode?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const available = !documentId || fileAvailable || saved;
  const open = async (format: 'pdf' | 'xml', preview = false) => {
    const target = preview ? window.open('', '_blank') : null;
    if (preview && !target) { setError('Permita abrir uma nova aba para visualizar o documento.'); return; }
    if (target) { target.opener = null; target.document.title = 'Carregando documento fiscal'; target.document.body.textContent = 'Gerando documento…'; }
    setBusy(true); setError('');
    let url: string | null = null;
    try {
      const file: AccountantFiscalFile = documentId
        ? await accountantPortalService.documentFile(companyId, documentId, format)
        : await accountantPortalService.saleReceipt(companyId, saleId!, format);
      const bytes = Uint8Array.from(atob(file.base64), char => char.charCodeAt(0));
      url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }));
      if (target && !target.closed) target.location.replace(url);
      else if (!preview) {
        const link = document.createElement('a'); link.href = url; link.download = file.filename;
        document.body.appendChild(link); link.click(); link.remove();
      }
    } catch (err) { target?.close(); setError(err instanceof Error ? err.message : 'Falha ao abrir documento.'); }
    finally { setBusy(false); if (url) { const releasedUrl = url; window.setTimeout(() => URL.revokeObjectURL(releasedUrl), 60000); } }
  };
  const archive = async (file?: File) => {
    if (!file || !documentId) return;
    if (file.size > 2000000) { setError('Selecione um XML de até 2 MB.'); return; }
    setBusy(true); setError('');
    try { await accountantPortalService.archiveXml(companyId, documentId, await file.text()); setSaved(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao guardar XML.'); }
    finally { setBusy(false); }
  };
  const button = 'rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50';
  return <div className="space-y-2">
    {documentId && <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${available ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{available ? '✓ Disponível para visualizar' : 'XML pendente · visualização indisponível'}</span>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || !available} className={button} onClick={() => void open('pdf', true)}>Visualizar</button>
      <button type="button" disabled={busy || !available} className={button} onClick={() => void open('pdf')}>Baixar PDF</button>
      <button type="button" disabled={busy || !available} className={button} onClick={() => void open('xml')}>Baixar XML</button>
      {adminMode && documentId && !available && <label className={button}>Guardar XML original<input aria-label="Guardar XML original" type="file" accept=".xml,application/xml,text/xml" disabled={busy} className="mt-1 block max-w-48 text-xs" onChange={event => { void archive(event.target.files?.[0]); event.target.value = ''; }} /></label>}
    </div>
    {busy && <p role="status" className="text-xs text-slate-500">Preparando documento…</p>}{error && <p role="alert" className="max-w-lg break-words text-xs text-red-700">{error}</p>}
  </div>;
}
