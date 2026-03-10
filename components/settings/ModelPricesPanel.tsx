import React, { useEffect, useState, useCallback } from 'react';
import { X, TrendingDown, TrendingUp, Loader2, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { getPriceHistory, applyPricesToVariation, PriceSnapshot } from '../../services/priceHistoryService';
import { toast } from 'sonner';
import { CurrencyInput } from '../ui/CurrencyInput';

interface Variation {
    ram: string;
    storage: string;
    products: {
        id: string;
        name: string;
        stock_quantity: number;
        price_cost: number;
        price_retail: number;
        price_reseller: number;
        price_wholesale: number;
    }[];
}

interface ModelPricesPanelProps {
    modelId: string;
    modelName: string;
    onClose: () => void;
}

function fmt(cents: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
}

function dateLabel(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function ModelPricesPanel({ modelId, modelName, onClose }: ModelPricesPanelProps) {
    const [variations, setVariations] = useState<Variation[]>([]);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState<string | null>(null);

    // priceInputs: newPrices per variation key (ram|storage)
    const [priceInputs, setPriceInputs] = useState<Record<string, {
        price_cost: number;
        price_retail: number;
        price_reseller: number;
        price_wholesale: number;
    }>>({});

    // history per product_id
    const [history, setHistory] = useState<Record<string, PriceSnapshot[]>>({});
    const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, specs, stock_quantity, price_cost, price_retail, price_reseller, price_wholesale')
                .eq('model_id', modelId)
                .eq('status', 'active')
                .order('name');

            if (error) throw error;

            // Group by RAM + Storage variation
            const map: Record<string, Variation> = {};
            for (const p of data || []) {
                const ram = p.specs?.ram || '';
                const storage = p.specs?.storage || '';
                const key = `${ram}|${storage}`;
                if (!map[key]) map[key] = { ram, storage, products: [] };
                map[key].products.push(p);
            }

            const vars = Object.values(map);
            setVariations(vars);

            // Default price inputs: weighted average of each variation
            const inputs: typeof priceInputs = {};
            for (const v of vars) {
                const key = `${v.ram}|${v.storage}`;
                const total = v.products.reduce((s, p) => s + (p.stock_quantity || 0), 0);
                const wavg = (field: keyof typeof v.products[0]) =>
                    total > 0
                        ? Math.round(v.products.reduce((s, p) => s + ((p[field] as number) * (p.stock_quantity || 0)), 0) / total)
                        : (v.products[0]?.[field] as number) || 0;

                inputs[key] = {
                    price_cost: wavg('price_cost'),
                    price_retail: wavg('price_retail'),
                    price_reseller: wavg('price_reseller'),
                    price_wholesale: wavg('price_wholesale'),
                };
            }
            setPriceInputs(inputs);
        } catch (e: any) {
            toast.error('Erro ao carregar produtos: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, [modelId]);

    useEffect(() => { loadData(); }, [loadData]);

    async function loadHistory(productId: string) {
        if (history[productId]) return;
        const h = await getPriceHistory(productId, 5);
        setHistory(prev => ({ ...prev, [productId]: h }));
    }

    async function handleApply(variation: Variation) {
        const key = `${variation.ram}|${variation.storage}`;
        const prices = priceInputs[key];
        if (!prices) return;

        setApplying(key);
        try {
            await applyPricesToVariation(variation.products, prices);
            toast.success(`Preços aplicados para ${variation.products.length} produto(s)!`);

            // Clear cached history so it reloads on next expand
            const newHistory = { ...history };
            variation.products.forEach(p => delete newHistory[p.id]);
            setHistory(newHistory);

            await loadData();
        } catch (e: any) {
            toast.error('Erro ao aplicar preços: ' + e.message);
        } finally {
            setApplying(null);
        }
    }

    const PRICE_FIELDS = [
        { key: 'price_cost' as const, label: 'Custo', color: 'slate' },
        { key: 'price_retail' as const, label: 'Varejo', color: 'green' },
        { key: 'price_reseller' as const, label: 'Revenda', color: 'blue' },
        { key: 'price_wholesale' as const, label: 'Atacado', color: 'orange' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16 px-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mb-16">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-xl">
                            <DollarSign size={20} className="text-green-700" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Preços — {modelName}</h2>
                            <p className="text-xs text-slate-500">Gerencie e aplique preços por variação</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={18} className="text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={28} className="animate-spin text-slate-400" />
                        </div>
                    ) : variations.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-12">
                            Nenhum produto ativo encontrado para este modelo.
                        </p>
                    ) : (
                        variations.map(v => {
                            const key = `${v.ram}|${v.storage}`;
                            const prices = priceInputs[key] || { price_cost: 0, price_retail: 0, price_reseller: 0, price_wholesale: 0 };
                            const isApplying = applying === key;
                            const totalStock = v.products.reduce((s, p) => s + (p.stock_quantity || 0), 0);

                            return (
                                <div key={key} className="border border-slate-200 rounded-xl overflow-hidden">
                                    {/* Variation header */}
                                    <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-3 border-b border-slate-200">
                                        <span className="text-sm font-semibold text-slate-700">
                                            {[v.ram, v.storage].filter(Boolean).join(' · ') || 'Sem variação'}
                                        </span>
                                        <span className="text-xs text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                                            {v.products.length} produto{v.products.length !== 1 ? 's' : ''} · {totalStock} em estoque
                                        </span>
                                    </div>

                                    <div className="p-4 space-y-4">
                                        {/* Price inputs */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {PRICE_FIELDS.map(f => (
                                                <div key={f.key}>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                                                    <CurrencyInput
                                                        value={prices[f.key]}
                                                        onChange={cents => {
                                                            setPriceInputs(prev => ({
                                                                ...prev,
                                                                [key]: { ...prev[key], [f.key]: cents }
                                                            }));
                                                        }}
                                                        className="w-full h-10 py-2 text-sm"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* Apply button */}
                                        <button
                                            onClick={() => handleApply(v)}
                                            disabled={isApplying}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                        >
                                            {isApplying
                                                ? <><Loader2 size={15} className="animate-spin" />Aplicando...</>
                                                : <><CheckCircle size={15} />Aplicar Preços para todos ({v.products.length})</>
                                            }
                                        </button>

                                        {/* Products with price history */}
                                        <div className="space-y-2">
                                            {v.products.map(p => (
                                                <div key={p.id} className="border border-slate-100 rounded-lg">
                                                    {/* Product row */}
                                                    <button
                                                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 rounded-lg transition-colors"
                                                        onClick={async () => {
                                                            await loadHistory(p.id);
                                                            setExpandedHistory(expandedHistory === p.id ? null : p.id);
                                                        }}
                                                    >
                                                        <Clock size={13} className="text-slate-400 shrink-0" />
                                                        <span className="text-xs text-slate-700 flex-1 truncate">{p.name}</span>
                                                        <span className="text-xs text-slate-400">
                                                            Varejo: {fmt(p.price_retail)}
                                                        </span>
                                                        <span className="text-xs text-slate-400 ml-1">ver histórico ▾</span>
                                                    </button>

                                                    {/* History */}
                                                    {expandedHistory === p.id && (
                                                        <div className="px-3 pb-3">
                                                            {!history[p.id] ? (
                                                                <p className="text-xs text-slate-400 py-1">Carregando...</p>
                                                            ) : history[p.id].length === 0 ? (
                                                                <p className="text-xs text-slate-400 py-1">Nenhum histórico registrado.</p>
                                                            ) : (
                                                                <div className="space-y-1 mt-1">
                                                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Últimas alterações</p>
                                                                    {history[p.id].map((h, i) => (
                                                                        <div key={h.id} className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 items-center text-xs py-1 border-b border-slate-100 last:border-0">
                                                                            <span className="text-slate-400 whitespace-nowrap">{dateLabel(h.changed_at)}</span>
                                                                            <span className="text-slate-600">Custo: {fmt(h.price_cost)}</span>
                                                                            <span className="text-green-700">Varejo: {fmt(h.price_retail)}</span>
                                                                            <span className="text-blue-700">Revenda: {fmt(h.price_reseller)}</span>
                                                                            <span className="text-orange-700">Atacado: {fmt(h.price_wholesale)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
