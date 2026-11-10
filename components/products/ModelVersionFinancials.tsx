// model-version-financials-v1: custo, preço praticado e lucro POR VERSÃO na Página do Produto.
// Fonte única: grupo de preço do celular (o mesmo da Gestão de Modelos e do cadastro da família).
// Editar aqui grava no mesmo grupo (PUT /models/:id/smartphone-price-groups/:groupId), com conferência de revisão.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '../ui/CurrencyInput';
import { ModelPricesPanel } from '../settings/ModelPricesPanel';
import { smartphonePriceGroups, type SmartphonePriceGroup, type SmartphoneSalePrices } from '../../services/smartphonePriceGroups';
import { buildVersionFinancials, SALE_TIERS, validatePromo, validateSalePrices } from '../../utils/modelVersionFinancials.js';
import { saveProductsPromo } from '../../services/productPromo';

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

function PromoBlock({ row, onSaved }: { row: ReturnType<typeof buildVersionFinancials>[number]; onSaved: () => void }) {
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

function VersionRow({ row, onSaved }: { row: ReturnType<typeof buildVersionFinancials>[number]; onSaved: () => void }) {
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
  const preview = (key: typeof SALE_TIERS[number]['key']) => {
    const price = editing && draft ? draft[key] : row.prices?.[key] ?? null;
    if (!price || row.costBaseCents === null) return null;
    const profit = price - row.costBaseCents;
    return { profit, margin: Math.round((profit / price) * 1000) / 10 };
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3" aria-label={`Versão ${row.label}`}>
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
      <PromoBlock row={row} onSaved={onSaved} />
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
  const rows = useMemo(() => groupsState.status === 'ready' && groupsState.enabled ? buildVersionFinancials(groupsState.groups, memoryGroups) : [], [groupsState, memoryGroups]);
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
      {rows.map(row => <VersionRow key={row.id} row={row} onSaved={saved} />)}
      {panelOpen && <ModelPricesPanel modelId={modelId} modelName={modelName} onClose={() => { setPanelOpen(false); saved(); }} onSaved={saved} />}
    </section>
  );
}
