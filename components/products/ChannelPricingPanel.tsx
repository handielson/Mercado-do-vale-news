// channel-profit-v1: lucro por canal e edição do preço de venda (Página do Produto).
import { useEffect, useState } from 'react';
import { Loader2, Settings2, X } from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '../ui/CurrencyInput';
import { CHANNELS, calculateChannelProfit, defaultChannelFee, isChannelFeeConfigured, suggestTikTokFeesFromSummary } from '../../utils/channelProfit.js';
import { loadChannelFees, loadSkuListings, loadTikTokFeeSummary, saveChannelFee, updateListingPrice, type ChannelFee, type ChannelFeeMap, type ChannelId, type ChannelListing, type TikTokFeeSummary } from '../../services/channelPricing';
import { MercadoLivreListingPrice } from './sections/MercadoLivreListingPrice';
import { updateProductManualCost } from '../../services/adminMarketplaceSalesService';
import { vpsApiService } from '../../services/vpsApiService';

const money = (cents: number | null | undefined) => cents === null || cents === undefined ? '—'
  : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let feesPromise: Promise<ChannelFeeMap> | null = null;
const feeListeners = new Set<(fees: ChannelFeeMap) => void>();
export function useChannelFees() {
  const [fees, setFees] = useState<ChannelFeeMap | null>(null);
  useEffect(() => {
    feeListeners.add(setFees);
    feesPromise ||= loadChannelFees();
    void feesPromise.then(setFees);
    return () => { feeListeners.delete(setFees); };
  }, []);
  return fees;
}
function publishFees(fees: ChannelFeeMap) {
  feesPromise = Promise.resolve(fees);
  feeListeners.forEach(listener => listener(fees));
}

const pctInput = (value: number) => String(value).replace('.', ',');
const parsePct = (value: string) => Number(String(value).replace(',', '.')) || 0;

