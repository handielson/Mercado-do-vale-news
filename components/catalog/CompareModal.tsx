import { useEffect, useState } from 'react';
import { X, GitCompare, Package, Trophy } from 'lucide-react';
import { useCompare } from '../../contexts/CompareContext';
import type { CatalogProduct } from '../../types/catalog';
import { formatPrice } from '../../services/installmentCalculator';
import { useVpsAuth } from '../../contexts/VpsAuthContext';
import { getEffectivePrice } from '../../hooks/useEffectiveCustomerType';
import { modelService } from '../../services/models';
import { versionService } from '../../services/versions-vps';
import type { Version } from '../../types/version';

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
    main_camera_mpx: 'Cam Principal Mpx',
    selfie_camera_mpx: 'Cam Selfie Mpx',
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
    versao: 'Versão',
    version: 'Versão',
};

const formatFieldKey = (key: string): string => {
    const defaultLabel = key
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    // Resolve basic translation
    const label = SPEC_LABELS[key.toLowerCase()] || defaultLabel;

    // Special handling for version
    if (label.toLowerCase() === 'version' || label.toLowerCase() === 'versao') return 'Versão';

    return label;
};

// Base keywords for physical dimension fields to exclude
const DIMENSION_KEYWORDS = [
    'profundidade', 'altura', 'largura', 'comprimento', 'dimensions', 'depth', 'height', 'width'
];
// Base keywords for package weight fields to exclude
const PACKAGE_WEIGHT_KEYWORDS = [
    'peso (kg)', 'peso kg', 'peso_kg', 'weight kg', 'weight_kg', 'peso da embalagem'
];

