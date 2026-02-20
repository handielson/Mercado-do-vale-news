import { useEffect, useState } from 'react';
import { X, GitCompare, Package } from 'lucide-react';
import { useCompare } from '../../contexts/CompareContext';
import type { CatalogProduct } from '../../types/catalog';
import { formatPrice } from '../../services/installmentCalculator';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';
import { getEffectivePrice } from '../../hooks/useEffectiveCustomerType';
import { supabase } from '../../services/supabase';

interface CompareModalProps {
    onClose: () => void;
}

/** Retorna nome do modelo sem sufixo de RAM/storage. Ex: "Redmi Note 15, 8GB/256GB" → "Redmi Note 15" */
const cleanModelName = (p: CatalogProduct): string =>
    (p.model || p.name || 'Produto').replace(/,?\s*\d+\s*[GT]B\/\d+\s*[GT]B.*/i, '').trim();

/** Maps technical field keys to Portuguese display labels — shared with ProductDetailsModal */
const SPEC_LABELS: Record<string, string> = {
    ram: 'Memória RAM',
    storage: 'Armazenamento',
    color: 'Cor',
    battery_mah: 'Bateria (mAh)',
    battery_health: 'Saúde da Bateria',
    display: 'Display (pol)',
    resolution: 'Resolução',
    refresh_rate: 'Taxa de Atualização',
    main_camera_mpx: 'Câmera Principal',
    selfie_camera_mpx: 'Câmera Frontal',
    nfc: 'NFC',
    network: 'Rede',
    wifi: 'Wi-Fi',
    bluetooth: 'Bluetooth',
    usb: 'USB',
    chipset: 'Chipset',
    processor: 'Processador',
    antutu: 'AnTuTu',
    gpu: 'GPU',
    os: 'Sistema Operacional',
    android: 'Android',
    sim: 'SIM Card',
    sensors: 'Sensores',
    charging: 'Carregamento',
    weight: 'Peso',
    dimensions: 'Dimensões',
    material: 'Material',
    certification: 'Certificação',
    origin: 'Origem',
    voltage: 'Voltagem',
    warranty: 'Garantia',
};

