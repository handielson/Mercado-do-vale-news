import React, { useEffect, useState } from 'react';
import { accountantPortalService, type AccountantCompany, type NfceProductionSequenceStatus } from '../../services/accountantPortalService';

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

export function AccountantNfceSequencePanel() {
  const [companies,setCompanies] = useState<AccountantCompany[]>([]);
  const [companyId,setCompanyId] = useState('');
  const [status,setStatus] = useState<NfceProductionSequenceStatus|null>(null);
  const [series,setSeries] = useState('2');
  const [lastNumber,setLastNumber] = useState('0');
  const [reason,setReason] = useState('Nova série própria para NFC-e do balcão');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  useEffect(()=>{let active=true;accountantPortalService.list().then(result=>{
    if(active){setCompanies(result.companies);setCompanyId(result.companies[0]?.id||'');}
  }).catch(err=>active&&setError(err instanceof Error?err.message:'Falha ao carregar empresas.'));return()=>{active=false};},[]);
  useEffect(()=>{if(!companyId)return;let active=true;setStatus(null);accountantPortalService.nfceProductionSequenceStatus(companyId)
    .then(result=>{if(active){setStatus(result);if(result.sequences[0]){setSeries(String(result.sequences[0].series));setLastNumber(String(result.sequences[0].nextNumber-1));}}}).catch(err=>active&&setError(err instanceof Error?err.message:'Falha ao carregar a numeração.'));
    return()=>{active=false};},[companyId]);
  const save=async()=>{
    if(!companyId||busy)return;
    const selectedSeries=Number(series),selectedLast=Number(lastNumber);
    if(!Number.isSafeInteger(selectedSeries)||selectedSeries<2||selectedSeries>889||!Number.isSafeInteger(selectedLast)||selectedLast<0||selectedLast>999999998||reason.trim().length<10){setError('Confira série, último número e justificativa.');return;}
    if(!window.confirm(`Confirma que a série ${String(selectedSeries).padStart(3,'0')} e o último número ${selectedLast} foram conferidos para esta empresa? O próximo será ${selectedLast+1}.`))return;
    setBusy(true);setError('');setMessage('');
    try{
      await accountantPortalService.configureNfceProductionSequence(companyId,selectedSeries,selectedLast,reason.trim());
      setStatus(await accountantPortalService.nfceProductionSequenceStatus(companyId));
      setMessage('Numeração cadastrada e registrada na auditoria. Isso não libera emissão real.');
    }catch(err){setError(err instanceof Error?err.message:'Falha ao salvar a numeração.')}finally{setBusy(false);}
  };
  return <section className="rounded-2xl border border-amber-200 bg-white p-6 space-y-4" aria-label="Numeração da NFC-e para o contador">
    <div><h2 className="text-lg font-bold text-slate-800">Numeração da NFC-e de produção</h2><p className="text-sm text-slate-600">O contador confere a série e o último número antes de cadastrar ou ajustar a sequência. A série 001 continua no Bling; a 002 foi escolhida para o emissor próprio, a partir do número 1.</p></div>
    <label className="block text-sm">Empresa<select className={input} value={companyId} onChange={event=>{setCompanyId(event.target.value);setMessage('');setError('')}}>{companies.map(company=><option key={company.id} value={company.id}>{company.name} — {company.cnpj}</option>)}</select></label>
    {status&&<div className="text-sm"><strong>Séries cadastradas:</strong> {status.sequences.length?<ul className="mt-1 space-y-1">{status.sequences.map(item=><li key={item.series}>Série {String(item.series).padStart(3,'0')} · próximo nº {item.nextNumber} · conferida por {item.checkedBy} em {new Date(item.checkedAt).toLocaleString('pt-BR')}</li>)}</ul>:'nenhuma'}<p className="mt-1 text-amber-800">Cadastrar a numeração não ativa a emissão fiscal. Nunca reutilize número reservado; saltos de numeração precisam do procedimento fiscal aplicável.</p></div>}
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Série<input className={input} type="number" min="2" max="889" value={series} onChange={event=>setSeries(event.target.value)} /></label><label className="text-sm">Último número usado nesta série<input className={input} type="number" min="0" max="999999998" value={lastNumber} onChange={event=>setLastNumber(event.target.value)} /></label></div>
    <label className="block text-sm">Justificativa da conferência<textarea className={input} value={reason} onChange={event=>setReason(event.target.value)} /></label>
    <button type="button" disabled={busy||!status} onClick={()=>void save()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?'Salvando...':'Salvar numeração conferida'}</button>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{message&&<p role="status" className="text-sm text-emerald-800">{message}</p>}
  </section>;
}
