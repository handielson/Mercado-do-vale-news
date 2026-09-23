import React, { useEffect, useState } from 'react';
import { DownloadCloud, UserPlus, XCircle } from 'lucide-react';
import { companyFiscalService, type FiscalCompany } from '../../services/companyFiscalService';
import { accountantAccessAdminService, type AccountantAccess } from '../../services/accountantPortalService';

export function CompanyAccountantAccessPanel() {
  const [companies, setCompanies] = useState<FiscalCompany[]>([]);
  const [selected, setSelected] = useState('');
  const [access, setAccess] = useState<AccountantAccess[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [importFrom, setImportFrom] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [importTo, setImportTo] = useState(new Date().toISOString().slice(0, 10));
  const selectedCompany = companies.find(company => company.id === selected);

  useEffect(() => { companyFiscalService.list().then(result => { setCompanies(result.companies); setSelected(result.companies[0]?.id || ''); }).catch(err => setError(err.message)); }, []);
  const load = async (id = selected) => {
    if (!id) return;
    setBusy(true); setError('');
    try { setAccess((await accountantAccessAdminService.list(id)).access); } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar acessos.'); } finally { setBusy(false); }
  };
  useEffect(() => { if (selected) void load(selected); }, [selected]);
  const grant = async () => {
    if (!email.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try { await accountantAccessAdminService.grant(selected, email.trim()); setEmail(''); setMessage('Acesso concedido. O contador já pode entrar em /contador.'); await load(selected); }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao conceder acesso.'); setBusy(false); }
  };
  const revoke = async (customerId: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await accountantAccessAdminService.revoke(selected, customerId); setMessage('Acesso revogado.'); await load(selected); }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao revogar acesso.'); setBusy(false); }
  };
  const importBling = async () => {
    if (!selected || !importFrom || !importTo || importFrom > importTo) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await accountantAccessAdminService.importBlingDocuments(selected, importFrom, importTo);
      setMessage(`${result.imported} documento(s) conferido(s): ${result.authorized} autorizado(s) e ${result.cancelled} cancelado(s). Repetir a importação atualiza os mesmos documentos sem duplicar.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao importar documentos fiscais.'); }
    finally { setBusy(false); }
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4" aria-labelledby="accountant-access-title">
    <div><h2 id="accountant-access-title" className="text-lg font-bold text-slate-800">Espaço do Contador</h2><p className="mt-1 text-sm text-slate-600">Conceda acesso somente à validação fiscal e ao faturamento desta empresa. O contador não recebe acesso ao painel administrativo.</p></div>
    <label className="block text-sm font-semibold">Empresa fiscal<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={selected} onChange={event => setSelected(event.target.value)}>{companies.map(company => <option key={company.id} value={company.id}>{company.name} — {company.cnpj}</option>)}</select></label>
    <div className="flex flex-col gap-2 sm:flex-row"><input type="email" className="flex-1 rounded-lg border border-slate-300 px-3 py-2" placeholder="E-mail da conta do contador" value={email} onChange={event => setEmail(event.target.value)} /><button type="button" disabled={busy || !email.trim()} onClick={grant} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"><UserPlus size={17}/>Conceder acesso</button></div>
    <p className="text-xs text-slate-500">Se a conta ainda não existir, o contador deve criá-la em “Criar conta” na página de login. Depois, conceda o acesso pelo e-mail cadastrado.</p>
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div><h3 className="font-bold text-blue-950">Copiar histórico fiscal do Bling</h3><p className="text-sm text-blue-900">Importa NF-e e NFC-e de saída, autorizadas e canceladas, para a nossa base. Valores e situação são conferidos no detalhe de cada nota. Importe em períodos pequenos (até 25 notas por operação). A operação apenas consulta o Bling: não altera nem exclui documentos lá. A conexão atual pertence à empresa principal; cada empresa adicional precisará da própria conexão.</p></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-semibold text-slate-800">De<input type="date" value={importFrom} onChange={event => setImportFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label><label className="text-sm font-semibold text-slate-800">Até<input type="date" value={importTo} onChange={event => setImportTo(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label><button type="button" disabled={busy || !selected || !selectedCompany?.primary || !importFrom || !importTo || importFrom > importTo} onClick={importBling} className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:opacity-50"><DownloadCloud size={17}/>Importar notas</button></div>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-green-700">{message}</p>}
    <div className="divide-y rounded-xl border border-slate-200">{!busy && access.filter(item => item.is_active).length === 0 && <p className="p-4 text-sm text-slate-500">Nenhum contador autorizado.</p>}{access.filter(item => item.is_active).map(item => <div key={item.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-semibold text-slate-800">{item.name}</p><p className="text-sm text-slate-500">{item.email}</p></div><button type="button" onClick={() => revoke(item.customer_id)} disabled={busy} className="inline-flex items-center gap-1 text-sm font-semibold text-red-700 disabled:opacity-50"><XCircle size={16}/>Revogar</button></div>)}</div>
  </section>;
}
