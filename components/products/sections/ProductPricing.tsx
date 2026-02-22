import React, { useState, useEffect } from 'react';
import { UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { ProductInput } from '../../../types/product';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { DollarSign, ShoppingCart, Users, Package, BarChart2 } from 'lucide-react';
import { supabase } from '../../../services/supabase';

interface ProductPricingProps {
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
    modelId?: string;  // Para buscar médias do estoque atual
}

interface StockAverages {
    totalUnits: number;
    avg_cost: number;
    avg_retail: number;
    avg_reseller: number;
    avg_wholesale: number;
}

interface PriceRowConfig {
    key: keyof ProductInput;
    label: string;
    audience: string;
    color: string;
    borderColor: string;
    bgColor: string;
    textColor: string;
    ringColor: string;
    quickPercents: number[];
    icon: React.ReactNode;
}

function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function calcMargin(cost: number, price: number) {
    const marginCents = price - cost;
    const marginPct = cost > 0 ? ((price - cost) / cost) * 100 : 0;
    const markup = cost > 0 ? price / cost : 0;
    return { marginCents, marginPct, markup };
}

export function ProductPricing({ watch, setValue, modelId }: ProductPricingProps) {
    const cost = watch('price_cost') || 0;
    const priceRetail = watch('price_retail') || 0;
    const priceReseller = watch('price_reseller') || 0;
    const priceWholesale = watch('price_wholesale') || 0;

    // --- Médias do estoque atual ---
    const [stockAverages, setStockAverages] = useState<StockAverages | null>(null);
    const [loadingAverages, setLoadingAverages] = useState(false);

    useEffect(() => {
        if (!modelId) { setStockAverages(null); return; }
        let cancelled = false;
        const fetch = async () => {
            setLoadingAverages(true);
            try {
                const { data } = await supabase
                    .from('products')
                    .select('price_cost, price_retail, price_reseller, price_wholesale, stock_quantity')
                    .eq('model_id', modelId)
                    .eq('status', 'active');
                if (cancelled || !data || data.length === 0) { setStockAverages(null); return; }
                const totalUnits = data.reduce((s, p) => s + (p.stock_quantity || 0), 0);
                if (totalUnits === 0) { setStockAverages(null); return; }
                const wavg = (field: keyof typeof data[0]) =>
                    Math.round(data.reduce((s, p) => s + ((p[field] as number) * (p.stock_quantity || 0)), 0) / totalUnits);
                if (!cancelled) setStockAverages({
                    totalUnits,
                    avg_cost: wavg('price_cost'),
                    avg_retail: wavg('price_retail'),
                    avg_reseller: wavg('price_reseller'),
                    avg_wholesale: wavg('price_wholesale'),
                });
            } finally {
                if (!cancelled) setLoadingAverages(false);
            }
        };
        fetch();
        return () => { cancelled = true; };
    }, [modelId]);
    // --- fim médias ---

    const rows: PriceRowConfig[] = [
        {
            key: 'price_retail',
            label: 'Preço Varejo',
            audience: 'Clientes finais (consumidor direto)',
            color: 'green',
            borderColor: 'border-green-200',
            bgColor: 'bg-green-50',
            textColor: 'text-green-700',
            ringColor: 'focus:ring-green-500',
            quickPercents: [10, 20, 30, 50, 100],
            icon: <ShoppingCart size={15} className="text-green-600" />,
        },
        {
            key: 'price_reseller',
            label: 'Preço Revenda',
            audience: 'Revendedores cadastrados',
            color: 'blue',
            borderColor: 'border-blue-200',
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-700',
            ringColor: 'focus:ring-blue-500',
            quickPercents: [10, 15, 20, 25, 30],
            icon: <Users size={15} className="text-blue-600" />,
        },
        {
            key: 'price_wholesale',
            label: 'Preço Atacado',
            audience: 'Compras em grande volume (Pix/Dinheiro)',
            color: 'orange',
            borderColor: 'border-orange-200',
            bgColor: 'bg-orange-50',
            textColor: 'text-orange-700',
            ringColor: 'focus:ring-orange-500',
            quickPercents: [5, 10, 15, 20, 25],
            icon: <Package size={15} className="text-orange-600" />,
        },
    ];

    const priceValues: Record<string, number> = {
        price_retail: priceRetail,
        price_reseller: priceReseller,
        price_wholesale: priceWholesale,
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center gap-2 mb-2">
                <DollarSign size={18} className="text-slate-600" />
                <h3 className="font-semibold text-slate-800">Precificação</h3>
            </div>

            {/* Painel de Médias do Estoque Atual */}
            {modelId && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart2 size={15} className="text-amber-600" />
                        <span className="text-sm font-semibold text-amber-800">Médias do Estoque Atual</span>
                        {loadingAverages && <span className="text-xs text-amber-500 ml-auto">carregando...</span>}
                        {stockAverages && !loadingAverages && (
                            <span className="text-xs text-amber-600 ml-auto">{stockAverages.totalUnits} unidade{stockAverages.totalUnits !== 1 ? 's' : ''} em estoque</span>
                        )}
                    </div>
                    {!loadingAverages && !stockAverages && (
                        <p className="text-xs text-amber-600">Nenhum produto em estoque para este modelo.</p>
                    )}
                    {stockAverages && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {([
                                { label: '💰 Custo', value: stockAverages.avg_cost, color: 'text-slate-700' },
                                { label: '🛒 Varejo', value: stockAverages.avg_retail, color: 'text-green-700' },
                                { label: '👥 Revenda', value: stockAverages.avg_reseller, color: 'text-blue-700' },
                                { label: '📦 Atacado', value: stockAverages.avg_wholesale, color: 'text-orange-700' },
                            ]).map(({ label, value, color }) => (
                                <div key={label} className="bg-white rounded-lg p-3 border border-amber-100 text-center">
                                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                                    <p className={`text-sm font-bold ${color}`}>{formatCurrency(value)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-slate-800">💰 Preço de Custo</p>
                        <p className="text-xs text-slate-500 mt-0.5">Valor pago na compra do produto</p>
                    </div>
                    <div className="w-full sm:w-52">
                        <CurrencyInput
                            value={cost}
                            onChange={(val) => setValue('price_cost', val)}
                        />
                    </div>
                </div>
            </div>

            {/* Linhas de preço por canal */}
            <div className="space-y-3">
                {rows.map((row) => {
                    const price = priceValues[row.key as string] || 0;
                    const { marginCents, marginPct, markup } = calcMargin(cost, price);
                    const hasPrice = price > 0 && cost > 0;
                    const isNegative = marginCents < 0;

                    return (
                        <div
                            key={row.key}
                            className={`rounded-xl border ${row.borderColor} ${row.bgColor} p-4`}
                        >
                            {/* Header da linha */}
                            <div className="flex items-center gap-2 mb-3">
                                {row.icon}
                                <div>
                                    <span className="text-sm font-semibold text-slate-800">{row.label}</span>
                                    <span className="ml-2 text-xs text-slate-400">{row.audience}</span>
                                </div>
                            </div>

                            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                                {/* Campo de preço */}
                                <div className="w-full lg:w-52 shrink-0">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Preço de Venda (R$)
                                    </label>
                                    <CurrencyInput
                                        value={price}
                                        onChange={(val) => setValue(row.key, val)}
                                    />
                                </div>

                                {/* Indicadores de margem */}
                                {hasPrice && (
                                    <div className="flex flex-wrap gap-3 flex-1">
                                        <div className="flex flex-col items-center bg-white rounded-lg px-4 py-2 border border-slate-200 min-w-[80px]">
                                            <span className="text-xs text-slate-500 mb-0.5">Lucro</span>
                                            <span className={`text-sm font-bold ${isNegative ? 'text-red-600' : row.textColor}`}>
                                                {formatCurrency(marginCents)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-center bg-white rounded-lg px-4 py-2 border border-slate-200 min-w-[70px]">
                                            <span className="text-xs text-slate-500 mb-0.5">Margem</span>
                                            <span className={`text-sm font-bold ${isNegative ? 'text-red-600' : row.textColor}`}>
                                                {marginPct.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-center bg-white rounded-lg px-4 py-2 border border-slate-200 min-w-[70px]">
                                            <span className="text-xs text-slate-500 mb-0.5">Markup</span>
                                            <span className={`text-sm font-bold ${isNegative ? 'text-red-600' : 'text-slate-700'}`}>
                                                {markup.toFixed(2)}x
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Botões rápidos de % */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs text-slate-500 whitespace-nowrap">Aplicar margem:</span>
                                    {row.quickPercents.map((pct) => (
                                        <button
                                            key={pct}
                                            type="button"
                                            disabled={cost === 0}
                                            onClick={() => setValue(row.key, Math.round(cost * (1 + pct / 100)))}
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors
                                                ${cost === 0
                                                    ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                                                    : `border-${row.color}-300 ${row.textColor} bg-white hover:${row.bgColor}`
                                                }`}
                                        >
                                            +{pct}%
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Aviso de margem negativa */}
                            {hasPrice && isNegative && (
                                <p className="text-xs text-red-600 mt-2 font-medium">
                                    ⚠️ Preço abaixo do custo — prejuízo de {formatCurrency(Math.abs(marginCents))} por unidade
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
