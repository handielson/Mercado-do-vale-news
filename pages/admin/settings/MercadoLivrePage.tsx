import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { mercadoLivreService, type MercadoLivrePrintJob, type MercadoLivreStatus } from '../../../services/mercadoLivreService';

const statusLabels: Record<string, string> = {
  awaiting_dce: 'Aguardando DC-e', ready: 'Pronta para imprimir', printing: 'Imprimindo',
  printed: 'Impressa', intervention: 'Requer atencao',
};

export default function MercadoLivrePage() {
  const [status, setStatus] = useState<MercadoLivreStatus | null>(null);
  const [jobs, setJobs] = useState<MercadoLivrePrintJob[]>([]);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const current = await mercadoLivreService.getStatus();
      setStatus(current);
      setClientId(current.clientId || '');
      if (current.connected) setJobs((await mercadoLivreService.getPrintJobs()).items || []);
    } catch (error) {
      console.error(error);
      toast.error('Nao foi possivel carregar a integracao Mercado Livre.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('connected') === '1') {
      toast.success('Conta do Mercado Livre conectada.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    void reload();
  }, []);

  async function save() {
    setBusy(true);
    try {
      const updated = await mercadoLivreService.updateSettings({
        clientId: clientId.trim(), ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
      });
      setStatus(updated); setClientSecret('');
      toast.success('Credenciais salvas sem expor o segredo.');
    } catch (error) { console.error(error); toast.error('Falha ao salvar as credenciais.'); }
    finally { setBusy(false); }
  }

  async function connect() {
    setBusy(true);
    try { window.location.href = (await mercadoLivreService.getAuthorizationUrl()).url; }
    catch (error) { console.error(error); toast.error('Falha ao iniciar a autorizacao.'); setBusy(false); }
  }

  async function toggle(field: 'autoDceEnabled' | 'stockSyncEnabled', value: boolean) {
    if (field === 'autoDceEnabled' && value && !window.confirm('Ativar a emissao automatica de DC-e para pedidos pessoa fisica?')) return;
    try { setStatus(await mercadoLivreService.updateSettings({ [field]: value })); }
    catch (error) { console.error(error); toast.error('Nao foi possivel alterar esta automacao.'); }
  }

  if (loading) return <div className="flex min-h-80 items-center justify-center text-slate-500"><Loader2 className="mr-2 animate-spin" />Carregando Mercado Livre...</div>;

  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Marketplace</p>
        <h1 className="text-2xl font-bold text-slate-900">Mercado Livre</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Integração independente para a outra conta de vendedor pessoa física: DC-e, etiqueta 10x15 automática e estoque comandado pelo Bling.</p></div>
      <div className={`rounded-lg border px-4 py-3 text-sm ${status?.connected ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        <span className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} />{status?.connected ? `Conectado: ${status.nickname || status.userId}` : status?.configured ? 'Credenciais prontas' : 'Pendente'}</span>
      </div>
    </header>

    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Aplicativo e OAuth</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Client ID<input className="mt-1 w-full rounded-lg border px-3 py-2" value={clientId} onChange={e => setClientId(e.target.value)} /></label>
          <label className="text-sm font-medium text-slate-700">Client Secret<input type="password" autoComplete="new-password" className="mt-1 w-full rounded-lg border px-3 py-2" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder={status?.configured ? 'Deixe vazio para manter' : ''} /></label>
        </div>
        <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <p><strong>Conta autorizada:</strong> {status?.connected ? `${status.nickname || '-'} (ID ${status.userId || '-'})` : 'nenhuma'}</p>
          <p><strong>Redirect URL:</strong> {status?.redirectUrl}</p><p><strong>Webhook:</strong> {status?.webhookUrl}</p>
          <p>Ao conectar, entre na conta de vendedor correta do Mercado Livre. Ela não reutiliza a conta do Mercado Pago cadastrada no sistema.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><Save size={16} />Salvar</button>
          <button onClick={connect} disabled={busy || !status?.configured} className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"><ExternalLink size={16} />Conectar conta</button>
        </div>
      </section>

      <aside className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Automações</h2>
        <label className="mt-4 flex items-start gap-3"><input type="checkbox" className="mt-1" checked={Boolean(status?.autoDceEnabled)} disabled={!status?.connected} onChange={e => toggle('autoDceEnabled', e.target.checked)} /><span><strong className="block text-sm">Emitir DC-e automaticamente</strong><small className="text-slate-500">Necessaria antes da etiqueta para conta PF.</small></span></label>
        <label className="mt-4 flex items-start gap-3"><input type="checkbox" className="mt-1" checked={Boolean(status?.stockSyncEnabled)} disabled={!status?.connected} onChange={e => toggle('stockSyncEnabled', e.target.checked)} /><span><strong className="block text-sm">Enviar estoque do Bling</strong><small className="text-slate-500">Usa a baixa fisica recebida pelo webhook existente.</small></span></label>
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">A venda do Mercado Livre nao baixa o estoque local diretamente. O Bling faz a movimentacao e o webhook replica o saldo final, evitando baixa dupla.</p>
      </aside>
    </div>

    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Fila de etiquetas</h2><button onClick={reload} className="inline-flex items-center gap-2 text-sm text-slate-600"><RefreshCw size={15} />Atualizar</button></div>
      {!jobs.length ? <p className="text-sm text-slate-500">Nenhuma remessa recebida.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Pedido</th><th>Remessa</th><th>Status</th><th>Rastreio</th></tr></thead><tbody>{jobs.map(job => <tr key={job.shipment_id} className="border-b last:border-0"><td className="py-3">{job.order_id}</td><td>{job.shipment_id}</td><td>{statusLabels[job.status] || job.status}{job.last_error ? <div className="max-w-md text-xs text-red-600">{job.last_error}</div> : null}</td><td>{job.tracking_number || '-'}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
