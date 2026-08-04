import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Copy, ImageIcon, Loader2, MessageCircle, Play, Plus, RefreshCw, Save, Smartphone, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { catalogService } from '../../../../services/catalogService';
import { vpsApiService } from '../../../../services/vpsApiService';
import { normalizeProduct } from '../../../../services/productNormalizer';
import type { CatalogProduct } from '../../../../types/catalog';
import { calculateInstallmentFromFees } from '../../../../services/installmentCalculator';
import { paymentFeesService, type PaymentFee } from '../../../../services/payment-fees';
import {
  buildStatusCaption,
  buildStatusPayload,
  groupStatusProductsByVariation,
  selectStatusProducts,
} from '../../../../services/whatsappStatusCampaignHelper.js';
import {
  whatsappStatusCampaignService,
  type WhatsAppStatusCampaign,
  type WhatsAppStatusCampaignProgress,
  type WhatsAppStatusCampaignInput,
  type WhatsAppStatusRepeatMode,
  type WhatsAppStatusCampaignSourceType,
  type WhatsAppStatusTraceEvent,
} from '../../../../services/whatsappStatusCampaignService';

function todayDateValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const DEFAULT_FORM: WhatsAppStatusCampaignInput = {
  title: 'Status diario de produtos',
  source_type: 'category',
  product_id: null,
  product_ids: [],
  category_id: null,
  daily_limit: 0,
  interval_minutes: 30,
  start_time: '08:00',
  frequency: 'daily',
  start_date: todayDateValue(),
  repeat_days: 1,
  repeat_mode: 'full_day',
  repeat_product_id: null,
  active: true,
};

function copyDebug(debug?: string | null) {
  if (!debug) return;
  navigator.clipboard.writeText(debug);
  toast.success('Debug copiado');
}

function normalizeTime(value?: string | null) {
  return String(value || '08:00').slice(0, 5);
}

function normalizeMemoryLabel(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/(\d+)G$/i, '$1GB')
    .replace(/(\d+)T$/i, '$1TB');
}

