import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Check, Instagram, Loader2, MessageCircle, Plus, RefreshCw, Search, Send, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { vpsClient } from '../../../../services/vpsClient';
import { catalogService } from '../../../../services/catalogService';
import type { CatalogProduct } from '../../../../types/catalog';
import { buildCatalogStoryItems, getStatusProductImage, groupStatusProductsByVariation } from '../../../../services/whatsappStatusCampaignHelper.js';
import { toBrowserSafeMediaUrl } from '../../../../utils/media-url';
import { whatsappStatusCampaignService, type WhatsAppStatusCampaign } from '../../../../services/whatsappStatusCampaignService';
import {
  socialStoryScheduleService,
  type SocialStoryDestination,
  type SocialStoryDraftItem,
  type SocialStorySchedule,
} from '../../../../services/socialStoryScheduleService';
import MultiDateCalendar from './MultiDateCalendar';

function defaultDateTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function todayDateKey() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function statusLabel(status: string) {
  return ({
    pending_approval: 'Aguardando aprovação', approved: 'Aprovado', processing: 'Publicando',
    completed: 'Concluído', partial: 'Concluído parcialmente', failed: 'Falhou', cancelled: 'Cancelado',
  } as Record<string, string>)[status] || status;
}

async function uploadStoryFile(file: File): Promise<SocialStoryDraftItem> {
  const isVideo = file.type.startsWith('video/');
  const extension = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
  const safeName = `story-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const renamed = new File([file], safeName, { type: file.type });
  const form = new FormData();
  form.append('file', renamed);
  const upload = await vpsClient.upload<{ uploadId: string; url: string }>(
    `/synology/upload?folder=${isVideo ? 'videos' : 'imagens'}`, form,
  );
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const progress = await vpsClient.get<{ status: string; error?: string }>(`/synology/upload-status?id=${encodeURIComponent(upload.uploadId)}`);
    if (progress.status === 'success') return { mediaType: isVideo ? 'video' : 'image', mediaUrl: upload.url, label: file.name };
    if (progress.status === 'error') throw new Error(progress.error || 'Falha no upload');
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('O upload não foi confirmado dentro do tempo esperado');
}

interface SocialStorySchedulerPanelProps {
  defaultDestinations?: SocialStoryDestination[];
}

export default function SocialStorySchedulerPanel({ defaultDestinations = ['instagram'] }: SocialStorySchedulerPanelProps) {
  const [mode, setMode] = useState<'catalog' | 'standalone' | 'whatsapp_campaign'>('catalog');
  const [title, setTitle] = useState('Stories de produtos');
  const [scheduledAt, setScheduledAt] = useState(defaultDateTime);
  const [selectedDates, setSelectedDates] = useState<string[]>(() => [defaultDateTime().slice(0, 10)]);
  const [destinations, setDestinations] = useState<SocialStoryDestination[]>(() => [...defaultDestinations]);
  const [campaigns, setCampaigns] = useState<WhatsAppStatusCampaign[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [includePrice, setIncludePrice] = useState(true);
  const [catalogSource, setCatalogSource] = useState<'category' | 'product'>('category');
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [categoryId, setCategoryId] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [selectedCatalogProducts, setSelectedCatalogProducts] = useState<CatalogProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [pendingProductId, setPendingProductId] = useState('');
  const [dailyLimit, setDailyLimit] = useState(3);
  const [fullCategory, setFullCategory] = useState(true);
  const [productIntervalMinutes, setProductIntervalMinutes] = useState(30);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [items, setItems] = useState<SocialStoryDraftItem[]>([]);
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [schedules, setSchedules] = useState<SocialStorySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const unavailableMediaRef = useRef(new Set<string>());

  const load = async () => {
    setLoading(true);
    try {
      const [campaignRows, scheduleRows, categoryRows] = await Promise.all([
        whatsappStatusCampaignService.list(), socialStoryScheduleService.list(), catalogService.getCategoriesWithNames(),
      ]);
      setCampaigns(campaignRows);
      setSchedules(scheduleRows);
      setCategories(categoryRows);
      setCampaignId((current) => current || campaignRows[0]?.id || '');
      setCategoryId((current) => current || categoryRows[0]?.id || '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar agendamentos');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (mode !== 'catalog') return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      setCatalogLoading(true);
      const filters = catalogSource === 'category'
        ? { categories: categoryId ? [categoryId] : [], inStockOnly: true }
        : { search: productSearch.trim() || undefined, inStockOnly: true };
      catalogService.getProducts(filters, 1, catalogSource === 'category' ? 80 : 50, true)
        .then((result) => { if (mounted) setCatalogProducts(result.products); })
        .catch(() => { if (mounted) toast.error('Erro ao carregar produtos do catálogo'); })
        .finally(() => { if (mounted) setCatalogLoading(false); });
    }, catalogSource === 'product' && productSearch.trim() ? 250 : 0);
    return () => { mounted = false; window.clearTimeout(timer); };
  }, [mode, catalogSource, categoryId, productSearch]);

  const selectableCatalogProducts = useMemo(() => (
    (groupStatusProductsByVariation(catalogProducts) as CatalogProduct[])
      .filter((product) => Boolean(getStatusProductImage(product, includePrice)))
  ), [catalogProducts, includePrice]);

  const expectedDeliveries = useMemo(() => items.length * destinations.length * selectedDates.length, [items.length, destinations.length, selectedDates.length]);

  const toggleDestination = (destination: SocialStoryDestination) => {
    setDestinations((current) => current.includes(destination)
      ? current.filter((value) => value !== destination)
      : [...current, destination]);
  };

  const previewCampaign = async () => {
    if (!campaignId) return;
    setBusy(true);
    try {
      const preview = await socialStoryScheduleService.previewWhatsApp(campaignId, includePrice);
      setItems(preview);
      const campaign = campaigns.find((row) => row.id === campaignId);
      if (campaign) setTitle(`Stories - ${campaign.title}`);
      toast.success(`${preview.length} mídias importadas na ordem do Status`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao importar campanha');
    } finally { setBusy(false); }
  };

  const addCatalogProduct = () => {
    const product = selectableCatalogProducts.find((item) => item.id === pendingProductId);
    if (!product) return toast.error('Escolha um produto para adicionar');
    if (selectedCatalogProducts.some((item) => item.id === product.id)) return toast.info('Produto já selecionado');
    if (selectedCatalogProducts.length >= 10) return toast.error('Limite de 10 produtos por programação');
    setSelectedCatalogProducts((current) => [...current, product]);
    setPendingProductId('');
    setItems([]);
  };

  const previewCatalog = () => {
    const sourceProducts = catalogSource === 'category' ? catalogProducts : selectedCatalogProducts;
    const storyItems = buildCatalogStoryItems(sourceProducts, {
      includePrice,
      dailyLimit: catalogSource === 'category' && fullCategory ? 0 : (catalogSource === 'category' ? dailyLimit : Math.max(1, selectedCatalogProducts.length)),
      productIntervalSeconds: productIntervalMinutes * 60,
    }) as SocialStoryDraftItem[];
    if (!storyItems.length) {
      return toast.error(includePrice
        ? 'Nenhum produto com estoque e arte de preço foi encontrado'
        : 'Nenhum produto com estoque e imagem sem preço foi encontrado');
    }
    unavailableMediaRef.current.clear();
    setItems(storyItems);
    const categoryName = categories.find((category) => category.id === categoryId)?.name;
    setTitle(catalogSource === 'category' && categoryName ? `Stories - ${categoryName}` : 'Stories de produtos');
    toast.success(`${storyItems.length} mídia(s) carregada(s) diretamente do catálogo`);
  };

  const removeUnavailableMedia = (item: SocialStoryDraftItem) => {
    const mediaUrl = String(item.mediaUrl || '');
    if (!mediaUrl || unavailableMediaRef.current.has(mediaUrl)) return;
    unavailableMediaRef.current.add(mediaUrl);
    setItems((current) => current.filter((candidate) => candidate.mediaUrl !== mediaUrl));
    toast.warning(`${item.label || 'Mídia'} está indisponível e foi removida da programação.`);
  };

  const addUrl = () => {
    const mediaUrl = url.trim();
    if (!/^https:\/\//i.test(mediaUrl)) return toast.error('Informe uma URL pública HTTPS');
    const mediaType = /\.(mp4|mov|webm)(?:\?|$)/i.test(mediaUrl) ? 'video' : 'image';
    setItems((current) => [...current, { mediaType, mediaUrl, caption: caption.trim(), label: `Mídia ${current.length + 1}` }]);
    setUrl('');
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded: SocialStoryDraftItem[] = [];
      for (const file of Array.from(files)) uploaded.push({ ...(await uploadStoryFile(file)), caption: caption.trim() });
      setItems((current) => [...current, ...uploaded]);
      toast.success(`${uploaded.length} mídia(s) enviada(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha no upload');
    } finally { setBusy(false); }
  };

  const schedule = async () => {
    if (!title.trim() || !scheduledAt || !selectedDates.length || !destinations.length || !items.length) {
      return toast.error('Preencha título, dias, horário, canal e ao menos uma mídia');
    }
    if (items.some((item) => !/^https:\/\//i.test(String(item.mediaUrl || '')))) {
      return toast.error('Há mídias sem URL HTTPS pública. Recarregue as mídias do catálogo antes de agendar.');
    }
    setBusy(true);
    try {
      const time = scheduledAt.slice(11, 16) || '08:00';
      let totalStories = 0;
      for (const date of [...selectedDates].sort()) {
        const result = await socialStoryScheduleService.create({
          title: selectedDates.length > 1 ? `${title.trim()} - ${new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')}` : title.trim(),
          sourceType: mode === 'whatsapp_campaign' ? 'whatsapp_campaign' : 'standalone', sourceId: mode === 'whatsapp_campaign' ? campaignId : null,
          scheduledAt: new Date(`${date}T${time}:00`).toISOString(), destinations,
          includePrice: mode === 'whatsapp_campaign' ? includePrice : undefined,
          items: mode !== 'whatsapp_campaign' ? items : undefined,
        });
        totalStories += result.itemCount;
      }
      toast.success(`${selectedDates.length} dia(s) agendado(s), com ${totalStories} Stories. Aprove na Central de Aprovações.`);
      setItems([]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar agendamento');
    } finally { setBusy(false); }
  };

  const cancel = async (id: string) => {
    if (!window.confirm('Cancelar as publicações ainda pendentes deste agendamento?')) return;
    try { await socialStoryScheduleService.cancel(id); await load(); toast.success('Agendamento cancelado'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar'); }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><CalendarClock className="w-5 h-5 text-pink-600" /> Publicação automática de Stories</h2>
          <p className="text-sm text-slate-500 mt-1">Agende uma peça avulsa ou reutilize, na mesma ordem, o conteúdo de uma campanha do WhatsApp.</p>
        </div>
        <button onClick={() => void load()} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Atualizar"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      <div className="p-5 grid xl:grid-cols-[1.15fr_.85fr] gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => { setMode('catalog'); setItems([]); setTitle('Stories de produtos'); }} className={`py-2 rounded-lg text-xs sm:text-sm font-bold ${mode === 'catalog' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Catálogo</button>
            <button onClick={() => { setMode('standalone'); setItems([]); setTitle('Story avulso'); }} className={`py-2 rounded-lg text-xs sm:text-sm font-bold ${mode === 'standalone' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Mídia avulsa</button>
            <button onClick={() => { setMode('whatsapp_campaign'); setItems([]); }} className={`py-2 rounded-lg text-xs sm:text-sm font-bold ${mode === 'whatsapp_campaign' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Importar do WhatsApp</button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs font-bold text-slate-600">Título
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-bold text-slate-600">Horário
              <input type="time" value={scheduledAt.slice(11, 16)} onChange={(event) => setScheduledAt(`${scheduledAt.slice(0, 10)}T${event.target.value}`)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </label>
          </div>

          <MultiDateCalendar value={selectedDates} onChange={setSelectedDates} minDate={todayDateKey()} maxSelected={30} label="Abra o calendário e escolha os dias" />

          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">Publicar em</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => toggleDestination('instagram')} className={`px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 ${destinations.includes('instagram') ? 'bg-pink-50 border-pink-300 text-pink-700' : 'border-slate-200 text-slate-400'}`}><Instagram className="w-4 h-4" /> Instagram {destinations.includes('instagram') && <Check className="w-4 h-4" />}</button>
              <button onClick={() => toggleDestination('whatsapp')} className={`px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 ${destinations.includes('whatsapp') ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-400'}`}><MessageCircle className="w-4 h-4" /> WhatsApp {destinations.includes('whatsapp') && <Check className="w-4 h-4" />}</button>
            </div>
          </div>

          {mode === 'catalog' ? (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                <button type="button" onClick={() => { setCatalogSource('category'); setItems([]); }} className={`rounded-lg py-2 text-sm font-bold ${catalogSource === 'category' ? 'bg-white text-emerald-700 shadow' : 'text-slate-500'}`}>Categoria</button>
                <button type="button" onClick={() => { setCatalogSource('product'); setItems([]); }} className={`rounded-lg py-2 text-sm font-bold ${catalogSource === 'product' ? 'bg-white text-emerald-700 shadow' : 'text-slate-500'}`}>Escolher produtos</button>
              </div>

              {catalogSource === 'category' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-bold text-slate-600">Categoria
                    <select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setItems([]); }} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </label>
                  <div>
                    <p className="text-xs font-bold text-slate-600">Quantidade</p>
                    <div className="mt-1 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                      <button type="button" onClick={() => { setFullCategory(true); setItems([]); }} className={`rounded-md px-2 py-1.5 text-xs font-bold ${fullCategory ? 'bg-white text-emerald-700 shadow' : 'text-slate-500'}`}>Categoria completa</button>
                      <button type="button" onClick={() => { setFullCategory(false); setItems([]); }} className={`rounded-md px-2 py-1.5 text-xs font-bold ${!fullCategory ? 'bg-white text-blue-700 shadow' : 'text-slate-500'}`}>Definir quantidade</button>
                    </div>
                  </div>
                  {!fullCategory && <label className="text-xs font-bold text-slate-600">Produtos por dia
                    <input type="number" min={1} max={80} value={dailyLimit} onChange={(event) => { setDailyLimit(Math.max(1, Math.min(80, Number(event.target.value) || 1))); setItems([]); }} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  </label>}
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="relative block">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar produto no catálogo" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
                  </label>
                  <div className="flex gap-2">
                    <select value={pendingProductId} onChange={(event) => setPendingProductId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <option value="">Selecione um produto</option>
                      {selectableCatalogProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                    </select>
                    <button type="button" onClick={addCatalogProduct} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold"><Plus className="h-4 w-4" /> Adicionar</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCatalogProducts.map((product) => (
                      <button key={product.id} type="button" onClick={() => { setSelectedCatalogProducts((current) => current.filter((item) => item.id !== product.id)); setItems([]); }} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700" title="Remover produto">
                        {product.name} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-bold text-slate-600">Preço na mídia</p>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                  <button type="button" onClick={() => { setIncludePrice(true); setItems([]); }} className={`rounded-lg py-2 text-sm font-bold ${includePrice ? 'bg-white text-emerald-700 shadow' : 'text-slate-500'}`}>Com preço</button>
                  <button type="button" onClick={() => { setIncludePrice(false); setItems([]); }} className={`rounded-lg py-2 text-sm font-bold ${!includePrice ? 'bg-white text-blue-700 shadow' : 'text-slate-500'}`}>Sem preço</button>
                </div>
              </div>
              <label className="block text-xs font-bold text-slate-600">Intervalo entre produtos (minutos)
                <input type="number" min={1} max={1440} value={productIntervalMinutes} onChange={(event) => { setProductIntervalMinutes(Math.max(1, Math.min(1440, Number(event.target.value) || 1))); setItems([]); }} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <button type="button" onClick={previewCatalog} disabled={catalogLoading || (catalogSource === 'product' && !selectedCatalogProducts.length)} className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
                {catalogLoading ? 'Carregando catálogo...' : 'Carregar mídias do catálogo'}
              </button>
            </div>
          ) : mode === 'whatsapp_campaign' ? (
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-bold text-slate-600">Preço na mídia</p>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => { setIncludePrice(true); setItems([]); }}
                    className={`rounded-lg py-2 text-sm font-bold ${includePrice ? 'bg-white text-emerald-700 shadow' : 'text-slate-500'}`}
                  >
                    Com preço
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIncludePrice(false); setItems([]); }}
                    className={`rounded-lg py-2 text-sm font-bold ${!includePrice ? 'bg-white text-blue-700 shadow' : 'text-slate-500'}`}
                  >
                    Sem preço
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {includePrice ? 'Usa a arte de marketing com o valor cadastrado.' : 'Usa a imagem limpa do produto, sem o cartão de preço.'}
                </p>
              </div>
              <div className="flex gap-2">
                <select value={campaignId} onChange={(event) => { setCampaignId(event.target.value); setItems([]); }} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
                </select>
                <button onClick={() => void previewCampaign()} disabled={busy || !campaignId} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold disabled:opacity-50">Ver conteúdo</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-dashed border-slate-300 p-4">
              <label className="flex items-center justify-center gap-2 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer text-sm font-bold text-slate-700">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar imagens ou vídeos 9:16
                <input type="file" multiple accept="image/jpeg,image/png,video/mp4" className="hidden" onChange={(event) => void handleFiles(event.target.files)} />
              </label>
              <div className="grid md:grid-cols-[1fr_auto] gap-2">
                <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="ou cole uma URL pública HTTPS" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <button onClick={addUrl} className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold flex items-center gap-1"><Plus className="w-4 h-4" /> Adicionar</button>
              </div>
              <textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={2} placeholder="Legenda opcional (usada no Status do WhatsApp)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <p className="text-[11px] text-slate-500">Para o Instagram, imagens são preparadas automaticamente em JPEG 1080 × 1920 sem cortar a arte.</p>
            </div>
          )}

          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={`${item.mediaUrl}-${index}`} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                  {item.mediaType === 'video' ? (
                    <video
                      src={toBrowserSafeMediaUrl(item.mediaUrl)}
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(event) => {
                        try { event.currentTarget.currentTime = Math.min(0.1, event.currentTarget.duration || 0.1); } catch {}
                      }}
                      onError={() => removeUnavailableMedia(item)}
                      className="h-full w-full object-cover"
                      aria-label={`Prévia de ${item.label || `vídeo ${index + 1}`}`}
                    />
                  ) : (
                    <img src={toBrowserSafeMediaUrl(item.mediaUrl)} alt={item.label || `Mídia ${index + 1}`} loading="lazy" onError={() => removeUnavailableMedia(item)} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-700 truncate">{index + 1}. {item.label || item.mediaUrl}</p><p className="text-[11px] text-slate-400 truncate">{item.mediaUrl}</p></div>
                {mode === 'standalone' && <button onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="p-1.5 text-red-500"><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}
            {!items.length && <p className="text-sm text-center text-slate-400 py-4">Nenhuma mídia selecionada.</p>}
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">A criação gera um pedido na Central de Aprovações. Nada será publicado antes da aprovação por outro administrador.</div>
          <button onClick={() => void schedule()} disabled={busy || !items.length || !destinations.length} className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"><Send className="w-4 h-4" /> Solicitar aprovação ({expectedDeliveries} entregas)</button>
        </div>

        <div>
          <h3 className="font-black text-slate-800 mb-3">Agendamentos</h3>
          <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
            {schedules.map((scheduleRow) => (
              <div key={scheduleRow.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-800">{scheduleRow.title}</p><p className="text-xs text-slate-500">{new Date(scheduleRow.scheduled_at).toLocaleString('pt-BR')} · {scheduleRow.items.length} Stories</p></div><span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-600">{statusLabel(scheduleRow.status)}</span></div>
                <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">{scheduleRow.destinations.includes('instagram') && <Instagram className="w-4 h-4 text-pink-500" />}{scheduleRow.destinations.includes('whatsapp') && <MessageCircle className="w-4 h-4 text-emerald-500" />}{scheduleRow.last_error && <span className="text-red-600 truncate" title={scheduleRow.last_error}>{scheduleRow.last_error}</span>}</div>
                {['pending_approval', 'approved', 'processing'].includes(scheduleRow.status) && <button onClick={() => void cancel(scheduleRow.id)} className="mt-3 text-xs font-bold text-red-600 hover:underline">Cancelar pendentes</button>}
              </div>
            ))}
            {!schedules.length && !loading && <p className="text-sm text-slate-400 text-center py-8">Nenhum agendamento automático ainda.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
