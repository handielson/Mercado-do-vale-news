// model-version-financials-v1: custo, preço praticado e lucro POR VERSÃO na Página do Produto.
// Fonte única: grupo de preço do celular (o mesmo da Gestão de Modelos e do cadastro da família).
// Editar aqui grava no mesmo grupo (PUT /models/:id/smartphone-price-groups/:groupId), com conferência de revisão.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, ImageIcon, Loader2, Pencil, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '../ui/CurrencyInput';
import { ModelPricesPanel } from '../settings/ModelPricesPanel';
import { smartphonePriceGroups, type SmartphonePriceGroup, type SmartphoneSalePrices } from '../../services/smartphonePriceGroups';
import { buildVersionFinancials, SALE_TIERS, validatePromo, validateSalePrices } from '../../utils/modelVersionFinancials.js';
import { bannerService } from '../../services/bannerService';
import { buildPromoMediaPrompt, promoMediaSizeLabel } from '../../utils/promoMediaPrompt.js';
import { EMPTY_PROMO_MEDIA, loadPromoMedia, removePromoBanner, savePromoMedia, saveProductsPromo, syncPromoBanner, uploadPromoFile, upsertPromoBanner, type PromoMedia } from '../../services/productPromo';

const money = (cents: number | null | undefined) => cents === null || cents === undefined ? '—'
  : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (value: number | undefined) => value === undefined ? '' : `${value.toLocaleString('pt-BR')}%`;

// Campo datetime-local mostra o horário da loja; o valor salvo é ISO em UTC (igual ao formulário do produto).
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const fromLocalInput = (value: string) => value ? new Date(value).toISOString() : null;
const shortDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const PROMO_STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: 'Ativa', tone: 'bg-emerald-100 text-emerald-800' },
  scheduled: { label: 'Agendada', tone: 'bg-blue-100 text-blue-800' },
  expired: { label: 'Encerrada', tone: 'bg-slate-200 text-slate-600' },
  invalid: { label: 'Não vale (não é menor que o varejo)', tone: 'bg-amber-100 text-amber-800' },
};

type Row = ReturnType<typeof buildVersionFinancials>[number];

const MEDIA_SLOTS = [
  // Tamanhos: imagem no formato de post (4:5) do Instagram/WhatsApp; vídeo vertical (9:16) de Status/Reels;
  // banner no formato do carrossel da home (aspect-[21/9] em BannerCarousel.tsx).
  { key: 'image_url', label: 'Imagem da promoção', hint: 'WhatsApp, Status, Instagram e bot', size: promoMediaSizeLabel('image'), accept: 'image/png,image/jpeg,image/webp,image/gif' },
  { key: 'video_url', label: 'Vídeo da promoção', hint: 'Status, Instagram e bot', size: promoMediaSizeLabel('video'), accept: 'video/mp4' },
  { key: 'banner', label: 'Banner da home', hint: 'Carrossel da página inicial, durante a promoção', size: promoMediaSizeLabel('banner'), accept: 'image/png,image/jpeg,image/webp,image/gif' },
] as const;

// promo-media-prompt-v1: prompt para a IA de imagem, montado na hora a partir da promoção atual da versão.
function PromoPromptBlock({ row, modelName }: { row: Row; modelName: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(() => buildPromoMediaPrompt({
    modelName, versionLabel: row.label, colors: row.colors, retailCents: row.prices?.price_retail ?? 0, promo: row.promo,
  }), [modelName, row.label, row.colors, row.prices?.price_retail, row.promo]);
  useEffect(() => { setCopied(false); }, [prompt]);
  if (!prompt) return null;
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(prompt);
      else {
        const area = document.createElement('textarea');
        area.value = prompt; area.style.position = 'fixed'; area.style.opacity = '0';
        document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
      }
      setCopied(true);
      toast.success('Prompt copiado. Cole na IA junto com a foto do produto.');
    } catch { toast.error('Não consegui copiar. Selecione o texto e copie manualmente.'); }
  };
  return (
    <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50/60 p-2" aria-label={`Prompt da promoção ${row.label}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(value => !value)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-800 hover:underline">
          <Sparkles className="h-3.5 w-3.5" /> Prompt para a IA criar as imagens {open ? '▴' : '▾'}
        </button>
        <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-md bg-violet-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-800">
          {copied ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar prompt</>}
        </button>
      </div>
      <p className="mt-0.5 text-[10px] text-violet-700/80">Atualiza sozinho com preço, desconto, datas e cores da promoção. Cole na IA e envie junto a foto do produto.</p>
      {open && <textarea readOnly value={prompt} rows={14} onFocus={event => event.currentTarget.select()} className="mt-1.5 w-full rounded border border-violet-200 bg-white p-2 font-mono text-[11px] leading-snug text-slate-700" />}
    </div>
  );
}

