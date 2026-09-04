import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '../ui/CurrencyInput';
import { smartphonePriceGroups, SmartphonePriceGroup, SmartphoneSalePrices } from '../../services/smartphonePriceGroups';

const fields = [{ key: 'price_retail', label: 'Varejo' }, { key: 'price_reseller', label: 'Revenda' }, { key: 'price_wholesale', label: 'Atacado' }] as const;
const fmt = (cents: number | null) => cents === null ? 'Não informado' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ModelPricesPanel({ modelId, modelName, onClose, inline, onSaved }: {
    modelId: string; modelName: string; onClose: () => void; inline?: boolean; onSaved?: () => void;
}) {
    const [groups, setGroups] = useState<SmartphonePriceGroup[]>([]);
    const [unresolved, setUnresolved] = useState<Array<{ id: string; sku: string; name: string }>>([]);
    const [inputs, setInputs] = useState<Record<string, Partial<SmartphoneSalePrices>>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [onlyDivergent, setOnlyDivergent] = useState(false);
    const [minimumMargin, setMinimumMargin] = useState(10);
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const result = await smartphonePriceGroups.list(modelId);
            setGroups(result.groups); setUnresolved(result.unresolved);
            setInputs(Object.fromEntries(result.groups.map(g => [g.id, g.prices || {}])));
        } catch (e: any) { setError(e.message || 'Falha ao carregar preços'); }
        finally { setLoading(false); }
    }, [modelId]);
    useEffect(() => { void load(); }, [load]);

    async function save(group: SmartphonePriceGroup) {
        const values = inputs[group.id];
        if (fields.some(f => !Number.isSafeInteger(values?.[f.key]) || Number(values?.[f.key]) < 0)) {
            toast.error('Preencha varejo, revenda e atacado para definir o preço deste grupo.'); return;
        }
        setSaving(group.id);
        try {
            const result = await smartphonePriceGroups.save(group, values as SmartphoneSalePrices);
            toast.success(`Preço do grupo salvo para ${result.updated} produto(s). Custos preservados.`);
            await load(); onSaved?.();
        } catch (e: any) { toast.error(e.message || 'Não foi possível salvar o grupo'); }
        finally { setSaving(null); }
    }

    const body = <div className="p-4 space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-semibold">Preços por configuração — {modelName}</h3>
                <p className="text-slate-600">Todas as cores compartilham os preços. Novas entradas herdam o valor vigente; o custo continua individual.</p></div>
            <button type="button" onClick={() => void load()} disabled={loading || !!saving} className="text-blue-700 underline">Recarregar</button>
        </div>
        <div className="flex flex-wrap gap-4 items-center text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={onlyDivergent} onChange={e => setOnlyDivergent(e.target.checked)} />Só divergências ({groups.filter(g => g.divergent).length})</label>
            <label className="flex items-center gap-2">Alertar margem abaixo de <input aria-label="Margem mínima para alerta" type="number" min="0" max="100" className="w-16 rounded border p-1" value={minimumMargin} onChange={e => setMinimumMargin(Math.min(100, Math.max(0, Number(e.target.value))))} />%</label>
            <span className="text-slate-500">Alerta desta consulta; não altera preços.</span>
        </div>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {loading ? <Loader2 className="animate-spin" aria-label="Carregando grupos" /> : !error && <>
            {unresolved.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded p-3">Sem grupo: corrija RAM e armazenamento no cadastro de {unresolved.map(p => p.sku || p.name).join(', ')}.</div>}
            {groups.filter(g => !onlyDivergent || g.divergent).map(group => {
                const values = inputs[group.id] || {};
                return <section key={group.id} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
                    <div className="flex flex-wrap gap-2 items-center"><strong>{[group.ram, group.storage, group.version, group.network, group.condition !== 'new' ? group.condition : ''].filter(Boolean).join(' · ')}</strong>
                        <span className={group.divergent ? 'text-amber-700' : 'text-green-700'}>{group.divergent ? 'Preços divergentes — revisar' : group.confirmed ? 'Preço do grupo definido' : 'Preço atual uniforme — confirmar grupo'}</span></div>
                    <p className="text-xs text-slate-600">{group.products.length} variações · Custos: {fmt(group.cost_min)} a {fmt(group.cost_max)}</p>
                    {!group.prices && <p className="text-amber-700 text-xs">Escolha os três preços abaixo. Nenhum valor foi selecionado automaticamente.</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{fields.map(f => <label key={f.key} className="text-xs">{f.label}
                        <CurrencyInput value={values[f.key] ?? 0} disabled={!!saving} onChange={value => setInputs(prev => ({ ...prev, [group.id]: { ...prev[group.id], [f.key]: value } }))} />
                    </label>)}</div>
                    <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr>{['SKU / cor', 'Estoque', 'Custo', 'Varejo atual', 'Revenda atual', 'Atacado atual', 'Margem com preço informado'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
                        <tbody>{group.products.map(p => {
                            const costs = p.unit_costs?.length ? p.unit_costs : p.price_cost !== null ? [p.price_cost] : [];
                            const maxCost = costs.length ? Math.max(...costs) : null;
                            const retail = values.price_retail;
                            const margin = maxCost !== null && retail !== undefined && retail > 0 ? (retail - maxCost) / retail * 100 : null;
                            return <tr key={p.id} className="border-t border-slate-100"><td className="p-2">{p.sku} · {p.color}</td><td className="p-2">{p.stock_quantity}</td>
                                <td className="p-2">{costs.length ? costs.map((cost, i) => <div key={i}>{costs.length > 1 ? `Aparelho ${i + 1}: ` : ''}{fmt(cost)}</div>) : 'Não informado'}</td>
                                {fields.map(f => <td key={f.key} className="p-2 whitespace-nowrap">{fmt(p[f.key])}</td>)}
                                <td className={`p-2 ${margin !== null && margin < minimumMargin ? 'text-red-700 font-semibold' : ''}`}>{margin === null ? '—' : `${margin.toFixed(1)}%${margin < minimumMargin ? ' · revisar margem' : ''}`}{costs.length > 1 && <div className="font-normal">Menor margem entre os aparelhos</div>}</td></tr>;
                        })}</tbody></table></div>
                    <button type="button" disabled={!!saving} onClick={() => void save(group)} className="bg-green-700 text-white rounded px-4 py-2 disabled:opacity-50">{saving === group.id ? 'Salvando...' : `Salvar preço para todas as cores (${group.products.length})`}</button>
                </section>;
            })}
            {!groups.some(g => !onlyDivergent || g.divergent) && <p className="text-slate-500">{onlyDivergent ? 'Nenhum grupo divergente.' : 'Nenhuma configuração disponível.'}</p>}
        </>}
    </div>;
    return inline ? body : <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-6"><div className="max-w-5xl mx-auto bg-white rounded-xl"><button type="button" onClick={onClose} aria-label="Fechar preços" className="float-right p-3"><X /></button>{body}</div></div>;
}
