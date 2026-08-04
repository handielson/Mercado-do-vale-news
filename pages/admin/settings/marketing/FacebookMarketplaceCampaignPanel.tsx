import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Check, Chrome, Clock3, Loader2, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { catalogService } from '../../../../services/catalogService';
import {
  facebookMarketplaceCampaignService,
  type FacebookMarketplaceCampaign,
  type FacebookMarketplaceCampaignInput,
  type FacebookMarketplaceGroup,
} from '../../../../services/facebookMarketplaceCampaignService';
import type { FacebookMarketplaceDestination } from '../../../../services/facebookMarketplaceScheduleService';

const DEFAULT_TEMPLATE = '{produto}\n\nPreço: {preco}\nDisponível em estoque.\n\n{link}\nChame no WhatsApp para confirmar a disponibilidade.';

const defaultForm = (): FacebookMarketplaceCampaignInput => ({
  title: 'Smartphones em estoque',
  category_id: '',
  min_stock: 1,
  interval_minutes: 180,
  republish_cooldown_hours: 168,
  daily_limit: 4,
  start_time: '08:00',
  end_time: '20:00',
  destinations: [{ name: 'Facebook Marketplace', type: 'marketplace' }],
  description_template: DEFAULT_TEMPLATE,
  active: true,
});

