import React, { useEffect, useState } from 'react';
import { AlertTriangle, Copy, Play, Plus, RefreshCw, Save, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { catalogService } from '../../../../services/catalogService';
import type { CatalogProduct } from '../../../../types/catalog';
import {
  whatsappStatusCampaignService,
  type WhatsAppStatusCampaign,
  type WhatsAppStatusCampaignInput,
  type WhatsAppStatusCampaignSourceType,
} from '../../../../services/whatsappStatusCampaignService';

const DEFAULT_FORM: WhatsAppStatusCampaignInput = {
  title: 'Status diario de produtos',
  source_type: 'category',
  product_id: null,
  category_id: null,
  daily_limit: 10,
  interval_minutes: 30,
  start_time: '08:00',
  frequency: 'daily',
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

export default function WhatsAppStatusCampaignPanel() {
  const [campaigns, setCampaigns] = useState<WhatsAppStatusCampaign[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [form, setForm] = useState<WhatsAppStatusCampaignInput>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [lastDebug, setLastDebug] = useState('');

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

  useEffect(() => {
    loadData();
  }, []);

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

  function startEdit(campaign: WhatsAppStatusCampaign) {
    setEditingId(campaign.id);
    setForm({
      title: campaign.title,
      source_type: campaign.source_type,
      product_id: campaign.product_id,
      category_id: campaign.category_id,
      daily_limit: campaign.daily_limit,
      interval_minutes: campaign.interval_minutes,
      start_time: normalizeTime(campaign.start_time),
      frequency: campaign.frequency,
      active: Boolean(campaign.active),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
  }

  function updateForm<K extends keyof WhatsAppStatusCampaignInput>(key: K, value: WhatsAppStatusCampaignInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveCampaign() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        daily_limit: Math.max(1, Math.min(10, Number(form.daily_limit || 1))),
        interval_minutes: Math.max(1, Number(form.interval_minutes || 30)),
        product_id: form.source_type === 'product' ? form.product_id : null,
        category_id: form.source_type === 'category' ? form.category_id : null,
      };

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
    setSendingId(campaign.id);
    setLastDebug('');
    try {
      const result = await whatsappStatusCampaignService.sendNow(campaign.id);
      const debug = result.debug || result.logs?.map((log) => log.debug).filter(Boolean).join('\n\n') || '';
      if (debug) setLastDebug(debug);
      if (result.failed > 0) {
        toast.error(`Envio finalizado com ${result.failed} erro(s)`);
      } else {
        toast.success(`${result.sent} status enviado(s)`);
      }
      await loadData();
    } catch (error: any) {
      const debug = [
        'WHATSAPP_STATUS_SEND_NOW_FRONTEND_DEBUG',
        `Campanha: ${campaign.title} (${campaign.id})`,
        `Erro: ${error?.message || String(error)}`,
      ].join('\n');
      setLastDebug(debug);
      toast.error('Erro ao enviar agora');
    } finally {
      setSendingId(null);
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
                onChange={(event) => updateForm('source_type', event.target.value as WhatsAppStatusCampaignSourceType)}
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
                <select
                  value={form.product_id || ''}
                  onChange={(event) => updateForm('product_id', event.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">{productLoading ? 'Buscando produtos...' : 'Escolher produto'}</option>
                  {!productLoading && products.length === 0 && productSearch.trim() && (
                    <option value="" disabled>Nenhum produto encontrado</option>
                  )}
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {formatProductOptionLabel(product)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Qtd. por dia</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.daily_limit}
                  onChange={(event) => updateForm('daily_limit', Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
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
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Frequencia</span>
                <select
                  value={form.frequency}
                  onChange={(event) => updateForm('frequency', event.target.value as any)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                  <option value="once">Uma vez</option>
                </select>
              </label>
            </div>

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
            ) : campaigns.map((campaign) => (
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

                  <button type="button" onClick={() => startEdit(campaign)} className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">{campaign.title}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                        {campaign.source_type === 'category' ? 'Categoria' : 'Produto'}
                      </span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                        {campaign.daily_limit}/dia
                      </span>
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                        {campaign.interval_minutes} min
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Inicio {normalizeTime(campaign.start_time)} - {campaign.frequency === 'daily' ? 'diaria' : campaign.frequency}
                    </p>
                    {campaign.last_error_debug && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          copyDebug(campaign.last_error_debug);
                        }}
                        className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar ultimo erro
                      </button>
                    )}
                  </button>

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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
