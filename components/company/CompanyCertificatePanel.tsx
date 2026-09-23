import React, { useEffect, useRef, useState } from 'react';
import { BellRing, Download, ExternalLink, FileKey2, PlayCircle, PlugZap, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { companyFiscalService, type FiscalCertificateStatus, type FiscalCompany } from '../../services/companyFiscalService';

const types: Array<[FiscalCertificateStatus['certificateType'], string]> = [
  ['A1_SERVER','A1 - Servidor'], ['A1_CLIENT','A1 - Máquina do cliente'], ['A3','A3'], ['WINDOWS','Gerenciador do Windows'],
];
const formatDate = (value?: string) => value ? new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

export function CompanyCertificatePanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [companies, setCompanies] = useState<FiscalCompany[]>([]);
  const [selected, setSelected] = useState('primary');
  const [status, setStatus] = useState<FiscalCertificateStatus | null>(null);
  const [validUntil, setValidUntil] = useState('');
  const [alertDays, setAlertDays] = useState(30);
  const [certificateType, setCertificateType] = useState<FiscalCertificateStatus['certificateType']>('A1_SERVER');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const selectedCompany = companies.find(company => company.id === selected);

  const loadCertificate = async (id: string) => {
    setLoading(true); setError('');
    try {
      const result = await companyFiscalService.certificate(id);
      setStatus(result); setValidUntil(result.validUntil); setAlertDays(result.alertDays); setCertificateType(result.certificateType);
    } catch { setError('Salve o cadastro fiscal da empresa antes de configurar o certificado.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { companyFiscalService.list().then(result => setCompanies(result.companies)).catch(() => setError('Não foi possível carregar as empresas.')); }, []);
  useEffect(() => { setStatus(null); setFile(null); setPassword(''); setDeleteConfirmation(''); void loadCertificate(selected); }, [selected]);

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name); setError(''); setMessage('');
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'A operação não foi concluída.'); }
    finally { setBusy(''); }
  };
  const save = () => run('save', async () => {
    const result = await companyFiscalService.saveCertificate(selected, { validUntil, alertDays, certificateType });
    setStatus(result); setMessage('Configuração do aviso salva.');
  });
  const upload = () => run('upload', async () => {
    if (!file) throw new Error('Selecione um arquivo .pfx ou .p12.');
    if (!password) throw new Error('Informe a senha do certificado.');
    const result = await companyFiscalService.uploadCertificate(selected, file, password, alertDays);
    setStatus(result); setValidUntil(result.validUntil); setCertificateType(result.certificateType); setPassword(''); setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    setMessage('Certificado validado, criptografado e instalado no servidor.');
  });
  const exportPfx = () => run('export', async () => {
    if (!password) throw new Error('Informe a senha atual do certificado para exportar.');
    const result = await companyFiscalService.exportCertificate(selected, password);
    const url = URL.createObjectURL(result.blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url); setPassword('');
    setMessage('Cópia protegida do certificado exportada. A operação foi auditada.');
  });
  const remove = () => run('delete', async () => {
    if (!password) throw new Error('Informe a senha atual do certificado.');
    if (deleteConfirmation.replace(/\D/g, '') !== selectedCompany?.cnpj) throw new Error('Digite o CNPJ da empresa para confirmar a exclusão.');
    await companyFiscalService.deleteCertificate(selected, password, deleteConfirmation);
    setPassword(''); setDeleteConfirmation(''); await loadCertificate(selected);
    setMessage('Certificado removido do cofre do servidor. O evento foi auditado.');
  });
  const testSefaz = (environment: 'homologation' | 'production') => run(`sefaz-${environment}`, async () => {
    const result = await companyFiscalService.testSefaz(selected, environment);
    await loadCertificate(selected);
    setMessage(`SEFAZ ${environment === 'production' ? 'produção' : 'homologação'}: ${result.cStat} — ${result.reason}.`);
  });

  return <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5" aria-labelledby="certificate-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><FileKey2 className="text-blue-700" /><div><h2 id="certificate-title" className="text-lg font-bold text-slate-800">Certificado digital</h2><p className="text-sm text-slate-600">Instalação segura do A1 e comunicação autenticada com a SEFAZ por empresa.</p></div></div><div className="flex gap-3 text-sm"><a href="/help/certificado-digital-a1.html" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 underline"><ExternalLink size={15}/>Guia</a><a href="/help/certificado-digital-a1.mp4" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 underline"><PlayCircle size={16}/>Vídeo</a></div></div>
    <label className="block text-sm font-semibold">Empresa<select className="mt-1 w-full rounded-lg border p-2" value={selected} onChange={event => setSelected(event.target.value)}>{companies.map(company => <option key={company.id} value={company.id}>{company.name} · {company.cnpj}</option>)}</select></label>
    <div><h3 className="font-semibold text-slate-700">Tipo de certificado</h3><div className="mt-2 flex flex-wrap gap-2">{types.map(([value,label]) => <button key={value} type="button" onClick={() => setCertificateType(value)} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${certificateType === value ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-700'}`}>{label}</button>)}</div></div>
    <div className="rounded-xl bg-sky-50 p-4 text-sm text-sky-900"><strong>Indicação de uso</strong><p className="mt-1">O A1 no servidor permite emitir em qualquer dispositivo autorizado. O PFX e sua senha ficam criptografados no cofre privado do servidor; o banco guarda somente metadados e auditoria.</p></div>
    <div className={`rounded-xl border p-5 ${status?.installed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex items-center gap-3 text-slate-800"><ShieldCheck /><strong>{status?.installed ? `Certificado instalado · válido até ${formatDate(status.validUntil)}` : 'Nenhum certificado instalado no servidor'}</strong></div>{status?.installed && <dl className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2"><div><dt className="font-semibold">Titular</dt><dd className="break-all">{status.subjectName}</dd></div><div><dt className="font-semibold">Emissor</dt><dd className="break-all">{status.issuerName}</dd></div><div><dt className="font-semibold">Serial</dt><dd className="break-all">{status.serialNumber}</dd></div><div><dt className="font-semibold">SHA-256</dt><dd className="break-all">{status.fingerprintSha256}</dd></div></dl>}{status?.alert && <p className="mt-3 font-semibold text-amber-800">Atenção: certificado {status.daysRemaining! < 0 ? 'vencido' : `vence em ${status.daysRemaining} dia(s)`}.</p>}</div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Arquivo A1 (.pfx ou .p12)<input ref={fileRef} type="file" accept=".pfx,.p12,application/x-pkcs12" disabled={!!busy} className="mt-1 block w-full rounded-lg border p-2 text-sm" onChange={event => setFile(event.target.files?.[0] || null)} /></label><label className="text-sm font-semibold">Senha do certificado<input type="password" autoComplete="new-password" disabled={!!busy} className="mt-1 w-full rounded-lg border p-2" value={password} onChange={event => setPassword(event.target.value)} /><span className="text-xs font-normal text-slate-500">Usada somente nesta operação.</span></label></div>
    <div className="flex flex-wrap gap-3"><button type="button" disabled={!!busy || loading || !file} onClick={upload} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Upload size={17}/>{busy === 'upload' ? 'Instalando…' : status?.installed ? 'Atualizar certificado' : 'Instalar certificado'}</button><button type="button" disabled={!!busy || !status?.installed} onClick={exportPfx} className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"><Download size={17}/>Exportar certificado</button></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Validade<input type="date" disabled={loading || !!status?.installed} className="mt-1 w-full rounded-lg border p-2 disabled:bg-slate-100" value={validUntil} onChange={event => setValidUntil(event.target.value)} /></label><label className="text-sm font-semibold">Mostrar pop-up com antecedência de<input type="number" min={1} max={365} disabled={loading} className="mt-1 w-full rounded-lg border p-2" value={alertDays} onChange={event => setAlertDays(Number(event.target.value))} /><span className="text-xs text-slate-500">dias antes do vencimento</span></label></div>
    <button type="button" disabled={!!busy || loading || !selectedCompany} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><BellRing size={17}/>Salvar configuração</button>
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><h3 className="font-semibold text-blue-950">Teste de comunicação SEFAZ-PE</h3><p className="mt-1 text-sm text-blue-900">Executa consulta real de status com autenticação mTLS pelo certificado instalado. Homologação não produz efeito fiscal.</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={!!busy || !status?.installed} onClick={() => testSefaz('homologation')} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><PlugZap size={17}/>Testar homologação</button><button type="button" disabled={!!busy || !status?.installed} onClick={() => testSefaz('production')} className="inline-flex items-center gap-2 rounded-lg border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"><PlugZap size={17}/>Testar produção</button></div>{status?.sefaz && <p className={`mt-3 text-sm font-semibold ${status.sefaz.operational ? 'text-emerald-800' : 'text-amber-800'}`}>{status.sefaz.environment === 'production' ? 'Produção' : 'Homologação'} · {status.sefaz.cStat} — {status.sefaz.reason} · {new Date(status.sefaz.checkedAt).toLocaleString('pt-BR')}</p>}</div>
    {status?.installed && <div className="rounded-xl border border-red-200 p-4"><h3 className="font-semibold text-red-800">Excluir do servidor</h3><p className="mt-1 text-xs text-slate-600">Informe a senha acima e digite o CNPJ <strong>{selectedCompany?.cnpj}</strong>. A cópia local ou backup externo não será alterada.</p><div className="mt-3 flex flex-wrap gap-3"><input aria-label="Confirmação do CNPJ" className="min-w-64 rounded-lg border p-2 text-sm" placeholder="Digite o CNPJ para confirmar" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} /><button type="button" disabled={!!busy || !deleteConfirmation} onClick={remove} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Trash2 size={17}/>Excluir certificado</button></div></div>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
  </section>;
}
