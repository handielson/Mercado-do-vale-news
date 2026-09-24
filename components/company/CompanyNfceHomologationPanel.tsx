import React, { useEffect, useState } from 'react';
import { companyFiscalService, type NfceAttempt, type NfceHomologationStatus, type NfceSalePreflight } from '../../services/companyFiscalService';

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const button = 'rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50';
const issueLabels: Record<string,string> = {
  accountant_validation_pending:'Aprovação da matriz fiscal pelo contador pendente',
  accountant_operation_review_pending:'Revisão atual da venda presencial por contador autorizado pendente',
  operation_tax_parameters_unsupported:'Tratamento ou alíquotas fora do recorte fiscal implementado',
  item_tax_parameters_pending:'Tributação do produto pendente', payment_method_mapping_pending:'Meio de pagamento ainda não mapeado',
  payment_details_missing:'Dados do pagamento ausentes', sale_not_paid:'Venda não paga',
  sale_finalization_incomplete:'Venda ainda não concluída', adjustment_unsupported:'Ajuste ou desconto ainda não suportado',
};

export function CompanyNfceHomologationPanel() {
  const [companyId,setCompanyId] = useState('primary');
  const [status,setStatus] = useState<NfceHomologationStatus|null>(null);
  const [saleId,setSaleId] = useState('');
  const [series,setSeries] = useState('1');
  const [lastNumber,setLastNumber] = useState('0');
  const [preflight,setPreflight] = useState<NfceSalePreflight|null>(null);
  const [attempt,setAttempt] = useState<NfceAttempt|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const refresh = async (id = companyId) => setStatus(await companyFiscalService.nfceHomologationStatus(id));
  useEffect(()=>{ let active=true; companyFiscalService.list().then(result=>{
    if (!active) return;
    const primary=result.companies.find(item=>item.id==='primary');
    if (!primary) throw new Error('Empresa principal não encontrada.');
    setCompanyId(primary.id);
    return companyFiscalService.nfceHomologationStatus(primary.id).then(value=>{if(active)setStatus(value)});
  }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Falha ao carregar a homologação.')});return()=>{active=false};},[]);
  const run = async (work:()=>Promise<void>) => {setBusy(true);setError('');setMessage('');try{await work()}catch(reason){setError(reason instanceof Error?reason.message:'Falha na operação de homologação.')}finally{setBusy(false)}};
  const configuredSeries = status?.sequences.find(item=>item.series===Number(series));
  const settingsReady = !!status?.certificateInstalled && !!status?.csc.configured && !!configuredSeries;
  const refreshAttempt = async (id:string) => setAttempt(await companyFiscalService.nfceAttempt(companyId,id));
  return <section className="space-y-4 rounded-2xl border border-blue-200 bg-white p-5" aria-label="Emissor NFC-e em homologação">
    <div><h2 className="text-lg font-bold text-slate-900">NFC-e · homologação</h2><p className="text-sm text-slate-600">Ambiente de testes, sem valor fiscal. A emissão real continua indisponível. Use uma venda presencial concluída e paga da empresa principal.</p></div>
    {status&&<div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"><p>Certificado A1: <strong>{status.certificateInstalled?'instalado':'pendente'}</strong></p><p>CSC de homologação: <strong>{status.csc.configured?'configurado':'pendente'}</strong></p><p>Matriz fiscal: <strong>{status.validationStatus==='approved'?'aprovada':'aguardando contador'}</strong></p><p>Transmissão: <strong>{status.transmitEnabled?'habilitada':'desligada'}</strong></p></div>}
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"><h3 className="font-semibold">Numeração separada de homologação</h3><p className="text-xs text-slate-600">Confira no emissor anterior o último número usado nesta série de testes. Reservas já criadas nunca são reutilizadas.</p><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Série<input className={input} type="number" min="0" max="999" value={series} onChange={event=>setSeries(event.target.value)} /></label><label className="text-sm">Último número usado<input className={input} type="number" min="0" value={lastNumber} onChange={event=>setLastNumber(event.target.value)} /></label><div className="flex items-end"><button type="button" className={button} disabled={busy || !/^\d+$/.test(series) || !/^\d+$/.test(lastNumber)} onClick={()=>void run(async()=>{if(!window.confirm('Confirma a série e o último número de homologação?'))return;await companyFiscalService.configureNfceHomologationSequence(companyId,Number(series),Number(lastNumber));await refresh();setMessage('Numeração de homologação conferida.');})}>Conferir numeração</button></div></div>{configuredSeries&&<p className="text-xs text-blue-900">Próximo número reservado na série {series}: {configuredSeries.nextNumber}.</p>}</div>
    <div className="rounded-xl border border-slate-200 p-4 space-y-3"><h3 className="font-semibold">Venda do PDV</h3><label className="block text-sm">ID da venda<input className={input} value={saleId} onChange={event=>{setSaleId(event.target.value.trim());setPreflight(null);setAttempt(null)}} placeholder="Cole o identificador da venda concluída" /></label><button type="button" className={button} disabled={busy || !saleId} onClick={()=>void run(async()=>{const result=await companyFiscalService.nfceSalePreflight(companyId,saleId);setPreflight(result);setAttempt(null);setMessage('Conferência concluída sem reservar número.');})}>Conferir venda</button>
      {preflight&&<div className="space-y-2 text-sm"><p>Itens: {preflight.itemCount} · Valor: {preflight.saleTotalCents==null?'não informado':(preflight.saleTotalCents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>{preflight.issues.length?<ul className="list-disc pl-5 text-amber-900">{preflight.issues.map((item,index)=><li key={`${item.code}-${index}`}>{issueLabels[item.code]||item.code}{item.itemId?` · item ${item.itemId}`:''}</li>)}</ul>:<p className="text-emerald-800">Venda pronta para preparação em homologação.</p>}{preflight.attempts.length>0&&<div className="flex flex-wrap gap-2">{preflight.attempts.map(item=><button key={item.id} type="button" className={button} onClick={()=>void run(()=>refreshAttempt(item.id))}>Abrir tentativa {item.document_number} · {item.status}</button>)}</div>}</div>}
      <button type="button" className={button} disabled={busy || !status?.prepareEnabled || !settingsReady || !preflight?.saleDataReady || preflight.saleId!==saleId} onClick={()=>void run(async()=>{const result=await companyFiscalService.prepareNfceHomologation(companyId,saleId,Number(series));await refreshAttempt(result.issuanceId);await refresh();setMessage(`NFC-e de homologação ${result.status}; XML assinado e número preservados.`);})}>Preparar NFC-e de homologação</button>
    </div>
    {attempt&&<div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3 text-sm"><h3 className="font-semibold">Tentativa nº {attempt.document_number} · {attempt.status}</h3>{attempt.access_key&&<p className="break-all">Chave: {attempt.access_key}</p>}{attempt.last_error&&<p className="text-amber-900">{attempt.last_error}</p>}<div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy || !status?.transmitEnabled || attempt.status!=='prepared'} onClick={()=>void run(async()=>{if(!window.confirm('Transmitir esta única NFC-e ao ambiente de homologação da SEFAZ?'))return;const result=await companyFiscalService.transmitNfceHomologation(companyId,attempt.id);await refreshAttempt(attempt.id);setMessage(`Resposta: ${result.state}${result.reason?` · ${result.reason}`:''}`);})}>Transmitir uma vez</button><button type="button" className={button} disabled={busy || !['sending','uncertain'].includes(attempt.status)} onClick={()=>void run(async()=>{const result=await companyFiscalService.reconcileNfceHomologation(companyId,attempt.id);await refreshAttempt(attempt.id);setMessage(`Consulta da chave: ${result.state}`);})}>Consultar a mesma chave</button>{attempt.status==='authorized'&&<button type="button" className={button} onClick={()=>void run(async()=>{const printWindow=window.open('', '_blank');if(!printWindow)throw new Error('Permita a janela de impressão.');try{const document=await companyFiscalService.authorizedNfceDanfe(companyId,attempt.sale_id);const {printDanfeNfce}=await import('../../utils/printDanfeNfce');printDanfeNfce(document.authorizedXml,'80mm',printWindow);}catch(error){printWindow.close();throw error;}})}>Imprimir DANFE de teste</button>}</div></div>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{message&&<p role="status" className="text-sm text-blue-800">{message}</p>}
  </section>;
}
