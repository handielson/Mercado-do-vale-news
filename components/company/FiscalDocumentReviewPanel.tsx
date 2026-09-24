import React, { useEffect, useState } from 'react';
import { accountantPortalService, type FiscalDocumentReview, type FiscalDocumentReviewResponse } from '../../services/accountantPortalService';

const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

export function FiscalDocumentReviewPanel({ companyId, documentId }: { companyId: string; documentId: string }) {
  const [record, setRecord] = useState<FiscalDocumentReviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!companyId || !documentId) { setRecord(null); return; }
    let active = true;
    setRecord(null); setError(''); setMessage(''); setBusy(true);
    accountantPortalService.documentReview(companyId, documentId)
      .then(result => { if (active) setRecord(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Falha ao carregar revisão.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [companyId, documentId]);
  if (!documentId) return null;
  const patch = (value: Partial<FiscalDocumentReview>) => setRecord(current => current ? { ...current, review: { ...current.review, ...value } } : current);
  const save = async (reviewState: FiscalDocumentReview['reviewState']) => {
    if (!record || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = await accountantPortalService.saveDocumentReview(companyId, documentId, { ...record.review, reviewState });
      setRecord(saved);
      setMessage(reviewState === 'reviewed' ? 'Revisão registrada. Nenhuma ação fiscal foi executada.' : 'Rascunho salvo.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar revisão.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-amber-200 bg-white p-5 space-y-4" aria-labelledby="document-review-title">
    <div><h2 id="document-review-title" className="font-bold text-slate-900">Análise do contador para esta NF-e</h2><p className="mt-1 text-sm text-slate-600">Registre o tratamento dos valores e a providência recomendada com suas fontes. A revisão não cancela, devolve ou corrige a nota e não altera o faturamento.</p></div>
    {busy && !record && <p role="status" className="text-sm">Carregando revisão...</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="text-sm text-green-700">{message}</p>}
    {record && <>
      <p className="text-sm text-slate-700">NF-e {record.document.number || 's/n'} · Pedido {record.document.orderReference || 'sem vínculo'} · {record.review.reviewState === 'reviewed' ? 'Revisada' : 'Rascunho'}{record.review.reviewedAt && ` em ${new Date(record.review.reviewedAt).toLocaleString('pt-BR')}`}</p>
      <label className="block text-sm font-semibold">Tratamento de frete, taxa, moedas/cupom e diferença de valores<textarea className={fieldClass} rows={3} value={record.review.valueTreatment} onChange={event => patch({ valueTreatment: event.target.value })}/></label>
      <label className="block text-sm font-semibold">Providência fiscal recomendada<select className={fieldClass} value={record.review.fiscalAction} onChange={event => patch({ fiscalAction: event.target.value as FiscalDocumentReview['fiscalAction'] })}><option value="pending">Pendente de avaliação</option><option value="no_action">Nenhuma providência fiscal</option><option value="assess_cancellation">Avaliar cancelamento da NF-e</option><option value="assess_return">Avaliar devolução</option><option value="other">Outra providência</option></select></label>
      <label className="block text-sm font-semibold">Justificativa da decisão<textarea className={fieldClass} rows={3} value={record.review.justification} onChange={event => patch({ justification: event.target.value })}/></label>
      <label className="block text-sm font-semibold">Fontes e documentos conferidos<textarea className={fieldClass} rows={2} value={record.review.evidenceNotes} onChange={event => patch({ evidenceNotes: event.target.value })}/></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Contador responsável<input className={fieldClass} value={record.review.reviewerName} onChange={event => patch({ reviewerName: event.target.value })}/></label><label className="text-sm font-semibold">CRC ou registro profissional<input className={fieldClass} value={record.review.reviewerRegistration} onChange={event => patch({ reviewerRegistration: event.target.value })}/></label></div>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void save('draft')} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Salvar rascunho</button><button type="button" disabled={busy} onClick={() => void save('reviewed')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Concluir revisão</button></div>
    </>}
  </section>;
}