/** Collects all unique spec keys across all products */
function collectSpecKeys(templates: (Record<string, unknown> | null)[]): string[] {
    // Collect unique keys
    const rawKeys = new Set<string>();
    templates.forEach(t => {
        if (!t) return;
        Object.keys(t).forEach(k => {
            if (!['imei1', 'imei2', 'serial', 'id', 'created_at', 'updated_at'].includes(k.toLowerCase())) {
                rawKeys.add(k);
            }
        });
    });

    // Deduplicate by formatted label
    const uniqueKeys: string[] = [];
    const seenLabels = new Set<string>();

    Array.from(rawKeys).forEach(key => {
        const label = formatFieldKey(key);
        const lcLabel = label.toLowerCase();

        // Exclude legacy "Rede" (replaced by "Rede Operadora")
        if (lcLabel === 'rede') return;

        // Exclude physical dimensions
        const isDimension = DIMENSION_KEYWORDS.some(kw => lcLabel.includes(kw));

        // Exclude package weight (allow exact product weight like 'peso (g)' or 'peso g' but exclude standalone 'peso' as it's usually package)
        const isPackageWeight = PACKAGE_WEIGHT_KEYWORDS.some(kw => lcLabel.includes(kw)) || lcLabel === 'peso' || lcLabel === 'weight';

        if (isDimension || isPackageWeight) return;

        if (!seenLabels.has(label)) {
            seenLabels.add(label);
            uniqueKeys.push(key);
        }
    });

    return uniqueKeys.sort((a, b) => {
        const ia = Object.keys(SPEC_LABELS).indexOf(a.toLowerCase());
        const ib = Object.keys(SPEC_LABELS).indexOf(b.toLowerCase());
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
}

/** Tries to parse value as a number for highlight comparison */
function toNumber(val: unknown, key?: string): number | null {
    if (val === null || val === undefined || val === '') return null;

    const strVal = String(val);

    // Default extraction for normal fields
    if (!key || (key.toLowerCase() !== 'processor' && key.toLowerCase() !== 'processador')) {
        const s = strVal.replace(/[^\d.,]/g, '').replace(',', '.');
        const n = parseFloat(s);
        return isNaN(n) ? null : n;
    }

    // Advanced scoring for Processors
    let score = 0;
    const lower = strVal.toLowerCase();

    // Base processor family tiering
    if (lower.includes('snapdragon 8 gen 3')) score += 9000;
    else if (lower.includes('snapdragon 8 gen 2')) score += 8000;
    else if (lower.includes('snapdragon 8+ gen 1')) score += 7500;
    else if (lower.includes('snapdragon 8 gen 1')) score += 7000;
    else if (lower.includes('snapdragon 8')) score += 6000;
    else if (lower.includes('snapdragon 7+ gen 2') || lower.includes('snapdragon 7 gen 3')) score += 6500;
    else if (lower.includes('snapdragon 7s gen 2') || lower.includes('snapdragon 7 gen 1')) score += 5000;
    else if (lower.includes('snapdragon 7')) score += 4000;
    else if (lower.includes('snapdragon 6')) score += 3000;
    else if (lower.includes('snapdragon 4')) score += 2000;

    if (lower.includes('dimensity 9300')) score += 9000;
    else if (lower.includes('dimensity 9200')) score += 8000;
    else if (lower.includes('dimensity 9000')) score += 7000;
    else if (lower.includes('dimensity 8300')) score += 6800;
    else if (lower.includes('dimensity 8200')) score += 6000;
    else if (lower.includes('dimensity 8100')) score += 5800;
    else if (lower.includes('dimensity 8000')) score += 5500;
    else if (lower.includes('dimensity 7300') || lower.includes('dimensity 7200')) score += 4500;
    else if (lower.includes('dimensity 7000')) score += 4000;
    else if (lower.includes('dimensity 6000')) score += 3500;
    else if (lower.includes('dimensity 1080') || lower.includes('dimensity 920')) score += 3500;
    else if (lower.includes('dimensity')) score += 3000;

    if (lower.includes('helio g99')) score += 2500;
    else if (lower.includes('helio g96') || lower.includes('helio g95')) score += 2000;
    else if (lower.includes('helio g88') || lower.includes('helio g85')) score += 1500;
    else if (lower.includes('helio g81') || lower.includes('helio g80')) score += 1200;
    else if (lower.includes('helio')) score += 1000;

    if (lower.includes('apple a17')) score += 9500;
    else if (lower.includes('apple a16')) score += 8500;
    else if (lower.includes('apple a15')) score += 7500;
    else if (lower.includes('apple a14')) score += 6500;

    if (lower.includes('exynos 2400')) score += 8500;
    else if (lower.includes('exynos 2200')) score += 7000;
    else if (lower.includes('exynos 2100')) score += 6000;
    else if (lower.includes('exynos 1480')) score += 5500;
    else if (lower.includes('exynos 1380')) score += 4000;
    else if (lower.includes('exynos')) score += 2000;

    // Tie-breaker using GHz if provided
    const ghzMatch = strVal.match(/([\d.,]+)\s*[Gg][Hh][Zz]/);
    if (ghzMatch) {
        const freq = parseFloat(ghzMatch[1].replace(',', '.'));
        score += freq * 10; // Small bump for frequency to break ties inside the same tier
    }

    return score > 0 ? score : null;
}

export function CompareModal({ onClose }: CompareModalProps) {
    const { selected, clear } = useCompare();
    const { customer } = useVpsAuth();

    // Fetch template_values from `models` table for each product
    const [templateValues, setTemplateValues] = useState<(Record<string, unknown> | null)[]>([]);
    const [versionsMap, setVersionsMap] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            const [results, versionsData] = await Promise.all([
                Promise.all(
                    selected.map(async (p) => {
                        if (!p.model_id) return null;
                        const model = await modelService.getById(p.model_id);
                        return (model?.template_values as Record<string, unknown>) || null;
                    })
                ),
                versionService.list()
            ]);

            if (versionsData) {
                setVersionsMap(new Map(versionsData.map((v: Version) => [v.id, v.name])));
            }

            setTemplateValues(results);
            setLoading(false);
        };
        fetchAll();
    }, [selected]);

    const specKeys = collectSpecKeys(templateValues);

    /** Determines which column index has the "best" numeric value for a given spec key */
    const getBestIndex = (key: string, products: CatalogProduct[]): number | null => {
        const formattedKeyLower = formatFieldKey(key).toLowerCase();

        // Exclude subjective or non-numeric fields from "Best" highlighting
        const subjectiveKeywords = [
            'display', 'tela', 'resolu', 'resolution',
            'rede', 'network', 'vers', 'version',
            'os', 'sistema', 'android', 'cor', 'color'
        ];
        if (subjectiveKeywords.some(kw => formattedKeyLower.includes(kw))) return null;

        // Lower is better for price, weight; higher is better for most specs
        const higherIsBetter = !['weight', 'weight_g', 'weight_kg', 'peso_g', 'peso_kg'].includes(key.toLowerCase());
        const numbers = templateValues.map(tv => {
            if (!tv) return null;
            const val = tv[key] !== undefined ? tv[key] : Object.entries(tv).find(([k]) => formatFieldKey(k) === formatFieldKey(key))?.[1];
            return toNumber(val, key);
        });
        const valid = numbers.filter(n => n !== null) as number[];
        if (valid.length < 2) return null;
        const best = higherIsBetter ? Math.max(...valid) : Math.min(...valid);

        // Check for tie (if multiple products have the best score, nobody "wins")
        const bestCount = numbers.filter(n => n === best).length;
        if (bestCount > 1) return null;

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
                                                const val = tv ? (tv[key] !== undefined ? tv[key] : Object.entries(tv).find(([k]) => formatFieldKey(k) === formatFieldKey(key))?.[1]) : undefined;
                                                const isBest = bestIdx === colIdx;
                                                return (
                                                    <td
                                                        key={product.id}
                                                        className={`p-4 text-center text-sm transition-colors ${isBest ? 'bg-green-50 text-green-700 font-semibold' : 'text-slate-800'}`}
                                                    >
                                                        <div className="flex items-center justify-center gap-1.5 break-words">
                                                            {isBest && <Trophy className="w-4 h-4 text-green-600 shrink-0" />}
                                                            <span>
                                                                {val !== undefined && val !== null && val !== ''
                                                                    ? (key.toLowerCase() === 'versao' || key.toLowerCase() === 'version') && typeof val === 'string' && versionsMap.has(val)
                                                                        ? versionsMap.get(val)
                                                                        : String(val)
                                                                    : <span className="text-slate-300">—</span>
                                                                }
                                                            </span>
                                                        </div>
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
                                                    className="prose prose-xs max-w-none"
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
