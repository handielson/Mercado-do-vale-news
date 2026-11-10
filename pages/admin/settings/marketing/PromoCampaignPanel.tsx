import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, Copy, Download, ImageIcon, Instagram, Loader2, MessageCircle, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { promoCampaignService, type PromoCampaign, type PromoCampaignOverview } from '../../../../services/promoCampaignService';
import { socialStoryScheduleService, type PhonePriceListPreview, type SocialStoryDestination } from '../../../../services/socialStoryScheduleService';
import { prepareSocialStoryScheduleDates } from '../../../../services/socialStoryScheduleTime.js';
import { toBrowserSafeMediaUrl } from '../../../../utils/media-url';
import MultiDateCalendar from './MultiDateCalendar';

const HEADLINE_EXAMPLES = ['🔥 BLACK FRIDAY MERCADO DO VALE 🔥', '💐 OFERTAS DO DIA DAS MÃES', '🎄 NATAL COM PREÇO DE PRESENTE'];
const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const dateTime = (value: string | null) => value
  ? new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : null;
const localDateKey = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const emptyCampaign: PromoCampaign = { headline: '', footer: '', media_url: null, media_type: null };

export default function PromoCampaignPanel() {
  const [overview, setOverview] = useState<PromoCampaignOverview | null>(null);
  const [form, setForm] = useState<PromoCampaign>(emptyCampaign);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<PhonePriceListPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [time, setTime] = useState('09:00');
  const [dates, setDates] = useState<string[]>(() => [localDateKey()]);
  const [destinations, setDestinations] = useState<SocialStoryDestination[]>(['whatsapp']);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await promoCampaignService.get();
      setOverview(data);
      setForm({ ...emptyCampaign, ...data.campaign });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar a campanha');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const saved = overview?.campaign;
  const dirty = !!saved && (saved.headline !== form.headline || saved.footer !== form.footer
    || saved.media_url !== form.media_url || saved.media_type !== form.media_type);

  const save = async (next: PromoCampaign = form) => {
    if (!next.headline.trim()) { toast.error('Escreva o título da primeira linha.'); return false; }
    setSaving(true);
    try {
      const data = await promoCampaignService.save(next);
      setOverview(data);
      setForm({ ...emptyCampaign, ...data.campaign });
      setPreview(null);
      toast.success('Campanha salva');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar');
      return false;
    } finally { setSaving(false); }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploadProgress(1);
    try {
      const media = await promoCampaignService.uploadMedia(file, setUploadProgress);
      setForm((current) => ({ ...current, media_url: media.url, media_type: media.type }));
      toast.success('Mídia enviada. Clique em Salvar campanha para usar.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao enviar a mídia');
    } finally {
      setUploadProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const copyText = async () => {
    if (!overview) return;
    if (dirty) { toast.error('Salve a campanha antes de copiar, para o texto sair atualizado.'); return; }
    try { await navigator.clipboard.writeText(overview.whatsapp.text); toast.success('Texto copiado'); }
    catch { toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.'); }
  };

  const generatePreview = async () => {
    if (dirty && !(await save())) return;
    setPreviewing(true);
    try {
      const result = await promoCampaignService.previewStories();
      setPreview(result);
      result.warnings.forEach((warning) => toast.warning(warning));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar os stories');
    } finally { setPreviewing(false); }
  };

  const schedule = async () => {
    if (dirty && !(await save())) return;
    if (!dates.length || !destinations.length) { toast.error('Escolha os dias e onde publicar.'); return; }
    const plan = prepareSocialStoryScheduleDates(dates, time);
    if (plan.invalid) { toast.error('Há um dia ou horário inválido.'); return; }
    if (plan.past?.instant) { toast.error(`O horário ${plan.past.instant.toLocaleString('pt-BR')} já passou.`); return; }
    setScheduling(true);
    try {
      const scheduledDates = plan.entries.flatMap(({ instant }: { instant: Date | null }) => (instant ? [instant.toISOString()] : []));
      const result = await socialStoryScheduleService.create({
        title: `Promoção: ${form.headline}`.slice(0, 250),
        sourceType: 'standalone',
        scheduledAt: scheduledDates[0], scheduledDates, destinations,
        phonePriceList: { kind: 'promo' },
      });
      toast.success(`Aprovação criada para ${result.dayCount} dia(s). Os cards são refeitos na hora de publicar.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível agendar');
    } finally { setScheduling(false); }
  };

  const toggleDestination = (destination: SocialStoryDestination) => setDestinations((current) =>
    current.includes(destination) ? current.filter((item) => item !== destination) : [...current, destination]);

  if (loading && !overview) {
    return <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando campanha…</div>;
  }

  const products = overview?.products || [];
  const whatsapp = overview?.whatsapp;
  const mediaUrl = form.media_url ? toBrowserSafeMediaUrl(form.media_url) : null;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-lg font-black text-slate-900">Campanha</h3>
          <p className="mt-1 text-sm text-slate-500">Troque o título conforme a época. Os produtos entram sozinhos quando a promoção deles começa e saem quando termina.</p>
        </div>
        <label className="block text-xs font-bold text-slate-600">Título da primeira linha
          <input value={form.headline} maxLength={120} onChange={(event) => setForm({ ...form, headline: event.target.value })}
            placeholder={HEADLINE_EXAMPLES[0]} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base font-bold text-slate-900" />
        </label>
        <div className="flex flex-wrap gap-2">
          {HEADLINE_EXAMPLES.map((example) => <button key={example} type="button" onClick={() => setForm({ ...form, headline: example })}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:border-red-300 hover:bg-red-50">{example}</button>)}
        </div>
        <label className="block text-xs font-bold text-slate-600">Rodapé (opcional)
          <textarea value={form.footer} maxLength={300} rows={2} onChange={(event) => setForm({ ...form, footer: event.target.value })}
            placeholder="Ex.: Parcelamos em até 12x • Válido enquanto durar o estoque" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <div className="rounded-xl border border-dashed border-slate-300 p-4">
          <p className="text-xs font-bold text-slate-600">Mídia da campanha (vai junto com o texto no WhatsApp)</p>
          {mediaUrl ? (
            <div className="mt-3 space-y-2">
              {form.media_type === 'video'
                ? <video src={mediaUrl} controls className="max-h-64 w-full rounded-lg bg-black object-contain" />
                : <img src={mediaUrl} alt="Mídia da campanha" className="max-h-64 w-full rounded-lg bg-slate-50 object-contain" />}
              <div className="flex flex-wrap gap-2">
                <a href={mediaUrl} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-3.5 w-3.5" />Baixar</a>
                <button type="button" onClick={() => setForm({ ...form, media_url: null, media_type: null })} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Remover</button>
              </div>
            </div>
          ) : <p className="mt-2 flex items-center gap-2 text-xs text-slate-400"><ImageIcon className="h-4 w-4" />Nenhuma mídia. Imagem (PNG/JPG/WEBP) ou vídeo MP4.</p>}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
          <button type="button" disabled={uploadProgress !== null} onClick={() => fileRef.current?.click()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
            {uploadProgress !== null ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando {uploadProgress}%</> : <><Upload className="h-4 w-4" />{mediaUrl ? 'Trocar mídia' : 'Enviar mídia'}</>}
          </button>
        </div>
        <button type="button" disabled={saving || !dirty} onClick={() => void save()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{dirty ? 'Salvar campanha' : 'Campanha salva'}
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">Em promoção agora ({products.length})</h3>
            <p className="mt-1 text-sm text-slate-500">Ativos, com estoque e dentro do período. Para incluir um produto, defina preço promocional e datas na Página do Produto.</p>
          </div>
          <button type="button" onClick={() => void load()} title="Atualizar" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        {products.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum produto com promoção ativa e estoque neste momento.</p> : (
          <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100">
            {products.map((product) => {
              const off = Math.round((1 - product.promoCents / product.retailCents) * 100);
              return <li key={product.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.sku}{product.stock !== null ? ` · ${product.stock} em estoque` : ''}{product.promoEnd ? ` · até ${dateTime(product.promoEnd)}` : ' · sem data de fim'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-400 line-through">{money(product.retailCents)}</p>
                  <p className="text-sm font-black text-red-600">{money(product.promoCents)} <span className="rounded bg-red-50 px-1 text-[10px]">-{off}%</span></p>
                </div>
              </li>;
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><MessageCircle className="h-5 w-5 text-emerald-600" />Mensagem do WhatsApp</h3>
        <p className="text-sm text-slate-500">Mande a mídia da campanha com este texto como legenda (transmissão, grupos ou atendimento).</p>
        <textarea readOnly value={whatsapp?.text || ''} rows={14} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-xs ${whatsapp && !whatsapp.fitsMediaCaption ? 'font-bold text-amber-700' : 'text-slate-400'}`}>
            {whatsapp?.length || 0} caracteres{whatsapp && !whatsapp.fitsMediaCaption ? ' — passa de 1.024: mande a mídia e depois o texto em mensagem separada' : ''}
          </p>
          <button type="button" disabled={!products.length || !form.headline} onClick={() => void copyText()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><Copy className="h-4 w-4" />Copiar texto</button>
        </div>
        {dirty && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Há alterações não salvas: o texto acima ainda é o da versão salva.</p>}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><Instagram className="h-5 w-5 text-pink-600" />Stories</h3>
            <p className="mt-1 text-sm text-slate-500">Cards “de / por” com o título no topo. No agendamento, são refeitos na hora de publicar com as promoções daquele momento.</p>
          </div>
          <button type="button" disabled={previewing || !products.length} onClick={() => void generatePreview()} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}Gerar prévia
          </button>
        </div>
        {preview && (preview.items.length
          ? <div className="grid grid-cols-3 gap-2">{preview.items.map((item) => <a key={item.mediaUrl} href={toBrowserSafeMediaUrl(item.mediaUrl)} target="_blank" rel="noreferrer" title={item.label}><img src={toBrowserSafeMediaUrl(item.mediaUrl)} alt={item.label} className="w-full rounded-lg border border-slate-200" /></a>)}</div>
          : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Nenhum produto em promoção para gerar cards.</p>)}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">Horário
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <div className="text-xs font-bold text-slate-600">Onde publicar
            <div className="mt-1 flex gap-2">
              {(['whatsapp', 'instagram'] as SocialStoryDestination[]).map((destination) => <button key={destination} type="button" aria-pressed={destinations.includes(destination)} onClick={() => toggleDestination(destination)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${destinations.includes(destination) ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500'}`}>{destination === 'whatsapp' ? 'Status WhatsApp' : 'Instagram'}</button>)}
            </div>
          </div>
        </div>
        <MultiDateCalendar value={dates} onChange={setDates} minDate={localDateKey()} maxSelected={30} label="Escolha os dias" />
        <button type="button" disabled={scheduling || !products.length || !form.headline} onClick={() => void schedule()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
          {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}Agendar stories (vai para Aprovações)
        </button>
      </section>
    </div>
  );
}
