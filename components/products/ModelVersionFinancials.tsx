// model-version-financials-v1: custo, preço praticado e lucro POR VERSÃO na Página do Produto.
// Fonte única: grupo de preço do celular (o mesmo da Gestão de Modelos e do cadastro da família).
// Editar aqui grava no mesmo grupo (PUT /models/:id/smartphone-price-groups/:groupId), com conferência de revisão.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '../ui/CurrencyInput';
import { ModelPricesPanel } from '../settings/ModelPricesPanel';
import { smartphonePriceGroups, type SmartphonePriceGroup, type SmartphoneSalePrices } from '../../services/smartphonePriceGroups';
import { buildVersionFinancials, SALE_TIERS, validateSalePrices } from '../../utils/modelVersionFinancials.js';

const money = (cents: number | null | undefined) => cents === null || cents === undefined ? '—'
  : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (value: number | undefined) => value === undefined ? '' : `${value.toLocaleString('pt-BR')}%`;

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
          <p className="text-sm font-bold text-slate-900">{row.label || 'Versão sem RAM/armazenamento'}</p>
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
