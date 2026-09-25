import { useEffect, useRef, useState } from 'react';
import { AccountantFiscalFileActions } from './AccountantFiscalFileActions';
import { FiscalDocumentReviewPanel } from './FiscalDocumentReviewPanel';
import { accountantAccessAdminService, accountantPortalService, type AccountantRevenueReport, type FiscalCancellationAssessment } from '../../services/accountantPortalService';

type FiscalDocument = AccountantRevenueReport['documents'][number];

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const date = (value: string) => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const channels: Record<string, string> = { pdv: 'PDV', online: 'Site', shopee: 'Shopee', tiktok: 'TikTok Shop', unidentified: 'Canal não identificado' };

export function AccountantFiscalDocumentDrawer({ companyId, document, adminMode, onClose, onArchived }: { companyId: string; document: FiscalDocument; adminMode: boolean; onClose: () => void; onArchived: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [archived, setArchived] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [sefazBusy, setSefazBusy] = useState(false);
  const [sefazError, setSefazError] = useState('');
  const [sefazResult, setSefazResult] = useState<{ cStat: string; reason: string; checkedAt: string } | null>(null);
  const [cancellationBusy, setCancellationBusy] = useState(false);
  const [cancellationError, setCancellationError] = useState('');
  const [cancellationResult, setCancellationResult] = useState<FiscalCancellationAssessment | null>(null);
  const fileAvailable = document.fileAvailable || archived;
  const model = document.model === '65' ? 'NFC-e' : 'NF-e';

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setPdfUrl(''); setPdfError('');
    if (!fileAvailable) return () => { active = false; };
    setPdfBusy(true);
    accountantPortalService.documentFile(companyId, document.id, 'pdf').then(file => {
      const bytes = Uint8Array.from(atob(file.base64), char => char.charCodeAt(0));
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      if (active) setPdfUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch(error => { if (active) setPdfError(error instanceof Error ? error.message : 'Não foi possível gerar a visualização.'); })
      .finally(() => { if (active) setPdfBusy(false); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [companyId, document.id, fileAvailable]);

  const consultSefaz = async () => {
    setSefazBusy(true); setSefazError(''); setSefazResult(null);
    try { setSefazResult(await accountantPortalService.sefazStatus(companyId, document.id)); }
    catch (error) { setSefazError(error instanceof Error ? error.message : 'Falha ao consultar a SEFAZ.'); }
    finally { setSefazBusy(false); }
  };
  const assessCancellation = async () => {
    setCancellationBusy(true); setCancellationError(''); setCancellationResult(null);
    try { setCancellationResult(await accountantAccessAdminService.cancellationAssessment(companyId, document.id)); }
    catch (error) { setCancellationError(error instanceof Error ? error.message : 'Falha ao conferir o cancelamento.'); }
    finally { setCancellationBusy(false); }
  };

  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={`${model} ${document.number || 'sem número'}`} className="flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-4 sm:p-5">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{model} · {channels[document.channel] || 'Canal não identificado'}</p><h2 className="text-xl font-bold text-slate-900">Nota {document.number || 'sem número'}{document.series && ` · série ${document.series}`}</h2><p className="text-sm text-slate-600">{date(document.issuedAt)} · {money(document.totalCents)} · {document.status === 'authorized' ? 'Autorizada' : 'Cancelada'}</p></div>
        <button ref={closeRef} type="button" onClick={onClose} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Fechar ×</button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-3"><p><strong>Tipo:</strong> {model}</p><p><strong>Canal:</strong> {channels[document.channel] || 'Canal não identificado'}</p><p><strong>Pedido:</strong> {document.orderReference || 'Sem vínculo identificado'}</p></div>
        <section aria-label="Visualização da nota fiscal" className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div><h3 className="font-bold text-slate-900">Visualizar nota</h3><p className="text-sm text-slate-600">O PDF é gerado somente ao abrir esta nota. Use os botões abaixo para abrir em outra aba ou baixar.</p></div>
          {pdfBusy && <p role="status" className="text-sm text-slate-600">Gerando visualização da nota…</p>}
          {pdfError && <p role="alert" className="text-sm text-red-700">{pdfError}</p>}
          {!fileAvailable && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">XML original pendente. Guarde o XML para habilitar a visualização.</p>}
          {pdfUrl && <iframe title={`Prévia da ${model} ${document.number || 'sem número'}`} src={pdfUrl} className="h-[65vh] min-h-96 w-full rounded-lg border border-slate-200" />}
          <AccountantFiscalFileActions companyId={companyId} documentId={document.id} fileAvailable={fileAvailable} adminMode={adminMode} onArchived={() => { setArchived(true); onArchived(); }} />
        </section>
        {document.model === '55' && <section className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div><h3 className="font-bold text-slate-900">Situação na SEFAZ-PE</h3><p className="text-sm text-slate-600">Consulta de protocolo em produção. A resposta não altera a nota nem o pedido.</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void consultSefaz()} disabled={sefazBusy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{sefazBusy ? 'Consultando…' : 'Consultar SEFAZ'}</button>{adminMode && ['shopee', 'tiktok'].includes(document.channel) && <button type="button" onClick={() => void assessCancellation()} disabled={cancellationBusy} className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50">{cancellationBusy ? 'Conferindo…' : 'Conferir cancelamento'}</button>}</div>
          {sefazError && <p role="alert" className="text-sm text-red-700">{sefazError}</p>}
          {sefazResult && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950">SEFAZ produção: {sefazResult.cStat} — {sefazResult.reason}. Consulta em {new Date(sefazResult.checkedAt).toLocaleString('pt-BR')}.</p>}
          {cancellationError && <p role="alert" className="text-sm text-red-700">{cancellationError}</p>}
          {cancellationResult && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Conferência somente de leitura: pedido {cancellationResult.marketplace.status || 'sem status'}; SEFAZ {cancellationResult.sefaz.cStat} — {cancellationResult.sefaz.reason}. {cancellationResult.assessment.eligible ? 'Critérios atendidos; nenhum evento foi enviado.' : `Envio bloqueado: ${cancellationResult.assessment.blockers.join(', ')}.`}</p>}
        </section>}
        <FiscalDocumentReviewPanel companyId={companyId} documentId={document.id} model={document.model} />
      </div>
    </section>
  </div>;
}