export function ChannelFeeSettingsModal({ onClose }: { onClose: () => void }) {
  const fees = useChannelFees();
  const [channel, setChannel] = useState<ChannelId>('shopee_m');
  const [draft, setDraft] = useState<ChannelFee | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (fees) setDraft(structuredClone(fees[channel])); }, [fees, channel]);
  const set = (patch: Partial<ChannelFee>) => setDraft(current => current ? { ...current, ...patch } : current);
  const save = async () => {
    if (!draft || !fees) return;
    setSaving(true);
    try {
      await saveChannelFee(channel, draft);
      publishFees({ ...fees, [channel]: { ...draft, saved: true } });
      toast.success('Taxas salvas.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar as taxas.');
    } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div><p className="text-xs font-semibold uppercase text-blue-700">Taxas por canal</p><h3 className="text-base font-bold text-slate-900">Usadas no cálculo de lucro de todos os produtos</h3></div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map(item => <button key={item.id} type="button" onClick={() => setChannel(item.id as ChannelId)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${channel === item.id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{item.label}</button>)}
          </div>
          {!draft ? <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p> : <>
            {channel === 'tiktok' && <TikTokRealFees onApply={(patch) => set(patch)} />}
            {fees && !fees[channel].saved && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Ainda não salvo — mostrando o padrão{channel.startsWith('shopee') ? ' (tabela Shopee 20% + taxa fixa CNPJ usada hoje no sistema)' : ' (sem taxas)'}. Confira e salve.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Comissão (%)<input inputMode="decimal" className="mt-1 block w-full rounded-lg border p-2" value={pctInput(draft.commissionPct)} onChange={e => set({ commissionPct: parsePct(e.target.value) })} /></label>
              <label className="text-sm">Teto da comissão (opcional)<CurrencyInput value={draft.commissionCapCents ?? 0} onChange={value => set({ commissionCapCents: value > 0 ? value : null })} /></label>
              <label className="text-sm">Taxa fixa por venda<CurrencyInput value={draft.fixedFeeCents} onChange={value => set({ fixedFeeCents: value })} /></label>
              <label className="text-sm">Impostos (%)<input inputMode="decimal" className="mt-1 block w-full rounded-lg border p-2" value={pctInput(draft.taxPct)} onChange={e => set({ taxPct: parsePct(e.target.value) })} /></label>
              <label className="text-sm">Outras taxas % (transação, ads, afiliados)<input inputMode="decimal" className="mt-1 block w-full rounded-lg border p-2" value={pctInput(draft.otherPct)} onChange={e => set({ otherPct: parsePct(e.target.value) })} /></label>
              <label className="text-sm">Embalagem por unidade<CurrencyInput value={draft.packagingCents} onChange={value => set({ packagingCents: value })} /></label>
              <label className="text-sm">Frete pago pela loja por unidade<CurrencyInput value={draft.shippingCents} onChange={value => set({ shippingCents: value })} /></label>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">Taxa fixa por faixa de preço</p>
                <button type="button" className="text-xs font-semibold text-blue-700 hover:underline" onClick={() => set({ tiers: [...draft.tiers, { upToCents: null, fixedCents: 0 }] })}>+ Faixa</button></div>
              {draft.tiers.length === 0 && <p className="mt-1 text-xs text-slate-500">Sem faixas. {channel.startsWith('shopee') && <button type="button" className="text-blue-700 underline" onClick={() => set({ tiers: defaultChannelFee(channel).tiers })}>Usar tabela Shopee</button>}</p>}
              {draft.tiers.map((tier, index) => <div key={index} className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <label className="text-xs">Até (vazio = acima)<CurrencyInput value={tier.upToCents ?? 0} onChange={value => set({ tiers: draft.tiers.map((t, i) => i === index ? { ...t, upToCents: value > 0 ? value : null } : t) })} /></label>
                <label className="text-xs">Taxa fixa<CurrencyInput value={tier.fixedCents} onChange={value => set({ tiers: draft.tiers.map((t, i) => i === index ? { ...t, fixedCents: value } : t) })} /></label>
                <button type="button" className="mb-2 text-xs text-red-600 hover:underline" onClick={() => set({ tiers: draft.tiers.filter((_, i) => i !== index) })}>Remover</button>
              </div>)}
            </div>
            <button type="button" disabled={saving} onClick={() => void save()} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar taxas deste canal'}</button>
          </>}
        </div>
      </div>
    </div>
  );
}

// tiktok-finance-fees-v1: taxas reais do TikTok pelo extrato dos pedidos concluídos; preenche o formulário para revisar e salvar.
function TikTokRealFees({ onApply }: { onApply: (patch: Partial<ChannelFee>) => void }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<TikTokFeeSummary | null>(null);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setSummary(await loadTikTokFeeSummary(20)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o TikTok.'); }
    finally { setLoading(false); }
  };
  const suggestion = summary ? suggestTikTokFeesFromSummary(summary) : null;
  const label = (path: string) => path.replace(/^statement_transactions\[\]\./, '').replace(/_amount$/, '').replace(/_/g, ' ');
  return (
    <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">Taxas reais do TikTok</p>
        <button type="button" disabled={loading} onClick={() => void load()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{loading ? 'Consultando extratos…' : summary ? 'Consultar de novo' : 'Buscar dos pedidos concluídos'}</button>
      </div>
      <p className="text-[11px] text-slate-500">Lê o extrato financeiro dos últimos pedidos concluídos/entregues no TikTok Shop e calcula quanto cada taxa representou sobre a receita.</p>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {summary && <>
        <p className="text-xs text-slate-600">{summary.orders_with_statement} de {summary.orders_considered} pedidos com extrato · receita {money(summary.revenue_cents)}{summary.error_count ? ` · ${summary.error_count} sem extrato (${summary.errors[0]?.message || 'erro'})` : ''}</p>
        {summary.orders_with_statement === 0 ? <p className="text-xs text-amber-800">Nenhum extrato disponível ainda (o TikTok só gera depois da liquidação do pedido, ou o app ainda não tem a permissão de Finanças).</p> : <>
          <div className="max-h-48 overflow-y-auto rounded border bg-white">
            <table className="w-full text-[11px]"><tbody>
              {summary.fields.filter(field => !field.path.includes('sku_')).map(field => <tr key={field.path} className="border-b last:border-0">
                <td className="px-2 py-1 text-slate-600">{label(field.path)}</td>
                <td className={`px-2 py-1 text-right font-mono ${field.total_cents < 0 ? 'text-red-700' : 'text-slate-700'}`}>{money(field.total_cents)}</td>
                <td className="px-2 py-1 text-right text-slate-500">{field.pct_of_revenue !== null ? `${field.pct_of_revenue.toLocaleString('pt-BR')}%` : ''}</td>
              </tr>)}
            </tbody></table>
          </div>
          {suggestion && <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-white p-2 text-xs">
            <span>Sugestão: comissão <strong>{suggestion.commissionPct.toLocaleString('pt-BR')}%</strong> · outras taxas <strong>{suggestion.otherPct.toLocaleString('pt-BR')}%</strong> · frete por pedido <strong>{money(suggestion.shippingCents)}</strong></span>
            <button type="button" onClick={() => onApply({ commissionPct: suggestion.commissionPct, otherPct: suggestion.otherPct, shippingCents: suggestion.shippingCents })} className="rounded bg-blue-600 px-2 py-1 font-semibold text-white">Usar no formulário</button>
          </div>}
          <p className="text-[11px] text-slate-500">Confira os valores e clique em "Salvar taxas deste canal".</p>
        </>}
      </>}
    </div>
  );
}

function ListingRow({ listing, costCents, fee, onSaved, product }: { listing: ChannelListing; costCents: number; fee: ChannelFee | null; onSaved: () => void; product: any }) {
  const [price, setPrice] = useState(listing.priceCents || 0);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setPrice(listing.priceCents || 0); setConfirming(false); }, [listing.priceCents]);
  const result = fee && price > 0 ? calculateChannelProfit({ priceCents: price, costCents, fee }) : null;
  const changed = price > 0 && price !== listing.priceCents;
  const save = async () => {
    setSaving(true);
    try {
      await updateListingPrice(listing, price);
      toast.success(`${listing.label}: preço atualizado para ${money(price)}.`);
      onSaved();
    } catch (error) {
      toast.error(`${listing.label}: ${error instanceof Error ? error.message : 'não foi possível atualizar o preço.'}`);
    } finally { setSaving(false); setConfirming(false); }
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">{listing.label} <span className="font-mono text-[11px] font-normal text-slate-400">{listing.reference}</span></p>
        <p className="text-xs text-slate-500">Atual: <strong className="text-slate-800">{money(listing.priceCents)}</strong></p>
      </div>
      {listing.error && <p className="mt-1 text-xs text-amber-700">{listing.error}</p>}
      <div className="mt-2 grid gap-3 sm:grid-cols-[180px_1fr]">
        <div>
          {listing.editable
            ? <CurrencyInput value={price} onChange={setPrice} label="Valor de venda" disabled={saving} />
            : <p className="text-xs text-slate-500">{listing.channel === 'mercado_livre' ? 'Use "Editar no Mercado Livre" abaixo.' : 'Edição indisponível.'}</p>}
        </div>
        {result ? <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-600 sm:grid-cols-3">
          <div><dt>Taxas</dt><dd className="font-semibold text-slate-800">{money(result.feesCents)}</dd></div>
          <div><dt>Custo</dt><dd className="font-semibold text-slate-800">{money(result.costCents)}</dd></div>
          <div><dt>Lucro</dt><dd className={`text-sm font-black ${result.profitCents >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{money(result.profitCents)} <span className="text-[11px] font-semibold">({result.marginPct.toLocaleString('pt-BR')}%)</span></dd></div>
          <div className="col-span-full text-[11px] text-slate-400">Comissão {money(result.commissionCents)} · fixa {money(result.fixedCents)} · impostos {money(result.taxCents)} · outras {money(result.otherCents)}{result.packagingCents ? ` · embalagem ${money(result.packagingCents)}` : ''}{result.shippingCents ? ` · frete ${money(result.shippingCents)}` : ''}</div>
          {listing.channel !== 'site' && fee && !isChannelFeeConfigured(fee) && <p className="col-span-full text-[11px] font-semibold text-amber-700">Taxas deste canal não configuradas — lucro sem taxas.</p>}
        </dl> : <p className="text-xs text-slate-400">Informe o preço para ver o lucro.</p>}
      </div>
      {listing.editable && changed && (confirming
        ? <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
            <span>Alterar {listing.label} de {money(listing.priceCents)} para <strong>{money(price)}</strong>?{listing.channel !== 'site' ? ' O preço muda direto no anúncio.' : ''}</span>
            <button type="button" disabled={saving} onClick={() => void save()} className="rounded bg-amber-600 px-2 py-1 font-semibold text-white disabled:opacity-60">{saving ? 'Enviando…' : 'Confirmar'}</button>
            <button type="button" disabled={saving} onClick={() => setConfirming(false)} className="underline">Cancelar</button>
          </div>
        : <div className="mt-2 flex gap-2"><button type="button" onClick={() => setConfirming(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">Salvar novo preço</button>
            <button type="button" onClick={() => setPrice(listing.priceCents || 0)} className="text-xs text-slate-500 underline">Desfazer</button></div>)}
      {listing.channel === 'mercado_livre' && <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-blue-700">Editar no Mercado Livre (tarifa oficial)</summary>
        <MercadoLivreListingPrice itemId={listing.meta.itemId} parentId={listing.meta.parentId} product={product} />
      </details>}
    </div>
  );
}

function CostEditor({ productId, registeredCostCents, costLock, inventoryUrl, onSaved }: { productId: string; registeredCostCents: number | null; costLock: string | null; inventoryUrl: string; onSaved: () => void }) {
  const [value, setValue] = useState(registeredCostCents || 0);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(registeredCostCents || 0); }, [registeredCostCents]);
  if (costLock) return <p className="text-xs text-slate-600">{costLock}{inventoryUrl && <> <a href={inventoryUrl} className="font-semibold text-blue-700 hover:underline">Abrir peças</a></>}</p>;
  const changed = value !== (registeredCostCents || 0);
  const save = async () => {
    setSaving(true);
    try {
      // Mesmo endpoint/regra do ajuste manual de custo: grava products.price_cost + histórico, com conferência de concorrência.
      await updateProductManualCost(productId, { cost_cents: value, expected_cost_cents: registeredCostCents, context: 'product_page_financial' });
      toast.success(`Custo atualizado para ${money(value)}.`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o custo.');
    } finally { setSaving(false); }
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-44"><CurrencyInput value={value} onChange={setValue} label="Custo de compra (cadastro)" disabled={saving} /></div>
      {changed && <button type="button" disabled={saving} onClick={() => void save()} className="mb-0.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar custo'}</button>}
      {changed && <button type="button" disabled={saving} onClick={() => setValue(registeredCostCents || 0)} className="mb-2 text-xs text-slate-500 underline">Desfazer</button>}
    </div>
  );
}

/** Preço e lucro do SKU em cada canal (site, Shopee, ML, TikTok), com edição. Usado na Página do Produto e no financeiro da venda. */
export function ChannelListingsPanel({ productId, product, costCents }: { productId: string; product?: any; costCents: number }) {
  const fees = useChannelFees();
  const [listings, setListings] = useState<ChannelListing[] | null>(null);
  const [loadedProduct, setLoadedProduct] = useState<any>(product || null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setListings(null);
    void (async () => {
      const current = product || await vpsApiService.getProductById(productId, true).catch(() => null) || { id: productId };
      const result = await loadSkuListings(productId, current);
      if (active) { setLoadedProduct(current); setListings(result); }
    })();
    return () => { active = false; };
  }, [productId, refresh]);
  return (
    <div className="space-y-2">
      {costCents <= 0 && <p className="rounded bg-amber-50 p-2 text-[11px] text-amber-800">Sem custo informado: o lucro abaixo considera custo zero.</p>}
      {!listings ? <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Consultando preços nos canais…</p>
        : listings.map(listing => <ListingRow key={listing.key} listing={listing} costCents={costCents} product={loadedProduct}
            fee={fees ? fees[listing.channel] : null}
            onSaved={() => setRefresh(value => value + 1)} />)}
      {listings && <button type="button" onClick={() => setRefresh(value => value + 1)} className="text-xs font-semibold text-blue-700 hover:underline">Consultar preços novamente</button>}
    </div>
  );
}

export function SkuChannelPricing({ productId, product, label, costCents, costSource, registeredCostCents = null, costLock = null, inventoryUrl = '', onCostSaved }: {
  productId: string; product: any; label?: string; costCents: number; costSource: string;
  registeredCostCents?: number | null; costLock?: string | null; inventoryUrl?: string; onCostSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{label || 'SKU'} <span className="font-mono text-xs font-normal text-slate-500">{product?.sku || ''}</span></p>
        <p className="text-xs text-slate-500">Custo: <strong className={costCents > 0 ? 'text-slate-800' : 'text-amber-700'}>{costCents > 0 ? money(costCents) : 'não informado'}</strong> <span className="text-slate-400">({costSource})</span></p>
      </div>
      <div className="mt-2"><CostEditor productId={productId} registeredCostCents={registeredCostCents} costLock={costLock} inventoryUrl={inventoryUrl} onSaved={() => { onCostSaved?.(); setRefresh(value => value + 1); }} /></div>
      <details className="mt-2" onToggle={event => setOpen((event.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-xs font-semibold text-blue-800">Preço e lucro por canal</summary>
        <div className="mt-2">{open && <ChannelListingsPanel key={refresh} productId={productId} product={product} costCents={costCents} />}</div>
      </details>
    </div>
  );
}

export function ChannelFeesButton() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
      <Settings2 className="h-4 w-4" /> Taxas por canal
    </button>
    {open && <ChannelFeeSettingsModal onClose={() => setOpen(false)} />}
  </>;
}
