import React, { useState, useEffect, useRef } from 'react';
import { UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { ProductInput } from '../../../types/product';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { DollarSign, ShoppingCart, Users, Package, BarChart2 } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { vpsApiService } from '../../../services/vpsApiService';

interface ProductPricingProps {
    watch: UseFormWatch<ProductInput>;
    setValue: UseFormSetValue<ProductInput>;
    errors?: any;
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

function normalizeSpecValue(value: unknown): string {
    return String(value || '').trim().toLowerCase();
}

function readSpecs(product: any): Record<string, any> {
    if (!product?.specs) return {};
    if (typeof product.specs === 'string') {
        try {
            return JSON.parse(product.specs) || {};
        } catch {
            return {};
        }
    }
    return product.specs;
}

function matchesMemoryVariation(product: any, selectedRam: string, selectedStorage: string): boolean {
    const specs = readSpecs(product);
    return (
        normalizeSpecValue(specs.ram) === normalizeSpecValue(selectedRam) &&
        normalizeSpecValue(specs.storage) === normalizeSpecValue(selectedStorage)
    );
}

export function ProductPricing({ watch, setValue, errors, modelId }: ProductPricingProps) {
    const cost = watch('price_cost') || 0;
    const priceRetail = watch('price_retail') || 0;
    const priceReseller = watch('price_reseller') || 0;
    const priceWholesale = watch('price_wholesale') || 0;
    const categoryId = watch('category_id');
    const selectedRam = watch('specs.ram') || '';
    const selectedStorage = watch('specs.storage') || '';

    // --- Margens automáticas da categoria ---
    const [marginWholesale, setMarginWholesale] = useState<number>(0);
    const [marginReseller, setMarginReseller] = useState<number>(0);
    const prevRetailRef = useRef(priceRetail);

    useEffect(() => {
        if (!categoryId) {
            setMarginWholesale(0);
            setMarginReseller(0);
            return;
        }
        const fetchMargins = async () => {
            const { data } = await supabase
                .from('categories')
                .select('margin_wholesale, margin_reseller')
                .eq('id', categoryId)
                .maybeSingle();
            if (data) {
                setMarginWholesale(data.margin_wholesale || 0);
                setMarginReseller(data.margin_reseller || 0);
            }
        };
        fetchMargins();
    }, [categoryId]);

    // Recalcula Atacado e Revenda sempre que o Varejo mudar (se houver margem configurada)
    useEffect(() => {
        if (priceRetail !== prevRetailRef.current) {
            prevRetailRef.current = priceRetail;
            if (priceRetail > 0) {
                if (marginWholesale > 0) {
                    setValue('price_wholesale', Math.round(priceRetail * (1 - (marginWholesale / 100))));
                }
                if (marginReseller > 0) {
                    setValue('price_reseller', Math.round(priceRetail * (1 - (marginReseller / 100))));
                }
            }
        }
    }, [priceRetail, marginWholesale, marginReseller, setValue]);

    // --- Médias do estoque atual ---
    const [stockAverages, setStockAverages] = useState<StockAverages | null>(null);
    const [loadingAverages, setLoadingAverages] = useState(false);

    useEffect(() => {
        if (!modelId || !selectedRam || !selectedStorage) { setStockAverages(null); return; }
        let cancelled = false;
        const fetch = async () => {
            setLoadingAverages(true);
            try {
                const products = await vpsApiService.getProducts({
                    model_id: modelId,
                    status: 'active',
                    limit: 500,
                    noCache: true,
                });
                const data = (products || []).filter(product => matchesMemoryVariation(product, selectedRam, selectedStorage));
                if (cancelled || data.length === 0) { setStockAverages(null); return; }
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
    }, [modelId, selectedRam, selectedStorage]);
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

            {(marginWholesale > 0 || marginReseller > 0) && (
                <div className="bg-blue-50 text-blue-800 text-sm px-4 py-2 rounded-lg border border-blue-200">
                    💡 <strong>Auto-Preços ativado:</strong> Esta categoria possui margem automática. Ao preencher o Preço de Varejo, os preços abaixo serão calculados sozinhos.
                    <div className="mt-1 flex gap-4 text-xs mt-1 text-blue-600">
                        {marginWholesale > 0 && <span>Atacado: -{marginWholesale}%</span>}
                        {marginReseller > 0 && <span>Revenda: -{marginReseller}%</span>}
                    </div>
                </div>
            )}

            {/* Painel de Médias do Estoque Atual */}
            {modelId && selectedRam && selectedStorage && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart2 size={15} className="text-amber-600" />
                        <span className="text-sm font-semibold text-amber-800">Médias do Estoque Atual</span>
                        <span className="text-xs text-amber-600">{selectedRam}/{selectedStorage}</span>
                        {loadingAverages && <span className="text-xs text-amber-500 ml-auto">carregando...</span>}
                        {stockAverages && !loadingAverages && (
                            <span className="text-xs text-amber-600 ml-auto">{stockAverages.totalUnits} unidade{stockAverages.totalUnits !== 1 ? 's' : ''} em estoque</span>
                        )}
                    </div>
                    {!loadingAverages && !stockAverages && (
                        <p className="text-xs text-amber-600">Nenhum produto em estoque para esta variação de memória.</p>
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
                    const desiredProfit = Math.max(0, price - cost);
                    const hasPrice = price > 0 && cost > 0;
                    const isNegative = marginCents < 0;

                    return (
                        <div
                            key={row.key}
                            className={`rounded-xl border ${row.borderColor} ${row.bgColor} p-3`}
                        >
                            {/* Header da linha */}
                            <div className="flex items-start gap-2 mb-3 min-w-0">
                                <span className="mt-0.5 shrink-0">{row.icon}</span>
                                <div className="min-w-0">
                                    <span className="block text-sm font-semibold text-slate-800">{row.label}</span>
                                    <span className="block text-xs text-slate-500 truncate">{row.audience}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-[220px_220px_minmax(230px,auto)_auto] xl:items-end gap-3">
                                {/* Campo de preço */}
                                <div className="w-full">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Preço de Venda (R$)
                                    </label>
                                    <CurrencyInput
                                        value={price}
                                        onChange={(val) => setValue(row.key, val)}
                                    />
                                    {errors?.[row.key] && (
                                        <p className="text-xs text-red-600 mt-1">{errors[row.key]?.message}</p>
                                    )}
                                </div>

                                {/* Campo de lucro desejado */}
                                <div className="w-full">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Quero ganhar (R$)
                                    </label>
                                    <CurrencyInput
                                        value={desiredProfit}
                                        onChange={(val) => setValue(row.key, cost + val)}
                                        disabled={cost === 0}
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1">Direto ou por lucro</p>
                                </div>

                                {/* Indicadores de margem */}
                                {hasPrice && (
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-white rounded-lg px-3 py-2 border border-slate-200">
                                            <span className="block text-[11px] text-slate-500 leading-none">Lucro</span>
                                            <span className={`block text-sm font-bold leading-tight mt-1 ${isNegative ? 'text-red-600' : row.textColor}`}>
                                                {formatCurrency(marginCents)}
                                            </span>
                                        </div>
                                        <div className="bg-white rounded-lg px-3 py-2 border border-slate-200">
                                            <span className="block text-[11px] text-slate-500 leading-none">Margem</span>
                                            <span className={`block text-sm font-bold leading-tight mt-1 ${isNegative ? 'text-red-600' : row.textColor}`}>
                                                {marginPct.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="bg-white rounded-lg px-3 py-2 border border-slate-200">
                                            <span className="block text-[11px] text-slate-500 leading-none">Markup</span>
                                            <span className={`block text-sm font-bold leading-tight mt-1 ${isNegative ? 'text-red-600' : 'text-slate-700'}`}>
                                                {markup.toFixed(2)}x
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Botões rápidos de % */}
                                <div className="flex items-center gap-1.5 flex-wrap xl:justify-end">
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

            {/* ── Promoção por Tempo Limitado ── */}
            <PromoSection watch={watch} setValue={setValue} errors={errors} />
        </div>
    );
}

// ── Componente interno de promoção ──
function PromoSection({ watch, setValue, errors }: { watch: UseFormWatch<ProductInput>; setValue: UseFormSetValue<ProductInput>; errors?: any; }) {
    const pricePromo = watch('price_promo') || 0;
    const promoStart = watch('promo_start') || '';
    const promoEnd = watch('promo_end') || '';
    const priceRetail = watch('price_retail') || 0;

    const toLocalInput = (iso: string) => {
        if (!iso) return '';
        return iso.slice(0, 16); // "YYYY-MM-DDTHH:MM"
    };

    const fromLocalInput = (val: string) => {
        if (!val) return '';
        return new Date(val).toISOString();
    };

    const now = new Date();
    const start = promoStart ? new Date(promoStart) : null;
    const end = promoEnd ? new Date(promoEnd) : null;
    const isActive = pricePromo > 0 && (!start || start <= now) && (!end || end >= now);
    const isPending = pricePromo > 0 && start && start > now;
    const isExpired = pricePromo > 0 && end && end < now;

    const discountPct = priceRetail > 0 && pricePromo > 0
        ? Math.round(((priceRetail - pricePromo) / priceRetail) * 100)
        : 0;

    return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🏷️</span>
                <div className="flex-1">
                    <span className="text-sm font-semibold text-slate-800">Promoção por Tempo Limitado</span>
                    <span className="ml-2 text-xs text-slate-400">Aparece no catálogo com preço riscado</span>
                </div>
                {isActive && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-semibold">✅ Ativa</span>
                )}
                {isPending && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">⏳ Agendada</span>
                )}
                {isExpired && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full font-semibold">⌛ Expirada</span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Preço Promo */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        Preço Promocional (R$)
                    </label>
                    <CurrencyInput
                        value={pricePromo}
                        onChange={(val) => setValue('price_promo', val || undefined)}
                    />
                    {errors?.price_promo && (
                         <p className="text-xs text-red-600 mt-1">{errors.price_promo.message}</p>
                    )}
                    {discountPct > 0 && (
                        <p className="text-xs text-red-600 mt-1 font-semibold">
                            -{discountPct}% de desconto sobre o varejo
                        </p>
                    )}
                </div>

                {/* Data Início */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        Início da Promoção
                    </label>
                    <input
                        type="datetime-local"
                        value={toLocalInput(promoStart)}
                        onChange={(e) => setValue('promo_start', fromLocalInput(e.target.value) || undefined as any)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">Deixe vazio = começa imediatamente</p>
                </div>

                {/* Data Fim */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        Fim da Promoção
                    </label>
                    <input
                        type="datetime-local"
                        value={toLocalInput(promoEnd)}
                        onChange={(e) => setValue('promo_end', fromLocalInput(e.target.value) || undefined as any)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">Deixe vazio = sem data limite</p>
                </div>
            </div>

            {pricePromo > 0 && (
                <button
                    type="button"
                    onClick={() => {
                        setValue('price_promo', undefined as any);
                        setValue('promo_start', undefined as any);
                        setValue('promo_end', undefined as any);
                    }}
                    className="mt-3 text-xs text-red-500 hover:text-red-700 underline"
                >
                    Remover promoção
                </button>
            )}
        </div>
    );
}