// promo-media-v1: imagem, vídeo e banner da promoção desta versão (mesma mídia em todas as cores).
function PromoMediaBlock({ row, modelName, media, promoActive, onMediaSaved }: { row: Row; modelName: string; media: PromoMedia & { banner_image_url?: string | null }; promoActive: boolean; onMediaSaved: () => void }) {
  const [draft, setDraft] = useState({ image_url: media.image_url, video_url: media.video_url, banner_image_url: media.banner_image_url || null });
  const [uploading, setUploading] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setDraft({ image_url: media.image_url, video_url: media.video_url, banner_image_url: media.banner_image_url || null }); }, [media.image_url, media.video_url, media.banner_image_url]);
  const field = (key: typeof MEDIA_SLOTS[number]['key']) => key === 'banner' ? 'banner_image_url' : key;
  const changed = draft.image_url !== media.image_url || draft.video_url !== media.video_url || draft.banner_image_url !== (media.banner_image_url || null);
  const upload = async (key: typeof MEDIA_SLOTS[number]['key'], file: File | undefined) => {
    if (!file) return;
    setUploading(key); setProgress(0); setError('');
    try {
      const result = await uploadPromoFile(file, setProgress);
      if (key === 'video_url' && result.type !== 'video') throw new Error('Envie o vídeo em MP4.');
      if (key !== 'video_url' && result.type !== 'image') throw new Error('Envie uma imagem (PNG, JPG, WEBP ou GIF).');
      setDraft(current => ({ ...current, [field(key)]: result.url }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o arquivo.'); }
    finally { setUploading(''); }
  };
  const save = async () => {
    setSaving(true); setError('');
    try {
      let bannerId = media.banner_id;
      if (draft.banner_image_url) {
        if (!row.publicUrl) throw new Error('Esta versão não tem página no site para o banner apontar.');
        bannerId = await upsertPromoBanner({ bannerId, title: `Promoção ${modelName} ${row.label}`.trim(), imageUrl: draft.banner_image_url,
          productUrl: row.publicUrl, start: row.promo?.start || null, end: row.promo?.end || null });
      } else if (bannerId) {
        await removePromoBanner(bannerId);
        bannerId = null;
      }
      await savePromoMedia(row.productIds, { image_url: draft.image_url, video_url: draft.video_url, banner_id: bannerId });
      toast.success(`${row.label}: mídia da promoção salva.`);
      onMediaSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a mídia.'); }
    finally { setSaving(false); }
  };
  const busy = saving || !!uploading;
  return (
    <div className="mt-2 rounded-lg border border-red-100 bg-white p-2.5" aria-label={`Mídia da promoção ${row.label}`}>
      <p className="text-xs font-semibold text-slate-800">Mídia da promoção</p>
      <PromoPromptBlock row={row} modelName={modelName} />
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {MEDIA_SLOTS.map(slot => {
          const url = draft[field(slot.key)];
          return (
            <div key={slot.key} className="rounded-lg border border-slate-200 p-2">
              <p className="text-[11px] font-semibold text-slate-700">{slot.label}</p>
              <p className="text-[10px] text-slate-400">{slot.hint}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-slate-600">📐 {slot.size}</p>
              <div className="mt-1.5 flex h-24 items-center justify-center overflow-hidden rounded bg-slate-50">
                {url ? (slot.key === 'video_url'
                  ? <video src={url} className="h-full w-full object-contain" muted controls preload="metadata" />
                  : <img src={url} alt={slot.label} className="h-full w-full object-contain" loading="lazy" />)
                  : <ImageIcon className="h-6 w-6 text-slate-300" />}
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <label className={`inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-red-700 ${busy ? 'pointer-events-none opacity-50' : 'hover:underline'}`}>
                  {uploading === slot.key ? <><Loader2 className="h-3 w-3 animate-spin" /> {slot.key === 'video_url' ? `${progress}%` : 'Enviando…'}</> : <><Upload className="h-3 w-3" /> {url ? 'Trocar' : 'Enviar'}</>}
                  <input type="file" accept={slot.accept} className="hidden" disabled={busy} onChange={event => { void upload(slot.key, event.target.files?.[0]); event.target.value = ''; }} />
                </label>
                {url && <button type="button" disabled={busy} onClick={() => setDraft(current => ({ ...current, [field(slot.key)]: null }))} className="text-[11px] text-slate-500 underline">Remover</button>}
              </div>
            </div>
          );
        })}
      </div>
      {draft.banner_image_url && !promoActive && <p className="mt-1 text-[11px] text-slate-500">O banner aparece na home só durante o período da promoção.</p>}
      {media.banner_id && <p className="mt-1 text-[11px] text-slate-400">O banner também aparece em Configurações → Banners.</p>}
      {changed && <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{saving ? 'Salvando…' : `Salvar mídia em todas as cores (${row.productIds.length})`}</button>
        <button type="button" disabled={busy} onClick={() => setDraft({ image_url: media.image_url, video_url: media.video_url, banner_image_url: media.banner_image_url || null })} className="text-xs text-slate-500 underline">Desfazer</button>
      </div>}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function PromoBlock({ row, onSaved, modelName, media, onMediaSaved }: { row: Row; onSaved: () => void; modelName: string; media: (PromoMedia & { banner_image_url?: string | null }) | null; onMediaSaved: () => void }) {
  const promo = row.promo;
  const retail = row.prices?.price_retail ?? 0;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ priceCents: 0, start: '', end: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const start = () => {
    setDraft({ priceCents: promo?.priceCents || 0, start: toLocalInput(promo?.start || null), end: toLocalInput(promo?.end || null) });
    setError(''); setEditing(true);
  };
  const write = async (value: { priceCents: number; start: string | null; end: string | null } | null) => {
    setSaving(true); setError('');
    try {
      const result = await saveProductsPromo(row.productIds, value);
      // O banner da home acompanha as datas da promoção (ou sai do ar quando ela é removida).
      if (!result.failed.length) await syncPromoBanner(media?.banner_id || null, value).catch(() => toast.warning('Promoção salva, mas não consegui atualizar o banner. Confira em Banners.'));
      if (result.failed.length) {
        setError(`Salvo em ${result.saved} de ${row.productIds.length} cor(es). Falhou: ${result.failed.map(item => item.error).join('; ')}`);
      } else {
        toast.success(value ? `${row.label}: promoção salva em ${result.saved} cor(es).` : `${row.label}: promoção removida.`);
        setEditing(false);
      }
      onSaved();
    } finally { setSaving(false); }
  };
  const save = () => {
    const value = { priceCents: draft.priceCents, start: fromLocalInput(draft.start), end: fromLocalInput(draft.end) };
    const invalid = validatePromo(value, retail);
    if (invalid) { setError(invalid); return; }
    void write(value);
  };
  const editingProfit = editing && draft.priceCents > 0 && row.costBaseCents !== null ? draft.priceCents - row.costBaseCents : null;
  const status = promo ? PROMO_STATUS[promo.status] : null;

  return (
    <div className="mt-3 rounded-lg border border-red-200 bg-red-50/60 p-2.5" aria-label={`Promoção ${row.label}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-800">🏷️ Promoção por tempo limitado
          {status && <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${status.tone}`}>{status.label}</span>}</p>
        {!editing && <div className="flex gap-3">
          <button type="button" onClick={start} disabled={!retail} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">{promo ? 'Editar promoção' : 'Criar promoção'}</button>
          {promo && <button type="button" disabled={saving} onClick={() => { if (window.confirm(`Remover a promoção de todas as cores de ${row.label}?`)) void write(null); }} className="text-xs text-slate-500 underline">Remover</button>}
        </div>}
      </div>
      {!editing && promo && <p className="mt-1 text-xs text-slate-700">
        <span className="text-slate-400 line-through">{money(retail)}</span> por <strong className="text-sm text-red-700">{money(promo.priceCents)}</strong>
        {promo.discountPct > 0 && <> (−{promo.discountPct}%)</>}
        {(promo.start || promo.end) && <> · {promo.start ? `de ${shortDate(promo.start)} ` : ''}{promo.end ? `até ${shortDate(promo.end)}` : ''}</>}
        {promo.profitCents !== undefined && <span className={`ml-1 font-semibold ${promo.profitCents >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>· lucro {money(promo.profitCents)} ({pct(promo.marginPct)})</span>}
      </p>}
      {!editing && promo?.divergent && <p className="mt-1 text-[11px] text-amber-800">As cores desta versão estão com promoções diferentes ({promo.withPromoCount} de {promo.total} com promoção). Salvar aqui deixa todas iguais.</p>}
      {!editing && !promo && <p className="mt-1 text-[11px] text-slate-500">{retail ? 'Sem promoção nesta versão.' : 'Defina o preço de varejo antes de criar promoção.'}</p>}
      {editing && <div className="mt-2 space-y-2">
        <div className="grid gap-2 sm:grid-cols-3">
          <CurrencyInput label="Preço promocional" value={draft.priceCents} disabled={saving} onChange={value => setDraft(current => ({ ...current, priceCents: value }))} />
          <label className="text-xs text-slate-600">Início (vazio = agora)<input type="datetime-local" className="mt-1 block w-full rounded-lg border p-2 text-sm" value={draft.start} disabled={saving} onChange={event => setDraft(current => ({ ...current, start: event.target.value }))} /></label>
          <label className="text-xs text-slate-600">Fim (vazio = sem prazo)<input type="datetime-local" className="mt-1 block w-full rounded-lg border p-2 text-sm" value={draft.end} disabled={saving} onChange={event => setDraft(current => ({ ...current, end: event.target.value }))} /></label>
        </div>
        {editingProfit !== null && <p className={`text-xs font-semibold ${editingProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>Lucro na promoção: {money(editingProfit)} ({pct(Math.round((editingProfit / draft.priceCents) * 1000) / 10)})</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{saving ? 'Salvando…' : `Salvar promoção em todas as cores (${row.productIds.length})`}</button>
          <button type="button" disabled={saving} onClick={() => { setEditing(false); setError(''); }} className="text-xs text-slate-600 underline">Cancelar</button>
        </div>
        <p className="text-[11px] text-slate-500">É a mesma promoção do cadastro do produto e da campanha do Marketing — não cria outro preço.</p>
      </div>}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
      {promo && !editing && media && <PromoMediaBlock row={row} modelName={modelName} media={media} promoActive={promo.status === 'active'} onMediaSaved={onMediaSaved} />}
      {promo && !editing && !media && <p className="mt-1 text-[11px] text-slate-400">Carregando mídia da promoção…</p>}
    </div>
  );
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; enabled: boolean; groups: SmartphonePriceGroup[] };

export function useModelVersionGroups(modelId: string | undefined) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!modelId) return;
    let active = true;
    setState({ status: 'loading' });
    smartphonePriceGroups.list(modelId)
      .then(result => { if (active) setState({ status: 'ready', enabled: result.enabled, groups: result.groups || [] }); })
      .catch(error => { if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Não foi possível consultar os preços por versão.' }); });
    return () => { active = false; };
  }, [modelId, reload]);
  return { state, reload: useCallback(() => setReload(value => value + 1), []) };
}

function VersionRow({ row, onSaved, modelName, media, onMediaSaved }: { row: Row; onSaved: () => void; modelName: string; media: (PromoMedia & { banner_image_url?: string | null }) | null; onMediaSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SmartphoneSalePrices | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const start = () => {
    setDraft({ price_retail: row.prices?.price_retail || 0, price_reseller: row.prices?.price_reseller || 0, price_wholesale: row.prices?.price_wholesale || 0 });
    setError(''); setEditing(true);
  };
  const save = async () => {
    if (!draft) return;
    const invalid = validateSalePrices(draft);
    if (invalid) { setError(invalid); return; }
    setSaving(true); setError('');
    try {
      const result = await smartphonePriceGroups.save(row.group, draft);
      toast.success(`${row.label}: preços salvos em ${result.updated} cor(es). Custos preservados.`);
      setEditing(false); setDraft(null);
      onSaved();
    } catch (cause) {
      // 409 = outra tela alterou preços/produtos desta versão: recarrega para não sobrescrever.
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar os preços.');
      onSaved();
    } finally { setSaving(false); }
  };
  // product-promotions-list-v1: atalho da Central de Promoções (#promo-<produto>) rola até esta versão.
  const articleRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#promo-/, '') : '';
    if (hash && row.productIds.includes(hash)) window.setTimeout(() => articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }, [row.productIds]);
  const preview = (key: typeof SALE_TIERS[number]['key']) => {
    const price = editing && draft ? draft[key] : row.prices?.[key] ?? null;
    if (!price || row.costBaseCents === null) return null;
    const profit = price - row.costBaseCents;
    return { profit, margin: Math.round((profit / price) * 1000) / 10 };
  };

  return (
    <article ref={articleRef} className="scroll-mt-24 rounded-lg border border-slate-200 bg-white p-3" aria-label={`Versão ${row.label}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {row.publicUrl
            ? <a href={row.publicUrl} target="_blank" rel="noopener noreferrer" title="Abrir esta versão no site" className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline">
                {row.label || 'Versão sem RAM/armazenamento'} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            : <p className="text-sm font-bold text-slate-900">{row.label || 'Versão sem RAM/armazenamento'}</p>}
          <p className="text-xs text-slate-500">{row.colors.length ? row.colors.join(', ') : 'Sem cor'} · {row.stockQuantity} un. em estoque</p>
        </div>
        {!editing && <button type="button" onClick={start} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <Pencil className="h-3.5 w-3.5" /> Editar preços
        </button>}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div><dt className="text-slate-500">Custo médio em estoque</dt><dd className="text-sm font-bold text-slate-900">{money(row.averageStockCostCents)}</dd>
          {row.costMinCents !== null && row.costMaxCents !== null && row.costMinCents !== row.costMaxCents && <dd className="text-[11px] text-slate-400">{money(row.costMinCents)} a {money(row.costMaxCents)}</dd>}</div>
        <div><dt className="text-slate-500">Custo médio móvel (vendas)</dt><dd className="text-sm font-bold text-slate-900">{money(row.movingAverageCostCents)}</dd></div>
        <div><dt className="text-slate-500">Valor em estoque</dt><dd className="text-sm font-bold text-slate-900">{money(row.stockValueCents)}</dd></div>
        <div><dt className="text-slate-500">Vendido · preço praticado</dt>
          <dd className="text-sm font-bold text-slate-900">{row.soldCount} un.{row.practicedAverageCents !== null ? ` · ${money(row.practicedAverageCents)}` : ''}</dd>
          {row.realizedProfitAverageCents !== null && <dd className={`text-[11px] font-semibold ${row.realizedProfitAverageCents >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>lucro médio realizado {money(row.realizedProfitAverageCents)}/un.</dd>}
          {row.soldCount > row.soldWithPriceCount && <dd className="text-[11px] text-slate-400">{row.soldCount - row.soldWithPriceCount} venda(s) sem valor registrado</dd>}</div>
      </dl>

      {row.divergent && !editing && <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">As cores desta versão estão com preços diferentes. Use "Editar preços" para definir um preço único para todas.</p>}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {SALE_TIERS.map(tier => {
          const result = preview(tier.key);
          return (
            <div key={tier.key} className="rounded-lg bg-slate-50 p-2">
              {editing && draft
                ? <CurrencyInput label={tier.label} value={draft[tier.key]} disabled={saving} onChange={value => setDraft(current => current ? { ...current, [tier.key]: value } : current)} />
                : <><p className="text-[11px] font-semibold uppercase text-slate-500">{tier.label}</p><p className="text-sm font-bold text-slate-900">{money(row.prices?.[tier.key] ?? null)}</p></>}
              <p className={`mt-1 text-xs font-semibold ${result ? (result.profit >= 0 ? 'text-emerald-700' : 'text-red-600') : 'text-slate-400'}`}>
                {result ? `Lucro ${money(result.profit)} (${pct(result.margin)})` : row.costBaseCents === null ? 'Sem custo para calcular' : 'Sem preço'}
              </p>
            </div>
          );
        })}
      </div>
      <PromoBlock row={row} onSaved={onSaved} modelName={modelName} media={media} onMediaSaved={onMediaSaved} />
      {row.costBaseSource && <p className="mt-1 text-[11px] text-slate-400">Lucro previsto = preço − {row.costBaseSource}, sem taxas de canal (veja "por canal" abaixo).</p>}

      {editing && <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
          {saving ? 'Salvando…' : `Salvar para todas as cores (${row.group.products.length})`}
        </button>
        <button type="button" disabled={saving} onClick={() => { setEditing(false); setDraft(null); setError(''); }} className="text-xs text-slate-600 underline">Cancelar</button>
      </div>}
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </article>
  );
}

export function ModelVersionFinancials({ modelId, modelName, memoryGroups, groupsState, onReloadGroups, onSaved }: {
  modelId: string; modelName: string; memoryGroups: any[];
  groupsState: LoadState; onReloadGroups: () => void; onSaved?: () => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [mediaByProduct, setMediaByProduct] = useState<Record<string, PromoMedia> | null>(null);
  const [bannerImages, setBannerImages] = useState<Record<string, string>>({});
  const [mediaReload, setMediaReload] = useState(0);
  const rows = useMemo(() => groupsState.status === 'ready' && groupsState.enabled ? buildVersionFinancials(groupsState.groups, memoryGroups) : [], [groupsState, memoryGroups]);
  const mediaIds = rows.filter(row => row.promo).flatMap(row => row.productIds).join(',');
  useEffect(() => {
    if (!mediaIds) { setMediaByProduct({}); return; }
    let active = true;
    setMediaByProduct(null);
    loadPromoMedia(mediaIds.split(','))
      .then(async items => {
        // Imagem atual do banner vinculado (o banner continua sendo editável na tela de Banners).
        const bannerIds = [...new Set(Object.values(items).map(item => item.banner_id).filter(Boolean))] as string[];
        const images: Record<string, string> = {};
        await Promise.all(bannerIds.map(id => bannerService.getBannerById(id).then(banner => { if (banner?.image_url) images[id] = banner.image_url; }).catch(() => {})));
        if (active) { setBannerImages(images); setMediaByProduct(items); }
      })
      .catch(() => { if (active) setMediaByProduct({}); });
    return () => { active = false; };
  }, [mediaIds, mediaReload]);
  const mediaFor = (row: Row) => {
    if (!mediaByProduct) return null;
    const found = row.productIds.map(id => mediaByProduct[id]).find(Boolean) || EMPTY_PROMO_MEDIA;
    return { ...found, banner_image_url: found.banner_id ? bannerImages[found.banner_id] || null : null };
  };
  if (groupsState.status === 'ready' && !groupsState.enabled) return null;
  const saved = () => { onReloadGroups(); onSaved?.(); };
  return (
    <section className="mt-5 space-y-3" aria-label="Por versão">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Por versão (RAM + armazenamento)</h3>
        <button type="button" onClick={() => setPanelOpen(true)} className="text-xs font-semibold text-blue-700 hover:underline">Abrir preços por configuração (compra por IMEI)</button>
      </div>
      <p className="text-xs text-slate-500">Cada versão tem seu próprio custo e preço — nada é misturado entre versões. Os preços são os mesmos da Gestão de Modelos e do cadastro da família: editar aqui altera a origem para todas as cores da versão.</p>
      {groupsState.status === 'loading' && <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Consultando custos e preços por versão…</p>}
      {groupsState.status === 'error' && <p role="alert" className="text-xs text-red-700">{groupsState.message} <button type="button" onClick={onReloadGroups} className="underline">Tentar de novo</button></p>}
      {groupsState.status === 'ready' && !rows.length && <p className="text-xs text-slate-500">Nenhuma versão com RAM e armazenamento cadastrados.</p>}
      {rows.map(row => <VersionRow key={row.id} row={row} onSaved={saved} modelName={modelName} media={mediaFor(row)} onMediaSaved={() => setMediaReload(value => value + 1)} />)}
      {panelOpen && <ModelPricesPanel modelId={modelId} modelName={modelName} onClose={() => { setPanelOpen(false); saved(); }} onSaved={saved} />}
    </section>
  );
}