const formatFieldKey = (key: string): string => {
    const lower = key.toLowerCase();
    if (SPEC_LABELS[lower]) return SPEC_LABELS[lower];
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

/** Collects all unique spec keys across all products */
function collectSpecKeys(templateValues: (Record<string, unknown> | null)[]): string[] {
    const ignore = new Set(['imei1', 'imei2', 'serial', 'id', 'created_at', 'updated_at']);
    const keySet = new Set<string>();
    for (const tv of templateValues) {
        if (!tv) continue;
        for (const key of Object.keys(tv)) {
            if (!ignore.has(key.toLowerCase())) keySet.add(key);
        }
    }
    // Sort: known SPEC_LABELS first, then alphabetical
    const knownOrder = Object.keys(SPEC_LABELS);
    return Array.from(keySet).sort((a, b) => {
        const ia = knownOrder.indexOf(a.toLowerCase());
        const ib = knownOrder.indexOf(b.toLowerCase());
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
}

/** Tries to parse value as a number for highlight comparison */
function toNumber(val: unknown): number | null {
    if (val === null || val === undefined || val === '') return null;
    const s = String(val).replace(/[^\d.,]/g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
}

export function CompareModal({ onClose }: CompareModalProps) {
    const { selected, clear } = useCompare();
    const { customer } = useSupabaseAuth();

    // Fetch template_values from `models` table for each product
    const [templateValues, setTemplateValues] = useState<(Record<string, unknown> | null)[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            const results = await Promise.all(
                selected.map(async (p) => {
                    if (!p.model_id) return null;
                    const { data } = await supabase
                        .from('models')
                        .select('template_values')
                        .eq('id', p.model_id)
                        .single();
                    return (data?.template_values as Record<string, unknown>) || null;
                })
            );
            setTemplateValues(results);
            setLoading(false);
        };
        fetchAll();
    }, [selected]);

    const specKeys = collectSpecKeys(templateValues);

    /** Determines which column index has the "best" numeric value for a given spec key */
    const getBestIndex = (key: string, products: CatalogProduct[]): number | null => {
        // Lower is better for price, weight; higher is better for most specs
        const higherIsBetter = !['weight', 'weight_g', 'weight_kg', 'peso_g', 'peso_kg'].includes(key.toLowerCase());
        const numbers = templateValues.map(tv => tv ? toNumber(tv[key]) : null);
        const valid = numbers.filter(n => n !== null) as number[];
        if (valid.length < 2) return null;
        const best = higherIsBetter ? Math.max(...valid) : Math.min(...valid);
        return numbers.findIndex(n => n === best);
    };

    const getPriceBestIndex = (): number | null => {
        const prices = selected.map(p => getEffectivePrice(p, customer));
        const valid = prices.filter(p => p > 0);
        if (valid.length < 2) return null;
        const best = Math.min(...valid); // lower price = better
        return prices.findIndex(p => p === best);
    };

    return (
        <div className="fixed inset-0 z-[60] flex flex-col">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal panel */}
            <div className="relative flex flex-col bg-white w-full h-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
                    <div className="flex items-center gap-2">
                        <GitCompare className="text-blue-600" size={22} />
                        <h2 className="text-xl font-bold text-slate-900">Comparar Produtos</h2>
                        <span className="text-sm text-slate-500">({selected.length} selecionados)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { clear(); onClose(); }}
                            className="text-sm text-slate-500 hover:text-red-600 transition-colors"
                        >
                            Limpar comparação
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <X size={20} className="text-slate-600" />
                        </button>
                    </div>
                </div>

                {/* Scrollable table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full min-w-[600px] border-collapse">
                        <colgroup>
                            <col className="w-40" />
                            {selected.map((_, i) => <col key={i} />)}
                        </colgroup>

                        <thead className="sticky top-0 z-10 bg-white shadow-sm">
                            <tr>
                                {/* Label column */}
                                <th className="p-4 text-left text-sm font-semibold text-slate-500 border-b border-slate-200 bg-slate-50">
                                    Especificação
                                </th>
                                {selected.map((product) => (
                                    <th key={product.id} className="p-4 border-b border-slate-200 text-center">
                                        {/* Product image */}
                                        <div className="flex flex-col items-center gap-2">
                                            {product.images?.[0] ? (
                                                <img
                                                    src={product.images[0]}
                                                    alt={product.name}
                                                    className="w-20 h-20 object-contain rounded-lg border border-slate-200 bg-slate-50"
                                                />
                                            ) : (
                                                <div className="w-20 h-20 bg-slate-200 rounded-lg flex items-center justify-center">
                                                    <Package size={32} className="text-slate-400" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm leading-tight">
                                                    {cleanModelName(product)}
                                                </p>
                                                {product.brand && (
                                                    <p className="text-xs text-slate-500">{product.brand}</p>
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {/* ── Price row ─────────────────────────────────────── */}
                            <tr className="border-b border-slate-100">
                                <td className="p-4 text-sm font-semibold text-slate-600 bg-slate-50">
                                    Preço (PIX)
                                </td>
                                {selected.map((product, i) => {
                                    const price = getEffectivePrice(product, customer);
                                    const bestIdx = getPriceBestIndex();
                                    const isBest = bestIdx === i;
                                    return (
                                        <td key={product.id} className="p-4 text-center">
                                            <span className={`font-bold text-lg ${isBest ? 'text-green-700' : 'text-slate-900'}`}>
                                                {price > 0 ? formatPrice(price) : '—'}
                                            </span>
                                            {isBest && (
                                                <div className="text-xs text-green-600 font-medium mt-0.5">✓ Melhor preço</div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>

                            {/* ── Spec rows ─────────────────────────────────────── */}
                            {loading ? (
                                <tr>
                                    <td colSpan={selected.length + 1} className="py-12 text-center text-slate-500">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2" />
                                        <p className="text-sm">Carregando especificações...</p>
                                    </td>
                                </tr>
                            ) : specKeys.length === 0 ? (
                                <tr>
                                    <td colSpan={selected.length + 1} className="py-12 text-center text-slate-500">
                                        <Package size={40} className="mx-auto mb-2 text-slate-300" />
                                        <p className="text-sm">Especificações não disponíveis para estes produtos</p>
                                    </td>
                                </tr>
                            ) : (
                                specKeys.map((key, rowIdx) => {
                                    const bestIdx = getBestIndex(key, selected);
                                    const rowBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                                    return (
                                        <tr key={key} className={`border-b border-slate-100 ${rowBg}`}>
                                            <td className="p-4 text-sm font-semibold text-slate-600 bg-slate-50">
                                                {formatFieldKey(key)}
                                            </td>
                                            {selected.map((product, colIdx) => {
                                                const tv = templateValues[colIdx];
                                                const val = tv ? tv[key] : undefined;
                                                const isBest = bestIdx === colIdx;
                                                return (
                                                    <td
                                                        key={product.id}
                                                        className={`p-4 text-center text-sm transition-colors ${isBest ? 'bg-green-50 text-green-700 font-semibold' : 'text-slate-800'}`}
                                                    >
                                                        {val !== undefined && val !== null && val !== ''
                                                            ? String(val)
                                                            : <span className="text-slate-300">—</span>
                                                        }
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })
                            )}

                            {/* ── Description row ───────────────────────────────── */}
                            {selected.some(p => p.description) && (
                                <tr className="border-b border-slate-100">
                                    <td className="p-4 text-sm font-semibold text-slate-600 bg-slate-50 align-top">
                                        Descrição
                                    </td>
                                    {selected.map(product => (
                                        <td key={product.id} className="p-4 text-xs text-slate-700 align-top max-w-xs">
                                            {product.description ? (
                                                <div
                                                    className="prose prose-xs max-w-none line-clamp-6"
                                                    dangerouslySetInnerHTML={{ __html: product.description }}
                                                />
                                            ) : (
                                                <span className="text-slate-300">—</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            )}
                        </tbody>

                        {/* ── Footer: Quote buttons ──────────────────────────── */}
                        <tfoot className="sticky bottom-0 bg-white border-t-2 border-slate-200">
                            <tr>
                                <td className="p-4 bg-slate-50" />
                                {selected.map(product => (
                                    <td key={product.id} className="p-4 text-center">
                                        <a
                                            href={`https://wa.me/?text=${encodeURIComponent(`Olá, tenho interesse no produto: ${cleanModelName(product)}`)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-block w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
                                        >
                                            Enviar Orçamento
                                        </a>
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
