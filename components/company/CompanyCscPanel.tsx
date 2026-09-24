import React, { useEffect, useState } from 'react';
import { companyFiscalService, type FiscalCscStatus } from '../../services/companyFiscalService';

type Environment = FiscalCscStatus['environment'];
const environments: Array<{ value: Environment; label: string }> = [
  { value: 'homologation', label: 'Homologação' },
  { value: 'production', label: 'Produção' },
];

export function CompanyCscPanel({ companyId }: { companyId: string }) {
  const [statuses, setStatuses] = useState<Partial<Record<Environment, FiscalCscStatus>>>({});
  const [environment, setEnvironment] = useState<Environment>('homologation');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setStatuses({}); setIdentifier(''); setCode(''); setError(''); setMessage('');
    Promise.all(environments.map(item => companyFiscalService.cscStatus(companyId, item.value)))
      .then(results => { if (active) setStatuses(Object.fromEntries(results.map(result => [result.environment, result]))); })
      .catch(() => { if (active) setError('Não foi possível consultar a configuração do CSC desta empresa.'); });
    return () => { active = false; };
  }, [companyId]);

  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await companyFiscalService.saveCsc(companyId, environment, identifier, code);
      setStatuses(previous => ({ ...previous, [environment]: result }));
      setCode('');
      setMessage(`CSC de ${environment === 'production' ? 'produção' : 'homologação'} armazenado no cofre do servidor.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o CSC.'); }
    finally { setBusy(false); }
  };

  return <div className="rounded-xl border border-slate-200 p-4 space-y-4">
    <div><h3 className="font-semibold text-slate-800">CSC da NFC-e</h3><p className="mt-1 text-sm text-slate-600">Configure o identificador e o código obtidos no e-Fisco para cada ambiente. O código fica criptografado no servidor e não aparece novamente nesta tela.</p></div>
    <div className="grid gap-2 sm:grid-cols-2">{environments.map(item => <div key={item.value} className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><strong>{item.label}</strong><span className="ml-2">{statuses[item.value]?.configured ? `Configurado · ID ${statuses[item.value]?.identifier}` : 'Não configurado'}</span></div>)}</div>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm font-semibold">Ambiente<select className="mt-1 w-full rounded-lg border p-2" value={environment} disabled={busy} onChange={event => { setEnvironment(event.target.value as Environment); setIdentifier(''); setCode(''); setError(''); setMessage(''); }}>{environments.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="text-sm font-semibold">Identificador do CSC<input className="mt-1 w-full rounded-lg border p-2" inputMode="numeric" maxLength={6} autoComplete="off" value={identifier} disabled={busy} onChange={event => setIdentifier(event.target.value)} /></label>
      <label className="text-sm font-semibold">Código CSC<input className="mt-1 w-full rounded-lg border p-2" type="password" autoComplete="new-password" value={code} disabled={busy} onChange={event => setCode(event.target.value)} /></label>
    </div>
    <button type="button" onClick={save} disabled={busy || !identifier || !code} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar CSC'}</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
  </div>;
}