function destinationList(value: FacebookMarketplaceCampaign['destinations']): FacebookMarketplaceDestination[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function formatDate(value?: string | null) {
  if (!value) return 'ao iniciar o ciclo';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export default function FacebookMarketplaceCampaignPanel({ onGenerated }: { onGenerated?: () => void }) {
  const [campaigns, setCampaigns] = useState<FacebookMarketplaceCampaign[]>([]);
  const [groups, setGroups] = useState<FacebookMarketplaceGroup[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupUrl, setGroupUrl] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [campaignRows, groupRows, categoryRows] = await Promise.all([
        facebookMarketplaceCampaignService.listCampaigns(),
        facebookMarketplaceCampaignService.listGroups(),
        catalogService.getCategoriesWithNames(),
      ]);
      setCampaigns(campaignRows);
      setGroups(groupRows);
      setCategories(categoryRows);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar as campanhas do Facebook.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.source !== window || event.data?.type !== 'MDV_FACEBOOK_GROUPS_RESULT') return;
      setSyncing(false);
      const received = Array.isArray(event.data.groups) ? event.data.groups : [];
      if (!received.length) return toast.error(event.data.error || 'Nenhum grupo visível foi encontrado na conta aberta.');
      let imported = 0;
      for (const item of received) {
        const name = String(item?.name || '').trim();
        const url = String(item?.url || '').trim();
        if (!name || !url || groups.some((group) => group.url === url)) continue;
        try { await facebookMarketplaceCampaignService.createGroup({ name, url, source: 'chrome' }); imported += 1; } catch { /* duplicado */ }
      }
      await load();
      toast.success(`${imported} grupo(s) importado(s) da conta do Facebook.`);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [groups]);

  const selectedUrls = useMemo(() => new Set(destinationList(form.destinations).filter((item) => item.type === 'group').map((item) => item.url)), [form.destinations]);
  const marketplaceSelected = destinationList(form.destinations).some((item) => item.type === 'marketplace');

  const openNew = () => {
    const next = defaultForm();
    next.category_id = categories.find((item) => /^smartphones?$/i.test(item.name.trim()))?.id
      || categories.find((item) => /smartphone|celular/i.test(item.name))?.id
      || '';
    setForm(next); setEditingId(null); setShowForm(true);
  };

  const edit = (campaign: FacebookMarketplaceCampaign) => {
    setEditingId(campaign.id);
    setForm({
      title: campaign.title, category_id: campaign.category_id, min_stock: campaign.min_stock,
      interval_minutes: campaign.interval_minutes, republish_cooldown_hours: campaign.republish_cooldown_hours,
      daily_limit: campaign.daily_limit, start_time: String(campaign.start_time).slice(0, 5), end_time: String(campaign.end_time).slice(0, 5),
      destinations: destinationList(campaign.destinations), description_template: campaign.description_template || DEFAULT_TEMPLATE,
      active: Boolean(campaign.active),
    });
    setShowForm(true);
  };

  const toggleDestination = (destination: FacebookMarketplaceDestination) => {
    const current = destinationList(form.destinations);
    const exists = destination.type === 'marketplace'
      ? current.some((item) => item.type === 'marketplace')
      : current.some((item) => item.type === 'group' && item.url === destination.url);
    setForm({ ...form, destinations: exists ? current.filter((item) => destination.type === 'marketplace' ? item.type !== 'marketplace' : item.url !== destination.url) : [...current, destination] });
  };

  const save = async () => {
    if (!form.title.trim() || !form.category_id) return toast.error('Informe o nome e a categoria da campanha.');
    if (!destinationList(form.destinations).length) return toast.error('Selecione pelo menos um destino.');
    setSaving(true);
    try {
      const payload = { ...form, title: form.title.trim(), destinations: destinationList(form.destinations) };
      if (editingId) await facebookMarketplaceCampaignService.updateCampaign(editingId, payload);
      else await facebookMarketplaceCampaignService.createCampaign(payload);
      setShowForm(false); await load(); onGenerated?.();
      toast.success(editingId ? 'Campanha atualizada.' : 'Campanha automática criada.');
    } catch (error) { console.error(error); toast.error('Erro ao salvar a campanha.'); }
    finally { setSaving(false); }
  };

  const addGroup = async () => {
    if (!groupName.trim() || !/^https?:\/\/(?:www\.)?facebook\.com\/groups\//i.test(groupUrl.trim())) return toast.error('Informe o nome e uma URL válida de grupo do Facebook.');
    try {
      await facebookMarketplaceCampaignService.createGroup({ name: groupName.trim(), url: groupUrl.trim(), source: 'manual' });
      setGroupName(''); setGroupUrl(''); await load(); toast.success('Grupo adicionado.');
    } catch { toast.error('Esse grupo já existe ou não pôde ser salvo.'); }
  };

  const requestChromeGroups = () => {
    setSyncing(true);
    window.postMessage({ type: 'MDV_FACEBOOK_GROUPS_REQUEST' }, window.location.origin);
    window.setTimeout(() => setSyncing((current) => { if (current) toast.error('Extensão do Mercado do Vale não detectada. Instale-a no Chrome e tente novamente.'); return false; }), 5000);
  };

  return (
    <div className="border-b border-slate-100 bg-slate-50/70 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="flex items-center gap-2 font-black text-slate-900"><Bot className="h-5 w-5 text-blue-600" /> Campanhas automáticas assistidas</h3><p className="mt-1 text-xs text-slate-500">O sistema gira produtos com estoque; você só conclui a publicação no Facebook.</p></div>
        <button onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Nova campanha</button>
      </div>
      {loading ? <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div> : campaigns.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">Crie uma campanha, escolha “Smartphones” e defina os intervalos.</div> : <div className="grid gap-3 lg:grid-cols-2">{campaigns.map((campaign) => <button type="button" key={campaign.id} onClick={() => edit(campaign)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-300"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{campaign.title}</p><p className="mt-1 text-xs text-slate-500">A cada {campaign.interval_minutes} min · repetir após {campaign.republish_cooldown_hours}h · limite {campaign.daily_limit}/dia</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${campaign.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{campaign.active ? 'ATIVA' : 'PAUSADA'}</span></div><p className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-700"><Clock3 className="h-3.5 w-3.5" /> Próxima seleção: {formatDate(campaign.next_run_at)}</p>{campaign.last_error && <p className="mt-2 text-xs text-amber-700">{campaign.last_error}</p>}</button>)}</div>}

      {showForm && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4"><div><h3 className="font-black">{editingId ? 'Editar campanha' : 'Nova campanha automática'}</h3><p className="text-xs text-slate-500">Categoria, frequência e prazo de republicação</p></div><button onClick={() => setShowForm(false)}><X className="h-5 w-5" /></button></div><div className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-black uppercase text-slate-500">Nome<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal normal-case text-slate-900" /></label><label className="text-xs font-black uppercase text-slate-500">Categoria<select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal normal-case text-slate-900"><option value="">Selecione...</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
        <div className="grid gap-4 sm:grid-cols-4"><label className="text-xs font-black uppercase text-slate-500">Estoque mínimo<input type="number" min="1" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><label className="text-xs font-black uppercase text-slate-500">Intervalo (min)<input type="number" min="15" value={form.interval_minutes} onChange={(e) => setForm({ ...form, interval_minutes: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><label className="text-xs font-black uppercase text-slate-500">Repetir após (h)<input type="number" min="1" value={form.republish_cooldown_hours} onChange={(e) => setForm({ ...form, republish_cooldown_hours: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><label className="text-xs font-black uppercase text-slate-500">Limite/dia<input type="number" min="1" value={form.daily_limit} onChange={(e) => setForm({ ...form, daily_limit: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-black uppercase text-slate-500">Começar<input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><label className="text-xs font-black uppercase text-slate-500">Encerrar<input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label></div>
        <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label className="text-xs font-black uppercase text-slate-500">Destinos — selecione um ou vários</label><button onClick={requestChromeGroups} disabled={syncing} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-bold text-blue-700"><Chrome className="h-3.5 w-3.5" />{syncing ? 'Buscando...' : 'Puxar da conta aberta'}</button></div><div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border p-3"><button onClick={() => toggleDestination({ name: 'Facebook Marketplace', type: 'marketplace' })} className={`flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm ${marketplaceSelected ? 'bg-blue-50 font-bold text-blue-800' : 'hover:bg-slate-50'}`}><span className={`grid h-5 w-5 place-items-center rounded border ${marketplaceSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>{marketplaceSelected && <Check className="h-3.5 w-3.5" />}</span>Facebook Marketplace</button>{groups.map((group) => { const selected = selectedUrls.has(group.url); return <div key={group.id} onClick={() => toggleDestination({ name: group.name, url: group.url, type: 'group' })} className={`flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left text-sm ${selected ? 'bg-blue-50 font-bold text-blue-800' : 'hover:bg-slate-50'}`}><span className={`grid h-5 w-5 place-items-center rounded border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>{selected && <Check className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1 truncate">{group.name}</span><button onClick={(event) => { event.stopPropagation(); void facebookMarketplaceCampaignService.deleteGroup(group.id).then(load); }} className="text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div>; })}</div><div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nome do grupo" className="rounded-lg border px-3 py-2 text-xs" /><input value={groupUrl} onChange={(e) => setGroupUrl(e.target.value)} placeholder="https://facebook.com/groups/..." className="rounded-lg border px-3 py-2 text-xs" /><button onClick={() => void addGroup()} className="rounded-lg border px-3 py-2 text-xs font-bold">Adicionar</button></div></div>
        <label className="block text-xs font-black uppercase text-slate-500">Modelo da descrição<textarea rows={6} value={form.description_template || ''} onChange={(e) => setForm({ ...form, description_template: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal normal-case" /><span className="font-normal normal-case text-slate-400">Campos: {'{produto} {preco} {estoque} {link} {sku}'}</span></label>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={Boolean(form.active)} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Campanha ativa</label>
      </div><div className="sticky bottom-0 flex justify-between border-t bg-white px-6 py-4"><div>{editingId && <button onClick={() => { if (confirm('Excluir esta campanha?')) void facebookMarketplaceCampaignService.deleteCampaign(editingId).then(() => { setShowForm(false); return load(); }); }} className="text-xs font-bold text-red-600">Excluir campanha</button>}</div><div className="flex gap-2"><button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600">Cancelar</button><button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</button></div></div></div></div>}
    </div>
  );
}