function getProductSpec(product: CatalogProduct, keys: string[]) {
  const specs = product.specs || {};
  for (const key of keys) {
    const value = (specs as Record<string, unknown>)[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function formatProductOptionLabel(product: CatalogProduct) {
  const ram = normalizeMemoryLabel(getProductSpec(product, ['ram', 'memoria_ram', 'memory_ram', 'RAM']));
  const storage = normalizeMemoryLabel(getProductSpec(product, ['storage', 'armazenamento', 'memoria', 'memoria_interna', 'capacity']));
  const color = getProductSpec(product, ['color', 'cor', 'colour', 'Color', 'Cor']);
  const variation = [ram && `${ram} RAM`, storage, color].filter(Boolean).join(' / ');
  return [
    product.name,
    variation,
    product.sku,
  ].filter(Boolean).join(' - ');
}

function findGroupedPreviewProduct(products: CatalogProduct[], selectedProductId?: string | null) {
  if (!selectedProductId) return null;
  const grouped = groupStatusProductsByVariation(products) as any[];
  return grouped.find((product) => {
    const ids = product?.status_variation?.product_ids || [product?.id];
    return ids.includes(selectedProductId);
  }) || products.find((product) => product.id === selectedProductId) || null;
}

function findGroupedPreviewProducts(products: CatalogProduct[], selectedProductIds: string[]) {
  const grouped = groupStatusProductsByVariation(products) as any[];
  return selectedProductIds
    .map((id) => grouped.find((product) => {
      const ids = product?.status_variation?.product_ids || [product?.id];
      return ids.includes(id);
    }) || products.find((product) => product.id === id))
    .filter(Boolean);
}

function StatusPreviewCard({ product, paymentFees }: { product: any; paymentFees: PaymentFee[] }) {
  const cardPlan = calculateInstallmentFromFees(Number(product?.price_retail || 0), paymentFees, 12);
  const caption = buildStatusCaption({
    product,
    cardPlan,
    siteBaseUrl: 'https://mercadodovale.com.br',
  });
  const payload = buildStatusPayload({ product, caption });
  const lines = caption.split('\n');
  const title = lines[0] || 'Produto';
  const details = lines.slice(1);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[9/10] bg-slate-100">
        {payload.content ? (
          <img
            src={payload.content}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
          Status
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="line-clamp-2 text-sm font-black leading-snug text-slate-900">{title}</div>
        <div className="space-y-1 text-xs leading-relaxed text-slate-600">
          {details.map((line, index) => (
            line
              ? <p key={`${line}-${index}`} className={line.startsWith('Veja') ? 'font-bold text-slate-700' : ''}>{line}</p>
              : <div key={`gap-${index}`} className="h-1" />
          ))}
        </div>
      </div>
    </div>
  );
}

function parseProgressDate(value?: string | null) {
  if (!value) return 0;
  return new Date(String(value).replace(' ', 'T')).getTime() || 0;
}

function formatProgressTime(value?: string | null) {
  if (!value) return '--:--';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value).slice(11, 16) || '--:--';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

function statusLabel(status?: string | null) {
  if (status === 'sending') return 'Em envio';
  if (status === 'sent') return 'Enviado';
  if (status === 'failed') return 'Falhou';
  if (status === 'skipped') return 'Ignorado';
  return status || 'Aguardando';
}

function traceStateClasses(state?: string) {
  if (state === 'failed') return 'border-red-200 bg-red-50 text-red-700';
  if (state === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (state === 'started') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function traceDetails(event: WhatsAppStatusTraceEvent) {
  const details = event.details_json && typeof event.details_json === 'object' ? event.details_json : {};
  return Object.entries(details)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`)
    .join(' · ');
}

function addScheduleDays(value: string | null | undefined, offset: number) {
  const [year, month, day] = String(value || todayDateValue()).slice(0, 10).split('-').map(Number);
  const date = new Date(year, Math.max(0, month - 1), day || 1);
  date.setDate(date.getDate() + offset);
  return date;
}

function scheduleSlotTime(startTime: string, intervalMinutes: number, slotIndex: number) {
  const [hours, minutes] = normalizeTime(startTime).split(':').map(Number);
  const total = hours * 60 + minutes + intervalMinutes * slotIndex;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function ScheduleDiagram({ form, products }: { form: WhatsAppStatusCampaignInput; products: CatalogProduct[] }) {
  const repeatDays = Math.max(1, Math.min(30, Number(form.repeat_days || 1)));
  const totalSlots = form.repeat_mode === 'single_product'
    ? 1
    : form.source_type === 'category'
      ? Math.max(1, products.length)
      : Math.max(1, Math.min(300, Number(form.daily_limit || 1)));
  const interval = Math.max(1, Number(form.interval_minutes || 30));
  const specific = products.find((product) => product.id === form.repeat_product_id);
  const labels = form.repeat_mode === 'single_product'
    ? [specific?.name || 'Produto especifico']
    : products.map((product) => product.name).filter(Boolean);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-emerald-600" />
          <h4 className="font-bold text-slate-800">Diagrama da programacao</h4>
        </div>
        <span className="text-xs font-semibold text-slate-500">{repeatDays} dia(s) · {totalSlots} Status por dia</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: repeatDays }, (_, dayIndex) => {
          const date = addScheduleDays(form.start_date, dayIndex);
          return (
            <div key={dayIndex} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className="text-xs font-black text-slate-700">Dia {dayIndex + 1}</span>
                <span className="text-[11px] font-semibold text-slate-500">{date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
              </div>
              <div className="space-y-1">
                {Array.from({ length: Math.min(totalSlots, 3) }, (_, slotIndex) => (
                  <div key={slotIndex} className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-600">
                    <span className="shrink-0 font-bold text-emerald-700">{scheduleSlotTime(form.start_time, interval, slotIndex)}</span>
                    <span className="truncate">{labels[slotIndex % Math.max(1, labels.length)] || `Produto ${slotIndex + 1}`}</span>
                  </div>
                ))}
                {totalSlots > 3 && <div className="text-[11px] font-semibold text-slate-400">+ {totalSlots - 3} horario(s)</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function deduplicateProductOptions(products: CatalogProduct[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    const key = formatProductOptionLabel(product)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getCampaignCopyableDebug(
  campaign: WhatsAppStatusCampaign,
  progress?: WhatsAppStatusCampaignProgress,
) {
  if (campaign.last_error_debug) return campaign.last_error_debug;
  return (progress?.logs || []).find((log) => Boolean(log.debug_text))?.debug_text || '';
}

function CampaignProgressBar({
  campaign,
  progress,
  sendingSession,
  isSending,
  nowMs,
}: {
  campaign: WhatsAppStatusCampaign;
  progress?: WhatsAppStatusCampaignProgress;
  sendingSession?: { startedAt: string; total: number };
  isSending: boolean;
  nowMs: number;
}) {
  const manualLogs = sendingSession
    ? (progress?.logs || []).filter((log) => {
        const createdAt = parseProgressDate(log.created_at);
        return createdAt >= parseProgressDate(sendingSession.startedAt) - 3000
          && (log.slot_index === null || log.slot_index === undefined);
      })
    : [];
  const manualStarted = manualLogs.length;
  const manualFinished = manualLogs.filter((log) => ['sent', 'failed', 'skipped'].includes(String(log.status))).length;
  const manualFailed = manualLogs.filter((log) => log.status === 'failed').length;
  const manualSending = manualLogs.find((log) => log.status === 'sending') || null;
  const manualTotal = Math.max(1, sendingSession?.total || campaign.daily_limit || 1);
  const scheduled = progress?.scheduled;
  const scheduledPercent = scheduled?.percent ?? 0;
  const percent = isSending
    ? Math.min(100, Math.max(Math.round(((manualFinished + (manualSending ? 0.35 : 0)) / manualTotal) * 100), 8))
    : scheduledPercent;
  const tone = manualFailed > 0 || (progress?.today.failed || 0) > 0 ? 'bg-red-500' : isSending ? 'bg-emerald-500' : 'bg-blue-500';
  const lastLog = progress?.last_log || null;
  const sessionStartedAt = parseProgressDate(sendingSession?.startedAt);
  const activeStartedAt = parseProgressDate(manualSending?.created_at) || sessionStartedAt;
  const elapsed = isSending && sessionStartedAt ? formatElapsed(nowMs - sessionStartedAt) : '';
  const activeElapsed = isSending && activeStartedAt ? formatElapsed(nowMs - activeStartedAt) : '';
  const nextPollSeconds = isSending ? 3 : 10;
  const currentProduct = manualSending?.product_name || manualSending?.product_id || lastLog?.product_name || lastLog?.product_id || 'produto';
  const traceEvents = progress?.trace_events || [];
  const label = isSending
    ? `Enviando agora ${manualFinished}/${manualTotal} finalizados`
    : `Programado hoje ${scheduled?.done || 0}/${scheduled?.total || campaign.daily_limit}`;
  const detail = isSending
    ? (manualSending
        ? `Aguardando WAHA: ${currentProduct} ha ${activeElapsed}`
        : manualStarted > 0
          ? `Ultima etapa: ${statusLabel(manualLogs[0]?.status)} - ${manualLogs[0]?.product_name || manualLogs[0]?.product_id || 'produto'}`
          : 'Criando fila no servidor e preparando primeiro Status')
    : lastLog
      ? `${statusLabel(lastLog.status)} ${formatProgressTime(lastLog.created_at)} - ${lastLog.product_name || lastLog.product_id || 'produto'}`
      : scheduled?.next_scheduled_for
        ? `Proximo slot: ${formatProgressTime(scheduled.next_scheduled_for)}`
        : 'Nenhum envio registrado hoje';

  return (
    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {isSending && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-600" />}
          <span className="truncate text-xs font-bold text-slate-700">{label}</span>
        </div>
        <span className="text-xs font-black text-slate-500">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${tone} transition-all duration-500`} style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="min-w-0 flex-1 truncate">{detail}</span>
        {progress?.today.total_logs ? (
          <span className="shrink-0 font-semibold">
            Hoje: {progress.today.sent} ok / {progress.today.failed} erro
          </span>
        ) : null}
      </div>
      {isSending && (
        <div className="mt-3 grid gap-2 text-[11px] text-slate-500 sm:grid-cols-3">
          <span className="rounded-md bg-white px-2 py-1 font-semibold">Iniciados: {manualStarted}/{manualTotal}</span>
          <span className="rounded-md bg-white px-2 py-1 font-semibold">Tempo total: {elapsed || '0s'}</span>
          <span className="rounded-md bg-white px-2 py-1 font-semibold">Atualiza em ~{nextPollSeconds}s</span>
        </div>
      )}
      {isSending && manualLogs.length > 0 && (
        <div className="mt-2 space-y-1">
          {manualLogs.slice(0, 3).map((log, index) => (
            <div key={log.id || `${log.product_id}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1 text-[11px]">
              <span className="min-w-0 truncate text-slate-600">{log.product_name || log.product_id || 'produto'}</span>
              <span className={`shrink-0 font-bold ${log.status === 'failed' ? 'text-red-600' : log.status === 'sent' ? 'text-emerald-600' : 'text-slate-500'}`}>
                {statusLabel(log.status)}
              </span>
            </div>
          ))}
        </div>
      )}
      {traceEvents.length > 0 && (
        <details className="mt-3 border-t border-slate-200 pt-3" onClick={(event) => event.stopPropagation()}>
          <summary className="cursor-pointer select-none text-xs font-black text-slate-700">
            Ver processo completo ({traceEvents.length} etapas)
          </summary>
          <div className="mt-3 space-y-2 border-l-2 border-slate-200 pl-3">
            {traceEvents.map((event) => {
              const detail = traceDetails(event);
              return (
                <div key={event.id} className={`rounded-md border px-3 py-2 text-[11px] ${traceStateClasses(event.state)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black">{event.stage.replace(/\./g, ' / ')}</span>
                    <span className="font-semibold">
                      {formatProgressTime(event.created_at)}{event.elapsed_ms != null ? ` · ${formatElapsed(event.elapsed_ms)}` : ''}
                    </span>
                  </div>
                  {event.message && <p className="mt-1 font-semibold">{event.message}</p>}
                  {detail && <p className="mt-1 break-words opacity-80">{detail}</p>}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

export default function WhatsAppStatusCampaignPanel() {
  const [campaigns, setCampaigns] = useState<WhatsAppStatusCampaign[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categoryPreviewProducts, setCategoryPreviewProducts] = useState<CatalogProduct[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [paymentFees, setPaymentFees] = useState<PaymentFee[]>([]);
  const [form, setForm] = useState<WhatsAppStatusCampaignInput>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [pendingProductId, setPendingProductId] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<CatalogProduct[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [progressByCampaign, setProgressByCampaign] = useState<Record<string, WhatsAppStatusCampaignProgress>>({});
  const [sendSessions, setSendSessions] = useState<Record<string, { startedAt: string; total: number }>>({});
  const [lastDebug, setLastDebug] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const selectedProductIds = useMemo(() => {
    const raw = form.product_ids;
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return form.product_id ? [form.product_id] : [];
  }, [form.product_id, form.product_ids]);

  async function loadData() {
    setLoading(true);
    try {
      const [campaignRows, categoryRows] = await Promise.all([
        whatsappStatusCampaignService.list(),
        catalogService.getCategoriesWithNames(),
      ]);
      setCampaigns(campaignRows);
      setCategories(categoryRows);
    } catch (error) {
      toast.error('Erro ao carregar campanhas de Status');
    } finally {
      setLoading(false);
    }
  }

  async function loadProgress() {
    try {
      const result = await whatsappStatusCampaignService.progress();
      const next: Record<string, WhatsAppStatusCampaignProgress> = {};
      for (const item of result.campaigns || []) next[item.campaign_id] = item;
      setProgressByCampaign(next);
    } catch {
      // A barra e os logs sao auxiliares; a tela principal continua funcionando se a consulta falhar.
    }
  }

  useEffect(() => {
    loadData();
    loadProgress();
    paymentFeesService.list().then(setPaymentFees).catch(() => setPaymentFees([]));
  }, []);

  useEffect(() => {
    const intervalMs = sendingId ? 2500 : 10000;
    const timer = window.setInterval(loadProgress, intervalMs);
    return () => window.clearInterval(timer);
  }, [sendingId]);

  useEffect(() => {
    if (!sendingId) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sendingId]);

  useEffect(() => {
    if (!sendingId) return;
    const session = sendSessions[sendingId];
    const progress = progressByCampaign[sendingId];
    if (!session || !progress) return;
    const manualLogs = (progress.logs || []).filter((log) => {
      const createdAt = parseProgressDate(log.created_at);
      return createdAt >= parseProgressDate(session.startedAt) - 3000
        && (log.slot_index === null || log.slot_index === undefined);
    });
    const hasSending = manualLogs.some((log) => log.status === 'sending');
    const completed = manualLogs.filter((log) => ['sent', 'failed', 'skipped'].includes(String(log.status))).length;
    const newestLogAt = Math.max(0, ...manualLogs.map((log) => parseProgressDate(log.created_at)));
    const noActiveLogForAWhile = newestLogAt > 0 && Date.now() - newestLogAt > 10000;
    if (manualLogs.length > 0 && !hasSending && (completed >= session.total || noActiveLogForAWhile)) {
      setSendingId(null);
    }
  }, [progressByCampaign, sendSessions, sendingId]);

  useEffect(() => {
    if (form.source_type !== 'product') return;
    let mounted = true;
    const query = productSearch.trim();
    const timer = window.setTimeout(() => {
      setProductLoading(true);
      catalogService.getProducts(
        query ? { search: query, inStockOnly: true } : { inStockOnly: true },
        1,
        query ? 50 : 80,
        true,
      )
        .then((result) => {
          if (mounted) setProducts(result.products);
        })
        .catch(() => {
          if (mounted) toast.error('Erro ao buscar produtos');
        })
        .finally(() => {
          if (mounted) setProductLoading(false);
        });
    }, query ? 250 : 0);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [form.source_type, productSearch]);

  useEffect(() => {
    if (form.source_type !== 'product' || selectedProductIds.length === 0) return;
    const knownIds = new Set([...selectedProducts, ...products].map((product) => product.id));
    const missingIds = selectedProductIds.filter((id) => !knownIds.has(id));
    if (missingIds.length === 0) return;

    let mounted = true;
    vpsApiService.getProductsByIds(missingIds)
      .then((rows) => {
        if (!mounted || !rows) return;
        const resolved = rows.map(normalizeProduct) as unknown as CatalogProduct[];
        setSelectedProducts((current) => [...current, ...resolved]
          .filter((product, index, list) => list.findIndex((candidate) => candidate.id === product.id) === index));
      })
      .catch(() => {
        // Mantem os IDs selecionados; uma nova tentativa ocorre ao reabrir a programacao.
      });

    return () => {
      mounted = false;
    };
  }, [form.source_type, products, selectedProductIds.join('|'), selectedProducts]);

  useEffect(() => {
    if (form.source_type !== 'category' || !form.category_id) {
      setCategoryPreviewProducts([]);
      return;
    }

    let mounted = true;
    setPreviewLoading(true);
    catalogService.getProducts({ categories: [form.category_id], inStockOnly: true }, 1, 80, true)
      .then((result) => {
        if (mounted) setCategoryPreviewProducts(result.products);
      })
      .catch(() => {
        if (mounted) setCategoryPreviewProducts([]);
      })
      .finally(() => {
        if (mounted) setPreviewLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [form.source_type, form.category_id]);

  const previewProducts = useMemo(() => {
    if (form.source_type === 'product') {
      const previewPool = [...selectedProducts, ...products]
        .filter((product, index, list) => list.findIndex((item) => item.id === product.id) === index);
      return findGroupedPreviewProducts(previewPool, selectedProductIds);
    }
    return selectStatusProducts(categoryPreviewProducts, {
      dailyLimit: Math.min(3, Number(form.daily_limit || 3)),
    }) as any[];
  }, [categoryPreviewProducts, form.daily_limit, form.source_type, selectedProductIds, selectedProducts]);

  const selectableProducts = useMemo(
    () => deduplicateProductOptions(groupStatusProductsByVariation(products) as CatalogProduct[]),
    [products],
  );

  useEffect(() => {
    setPreviewIndex(0);
  }, [form.source_type, selectedProductIds.join('|'), form.category_id]);

  useEffect(() => {
    if (previewIndex >= previewProducts.length) setPreviewIndex(Math.max(0, previewProducts.length - 1));
  }, [previewIndex, previewProducts.length]);

  function updateSelectedProductIds(ids: string[]) {
    const unique = Array.from(new Set(ids)).slice(0, 10);
    setForm((current) => ({
      ...current,
      product_id: unique[0] || null,
      product_ids: unique,
      daily_limit: current.source_type === 'product' ? Math.min(10, Math.max(1, unique.length || Number(current.daily_limit || 1))) : current.daily_limit,
    }));
  }

  function addPendingProduct() {
    const product = selectableProducts.find((item) => item.id === pendingProductId);
    if (!product) {
      toast.error('Escolha um produto para adicionar');
      return;
    }
    if (selectedProductIds.includes(product.id)) {
      toast.info('Produto ja esta selecionado');
      return;
    }
    if (selectedProductIds.length >= 10) {
      toast.error('Limite de 10 produtos por programacao');
      return;
    }
    setSelectedProducts((current) => {
      const merged = [...current, product];
      return merged.filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);
    });
    updateSelectedProductIds([...selectedProductIds, product.id]);
    setPendingProductId('');
  }

  function removeSelectedProduct(productId: string) {
    updateSelectedProductIds(selectedProductIds.filter((id) => id !== productId));
    setSelectedProducts((current) => current.filter((product) => product.id !== productId));
    setForm((current) => current.repeat_product_id === productId
      ? { ...current, repeat_product_id: null, repeat_mode: 'full_day' }
      : current);
  }

  function startEdit(campaign: WhatsAppStatusCampaign) {
    setEditingId(campaign.id);
    setForm({
      title: campaign.title,
      source_type: campaign.source_type,
      product_id: campaign.product_id,
      product_ids: Array.isArray(campaign.product_ids) ? campaign.product_ids : (campaign.product_id ? [campaign.product_id] : []),
      category_id: campaign.category_id,
      daily_limit: campaign.daily_limit,
      interval_minutes: campaign.interval_minutes,
      start_time: normalizeTime(campaign.start_time),
      frequency: campaign.frequency,
      start_date: campaign.start_date || todayDateValue(),
      repeat_days: campaign.repeat_days || 1,
      repeat_mode: campaign.repeat_mode || 'full_day',
      repeat_product_id: campaign.repeat_product_id || null,
      active: Boolean(campaign.active),
    });
    setSelectedProducts([]);
    setPendingProductId('');
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM, start_date: todayDateValue() });
    setSelectedProducts([]);
    setPendingProductId('');
  }

  function updateForm<K extends keyof WhatsAppStatusCampaignInput>(key: K, value: WhatsAppStatusCampaignInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveCampaign() {
    setSaving(true);
    try {
      const payload = {
        ...form,
      daily_limit: form.repeat_mode === 'single_product'
        ? 1
        : form.source_type === 'category'
          ? 0
          : Math.max(1, Math.min(300, Number(form.daily_limit || 1))),
        interval_minutes: Math.max(1, Number(form.interval_minutes || 30)),
        start_date: form.start_date || todayDateValue(),
        repeat_days: Math.max(1, Math.min(30, Number(form.repeat_days || 1))),
        repeat_mode: form.repeat_mode === 'single_product' ? 'single_product' as WhatsAppStatusRepeatMode : 'full_day' as WhatsAppStatusRepeatMode,
        repeat_product_id: form.repeat_mode === 'single_product' ? (form.repeat_product_id || selectedProductIds[0] || null) : null,
        frequency: 'daily' as const,
        product_id: form.source_type === 'product' ? (selectedProductIds[0] || null) : null,
        product_ids: form.source_type === 'product' ? selectedProductIds : [],
        category_id: form.source_type === 'category' ? form.category_id : null,
      };

      if (payload.source_type === 'product' && selectedProductIds.length === 0) {
        toast.error('Adicione pelo menos um produto');
        return;
      }
      if (payload.repeat_mode === 'single_product' && !payload.repeat_product_id) {
        toast.error('Escolha o produto que sera repetido');
        return;
      }

      if (editingId) {
        const updated = await whatsappStatusCampaignService.update(editingId, payload);
        setCampaigns((current) => current.map((item) => item.id === editingId ? updated : item));
        toast.success('Programacao atualizada');
      } else {
        const created = await whatsappStatusCampaignService.create(payload);
        setCampaigns((current) => [created, ...current]);
        toast.success('Programacao criada');
      }
      resetForm();
    } catch (error) {
      toast.error('Erro ao salvar programacao');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCampaign(campaign: WhatsAppStatusCampaign) {
    try {
      const updated = await whatsappStatusCampaignService.update(campaign.id, { active: !campaign.active });
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? updated : item));
    } catch {
      toast.error('Erro ao atualizar status');
    }
  }

  async function deleteCampaign(campaign: WhatsAppStatusCampaign) {
    if (!window.confirm(`Excluir "${campaign.title}"?`)) return;
    try {
      await whatsappStatusCampaignService.delete(campaign.id);
      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      toast.success('Programacao excluida');
    } catch {
      toast.error('Erro ao excluir programacao');
    }
  }

  async function sendNow(campaign: WhatsAppStatusCampaign) {
    setNowMs(Date.now());
    setSendingId(campaign.id);
    setSendSessions((current) => ({
      ...current,
      [campaign.id]: { startedAt: new Date().toISOString(), total: Math.max(1, Number(campaign.daily_limit || 1)) },
    }));
    setLastDebug('');
    await loadProgress();
    let keepPolling = false;
    try {
      const result = await whatsappStatusCampaignService.sendNow(campaign.id);
      const debug = result.debug || result.logs?.map((log) => log.debug).filter(Boolean).join('\n\n') || '';
      if (debug) setLastDebug(debug);
      if (result.queued) {
        keepPolling = true;
        toast.success(result.already_running ? 'Envio ja esta em andamento' : 'Envio iniciado');
      } else if (result.failed > 0) {
        toast.error(`Envio finalizado com ${result.failed} erro(s)`);
      } else {
        toast.success(`${result.sent} status enviado(s)`);
      }
      await loadData();
      await loadProgress();
    } catch (error: any) {
      const debug = [
        'WHATSAPP_STATUS_SEND_NOW_FRONTEND_DEBUG',
        `Campanha: ${campaign.title} (${campaign.id})`,
        `Erro: ${error?.message || String(error)}`,
      ].join('\n');
      setLastDebug(debug);
      toast.error('Erro ao enviar agora');
    } finally {
      if (!keepPolling) setSendingId(null);
      window.setTimeout(loadProgress, 1200);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-900">Status WhatsApp</h3>
          <p className="text-sm text-slate-500">Envie produtos ou categorias para o Status com intervalo entre cada item.</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          title="Atualizar"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" />
            <h4 className="font-bold text-slate-800">{editingId ? 'Editar programacao' : 'Nova programacao'}</h4>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nome</span>
              <input
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Origem</span>
              <select
                value={form.source_type}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  source_type: event.target.value as WhatsAppStatusCampaignSourceType,
                  repeat_mode: event.target.value === 'category' ? 'full_day' : current.repeat_mode,
                  repeat_product_id: event.target.value === 'category' ? null : current.repeat_product_id,
                }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="category">Categoria</option>
                <option value="product">Produto especifico</option>
              </select>
            </label>

            {form.source_type === 'category' ? (
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Categoria</span>
                <select
                  value={form.category_id || ''}
                  onChange={(event) => updateForm('category_id', event.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Escolher categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div>
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Produto</span>
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Buscar por nome, SKU ou EAN"
                  className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex gap-2">
                  <select
                    value={pendingProductId}
                    onChange={(event) => setPendingProductId(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">{productLoading ? 'Buscando produtos...' : 'Produto para adicionar'}</option>
                    {!productLoading && products.length === 0 && productSearch.trim() && (
                      <option value="" disabled>Nenhum produto encontrado</option>
                    )}
                    {selectableProducts.map((product) => (
                      <option key={product.id} value={product.id} disabled={selectedProductIds.includes(product.id)}>
                        {formatProductOptionLabel(product)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addPendingProduct}
                    disabled={!pendingProductId || selectedProductIds.length >= 10}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    title="Adicionar produto"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase text-slate-500">Selecionados</span>
                    <span className="rounded bg-white px-2 py-0.5 text-xs font-bold text-slate-500">{selectedProductIds.length}/10</span>
                  </div>
                  {selectedProductIds.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-slate-400">Adicione ate 10 produtos para montar o carrossel.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedProductIds.map((productId, index) => {
                        const product = selectedProducts.find((item) => item.id === productId) || products.find((item) => item.id === productId);
                        return (
                          <div key={productId} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-xs text-slate-700">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-50 font-black text-emerald-700">{index + 1}</span>
                            <span className="min-w-0 flex-1 truncate">{product ? formatProductOptionLabel(product) : productId}</span>
                            <button
                              type="button"
                              onClick={() => removeSelectedProduct(productId)}
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Remover"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Quantidade</span>
                {form.source_type === 'category' ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                    Categoria completa
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                    {selectedProductIds.length || 0} produto(s)
                  </div>
                )}
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Intervalo min.</span>
                <input
                  type="number"
                  min={1}
                  value={form.interval_minutes}
                  onChange={(event) => updateForm('interval_minutes', Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Inicio</span>
                <input
                  type="time"
                  value={normalizeTime(form.start_time)}
                  onChange={(event) => updateForm('start_time', event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Data inicial</span>
                <input
                  type="date"
                  value={form.start_date || todayDateValue()}
                  onChange={(event) => updateForm('start_date', event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Repetir por dias</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={form.repeat_days}
                  onChange={(event) => updateForm('repeat_days', Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">O que repetir</span>
                <select
                  value={form.repeat_mode}
                  onChange={(event) => updateForm('repeat_mode', event.target.value as WhatsAppStatusRepeatMode)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="full_day">Programacao completa</option>
                  {form.source_type === 'product' && <option value="single_product">Produto especifico</option>}
                </select>
              </label>
            </div>

            {form.repeat_mode === 'single_product' && (
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Produto que sera repetido</span>
                <select
                  value={form.repeat_product_id || ''}
                  onChange={(event) => updateForm('repeat_product_id', event.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Escolher produto</option>
                  {selectedProductIds.map((productId) => {
                    const product = selectedProducts.find((item) => item.id === productId) || products.find((item) => item.id === productId);
                    return <option key={productId} value={productId}>{product?.name || productId}</option>;
                  })}
                </select>
              </label>
            )}

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(form.active)}
                onChange={(event) => updateForm('active', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Ativa
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={saveCampaign}
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Novo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <ScheduleDiagram form={form} products={previewProducts as CatalogProduct[]} />
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-emerald-600" />
                <h4 className="font-bold text-slate-800">Preview do Status</h4>
              </div>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
                {previewProducts.length ? `${previewIndex + 1}/${previewProducts.length}` : 'Aguardando'}
              </span>
            </div>

            {previewLoading || productLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="aspect-[9/10] animate-pulse bg-slate-100" />
                    <div className="space-y-2 p-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                      <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : previewProducts.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewIndex((current) => (current - 1 + previewProducts.length) % previewProducts.length)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    title="Status anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="w-full max-w-[280px]">
                    <StatusPreviewCard product={previewProducts[previewIndex]} paymentFees={paymentFees} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewIndex((current) => (current + 1) % previewProducts.length)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    title="Proximo status"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                {previewProducts.length > 1 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {previewProducts.map((product, index) => (
                      <button
                        key={`${product.id}-${index}`}
                        type="button"
                        onClick={() => setPreviewIndex(index)}
                        className={`h-2.5 rounded-full transition-all ${index === previewIndex ? 'w-6 bg-emerald-500' : 'w-2.5 bg-slate-200 hover:bg-slate-300'}`}
                        title={`Ver status ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                <MessageCircle className="mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm font-bold text-slate-500">Escolha um produto ou categoria para ver o preview.</p>
                <p className="mt-1 max-w-md text-xs text-slate-400">
                  O preview mostra a imagem, legenda, cores disponiveis, preco no PIX, 12x no cartao e link que serao enviados no Status.
                </p>
              </div>
            )}
          </div>

          {lastDebug && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  Debug de erro disponivel
                </div>
                <button
                  type="button"
                  onClick={() => copyDebug(lastDebug)}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800 hover:bg-amber-200"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </button>
              </div>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs text-amber-900">{lastDebug}</pre>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {campaigns.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">Nenhuma programacao de Status cadastrada.</div>
            ) : campaigns.map((campaign) => {
              const copyableDebug = getCampaignCopyableDebug(campaign, progressByCampaign[campaign.id]);
              return (
              <div key={campaign.id} className="border-b border-slate-100 p-4 last:border-b-0">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleCampaign(campaign)}
                    className="mt-1"
                    title={campaign.active ? 'Desativar' : 'Ativar'}
                  >
                    {campaign.active
                      ? <ToggleRight className="h-6 w-6 text-emerald-500" />
                      : <ToggleLeft className="h-6 w-6 text-slate-300" />}
                  </button>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => startEdit(campaign)}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') startEdit(campaign); }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">{campaign.title}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                        {campaign.source_type === 'category' ? 'Categoria' : 'Produto'}
                      </span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                        {campaign.source_type === 'category'
                          ? 'Categoria completa'
                          : `${campaign.daily_limit}/dia`}
                      </span>
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                        {campaign.interval_minutes} min
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {campaign.start_date ? `De ${new Date(`${campaign.start_date}T00:00:00`).toLocaleDateString('pt-BR')} por ${campaign.repeat_days} dia(s)` : `Inicio ${normalizeTime(campaign.start_time)} - ${campaign.frequency === 'daily' ? 'diaria' : campaign.frequency}`}
                      {' · '}{campaign.repeat_mode === 'single_product' ? 'repete um produto' : 'repete o dia completo'}
                    </p>
                    {copyableDebug && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          copyDebug(copyableDebug);
                        }}
                        className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar ultimo erro
                      </button>
                    )}
                    <CampaignProgressBar
                      campaign={campaign}
                      progress={progressByCampaign[campaign.id]}
                      sendingSession={sendSessions[campaign.id]}
                      isSending={sendingId === campaign.id}
                      nowMs={nowMs}
                    />
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => sendNow(campaign)}
                      disabled={sendingId === campaign.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
                      title="Enviar agora"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCampaign(campaign)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
