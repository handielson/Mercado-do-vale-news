import React from 'react';
import { ExternalLink, Power, RefreshCw, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { print3dStorefrontSettingsService, type Print3dStorefrontSettings } from '../../../services/print3dStorefrontSettings';

const DEFAULT_MESSAGE = 'Estamos preparando novidades e melhorias. A 3DMV volta em breve.';

export default function Print3dSettingsPage() {
  const [settings, setSettings] = React.useState<Print3dStorefrontSettings | null>(null);
  const [message, setMessage] = React.useState(DEFAULT_MESSAGE);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    try {
      const value = await print3dStorefrontSettingsService.admin();
      setSettings(value);
      setMessage(value.maintenance_message || DEFAULT_MESSAGE);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar as configurações da 3DMV.');
    } finally { setBusy(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function save(active: boolean) {
    if (message.trim().length < 10) return toast.error('Escreva uma mensagem com pelo menos 10 caracteres.');
    setBusy(true);
    try {
      const value = await print3dStorefrontSettingsService.save({ maintenance_mode: active, maintenance_message: message.trim() });
      setSettings(value);
      setMessage(value.maintenance_message);
      toast.success(active ? 'A 3DMV foi colocada em manutenção.' : 'A 3DMV foi reaberta ao público.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível alterar o estado da loja.');
    } finally { setBusy(false); }
  }

  const active = Boolean(settings?.maintenance_mode);
  return <div className="mx-auto max-w-4xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.22em] text-violet-700">3DMV</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Configurações do site</h1><p className="mt-2 text-sm text-slate-600">Controle a disponibilidade pública sem alterar o Mercado do Vale.</p></div>
      <a href="https://www.3dmv.com.br/loja-3d" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800">Abrir site <ExternalLink size={16} /></a>
    </header>
    <section className={`rounded-2xl border p-6 shadow-sm ${active ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><span className={`flex h-12 w-12 items-center justify-center rounded-xl ${active ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{active ? <Wrench /> : <Power />}</span><div><h2 className="font-bold text-slate-900">{active ? 'Site em manutenção' : 'Site aberto ao público'}</h2><p className="text-sm text-slate-600">{active ? 'Os clientes veem somente a página de manutenção.' : 'Catálogo, produtos e área do cliente estão disponíveis.'}</p></div></div>
        <button type="button" disabled={busy || !settings} onClick={() => save(!active)} className={`rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50 ${active ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>{busy ? 'Salvando…' : active ? 'Reabrir site' : 'Colocar em manutenção'}</button>
      </div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <label htmlFor="maintenance-message" className="font-bold text-slate-900">Mensagem para os clientes</label>
      <p className="mt-1 text-sm text-slate-500">Este texto aparecerá enquanto a manutenção estiver ativa.</p>
      <textarea id="maintenance-message" rows={4} maxLength={500} value={message} onChange={event => setMessage(event.target.value)} className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
      <div className="mt-4 flex items-center justify-between gap-4"><span className="text-xs text-slate-500">{message.length}/500 caracteres</span><button type="button" disabled={busy || !settings} onClick={() => save(active)} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={16} /> Salvar mensagem</button></div>
    </section>
  </div>;
}
