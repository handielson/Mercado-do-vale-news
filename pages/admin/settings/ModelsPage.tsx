import React, { useEffect, useState, useCallback } from 'react';
import { Smartphone, Plus, Pencil, Trash2, ChevronDown, ChevronUp, CheckCircle, Loader2, Clock, Search, Save, UploadCloud, DownloadCloud, RefreshCw, Sparkles } from 'lucide-react';
import { Model } from '../../../types/model';
import { Brand } from '../../../types/brand';
import { modelService } from '../../../services/models';
import { brandService } from '../../../services/brands';
import { ModelModal } from '../../../components/settings/ModelModal';
import { BulkSeoModal } from '../../../components/settings/BulkSeoModal';
import { NextStepBanner } from '../../../components/ui/NextStepBanner';
import { supabase } from '../../../services/supabase';
import { getPriceHistory, applyPricesToVariation, PriceSnapshot } from '../../../services/priceHistoryService';
import { blingService } from '../../../services/blingService';
import { CurrencyInput } from '../../../components/ui/CurrencyInput';
import { toast } from 'sonner';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(cents: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
}

function dateLabel(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface ProductRow {
    id: string;
    name: string;
    sku: string;
    stock_quantity: number;
    price_cost: number;
    price_retail: number;
    price_reseller: number;
    price_wholesale: number;
    specs: any;
}

interface PriceState {
    price_cost: number;
    price_retail: number;
    price_reseller: number;
    price_wholesale: number;
}

// ─── ModelRow ────────────────────────────────────────────────────────────────

interface ModelRowProps {
    model: Model;
    brandName: string;
    index: number;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
    onEdit: (m: Model) => void;
    onDelete: (m: Model) => void;
    onRefresh: () => void;
}

function ModelRow({ model, brandName, index, isSelected, onToggleSelect, onEdit, onDelete, onRefresh }: ModelRowProps) {
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [loadingPrices, setLoadingPrices] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [syncingBling, setSyncingBling] = useState(false);
    const [pullingBling, setPullingBling] = useState(false);
    const [reimporting, setReimporting] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [prices, setPrices] = useState<PriceState>({
        price_cost: 0, price_retail: 0, price_reseller: 0, price_wholesale: 0,
    });
    // histórico por produto
    const [history, setHistory] = useState<Record<string, PriceSnapshot[]>>({});
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

    const loadPrices = useCallback(async () => {
        setLoadingPrices(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, sku, specs, stock_quantity, price_cost, price_retail, price_reseller, price_wholesale')
                .eq('model_id', model.id)
                .eq('status', 'active')
                .order('name');

            if (error) throw error;

            const rows: ProductRow[] = data || [];
            setProducts(rows);

            if (rows.length > 0) {
                // Média ponderada pelo estoque para o display inicial
                const total = rows.reduce((s, p) => s + (p.stock_quantity || 0), 0);
                const wavg = (field: keyof PriceState) =>
                    total > 0
                        ? Math.round(rows.reduce((s, p) => s + ((p[field] as number) * (p.stock_quantity || 0)), 0) / total)
                        : rows[0][field] || 0;

                setPrices({
                    price_cost: wavg('price_cost'),
                    price_retail: wavg('price_retail'),
                    price_reseller: wavg('price_reseller'),
                    price_wholesale: wavg('price_wholesale'),
                });
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoadingPrices(false);
        }
    }, [model.id]);

    useEffect(() => { loadPrices(); }, [loadPrices]);

    async function handleSave() {
        if (products.length === 0) return;
        setSaving(true);
        try {
            // Agrupa produtos por variação (ram|storage) — aplica os mesmos preços a todos
            const variation = { ram: '', storage: '', products };
            await applyPricesToVariation(products, prices);
            toast.success(`Preços salvos para ${products.length} produto(s)!`);
            setHistory({});
            await loadPrices();
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (e: any) {
            toast.error('Erro ao salvar preços: ' + e.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleSyncBling() {
        setSyncingBling(true);
        try {
            const res = await blingService.pushModelDimensionsToBling(model.id);
            if (res.ok) {
                const count = res.results?.filter((r: { success: boolean }) => r.success).length || 0;
                toast.success(`Medidas sincronizadas para ${count} produto(s) no Bling!`);
            } else {
                toast.error('Ocorreu um erro na conversão com o Bling.');
            }
        } catch (e: any) {
            toast.error(e.message || 'Erro ao sincronizar com o Bling');
        } finally {
            setSyncingBling(false);
        }
    }

    async function handlePullBling() {
        setPullingBling(true);
        try {
            const res = await blingService.pullModelDimensionsFromBling(model.id);
            if (res.ok) {
                toast.success('Medidas atualizadas com sucesso a partir do Bling!');
                onRefresh();
            }
        } catch (e: any) {
            toast.error(e.message || 'Erro ao puxar dimensões do Bling');
        } finally {
            setPullingBling(false);
        }
    }

    async function handleReimportBling() {
        setReimporting(true);
        try {
            const count = await blingService.reimportModelProductsFromBling(model.id);
            toast.success(`Foram re-sincronizados ${count} variação(ões) com o Bling com sucesso!`);
            onRefresh();
        } catch (e: any) {
            toast.error(e.message || 'Erro ao sincronizar produtos com o Bling');
        } finally {
            setReimporting(false);
        }
    }

    async function loadHistory(productId: string) {
        if (history[productId]) return;
        const h = await getPriceHistory(productId, 5);
        setHistory(prev => ({ ...prev, [productId]: h }));
    }

    async function toggleHistory(productId: string) {
        if (expandedHistoryId === productId) {
            setExpandedHistoryId(null);
        } else {
            await loadHistory(productId);
            setExpandedHistoryId(productId);
        }
    }

    const PRICE_KEYS: (keyof PriceState)[] = ['price_cost', 'price_retail', 'price_reseller', 'price_wholesale'];
    const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70';
    
    const hasSeo = Boolean(model.description?.trim() || model.template_values?.meta_title?.trim());

    return (
        <>
            {/* ── Linha principal ─────────────────────────────────────── */}
            <tr className={`transition-colors ${rowBg} hover:brightness-95 ${isSelected ? 'bg-purple-50/50' : ''}`}>
                {/* Seleção */}
                <td className="px-4 py-2.5 whitespace-nowrap w-10">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(model.id)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                </td>

                {/* Marca */}
                <td className="px-4 py-2.5 text-sm font-medium text-slate-600 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400"
                        >
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {brandName}
                    </div>
                </td>

                {/* Modelo */}
                <td className="px-4 py-2.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                        {model.name}
                        {hasSeo && (
                            <div title="SEO preenchido" className="flex items-center text-purple-600 bg-purple-50 p-1 rounded">
                                <Sparkles size={14} />
                            </div>
                        )}
                    </div>
                </td>

                {/* Preços — cada um em seu próprio <td>, Enter salva */}
                {loadingPrices ? (
                    <td colSpan={4} className="px-4 py-2.5">
                        <Loader2 size={14} className="animate-spin text-slate-400" />
                    </td>
                ) : (
                    PRICE_KEYS.map(key => (
                        <td key={key} className="px-2 py-2.5">
                            <CurrencyInput
                                value={prices[key]}
                                onChange={cents => setPrices(prev => ({ ...prev, [key]: cents }))}
                                className="h-7 w-28 text-xs py-1"
                                onKeyDown={(e: React.KeyboardEvent) => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                                }}
                            />
                        </td>
                    ))
                )}

                {/* Salvar — ícone animado */}
                <td className="px-2 py-2.5 text-center">
                    <button
                        onClick={handleSave}
                        disabled={saving || loadingPrices || products.length === 0}
                        title="Salvar preços"
                        className={`p-1.5 rounded-lg transition-all duration-200 disabled:opacity-40 ${
                            saved
                                ? 'text-green-600 bg-green-50 scale-110'
                                : 'text-slate-500 hover:text-green-600 hover:bg-green-50'
                        }`}
                    >
                        {saving
                            ? <Loader2 size={16} className="animate-spin" />
                            : saved
                                ? <CheckCircle size={16} className="animate-in zoom-in duration-200" />
                                : <Save size={16} />
                        }
                    </button>
                </td>

                {/* Status */}
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {model.active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Ativo
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            ○ Inativo
                        </span>
                    )}
                </td>

                {/* Ações */}
                <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                        <button
                            onClick={handlePullBling}
                            disabled={pullingBling || syncingBling || reimporting}
                            className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Puxar medidas do Bling para o Sistema"
                        >
                            {pullingBling ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
                        </button>
                        <button
                            onClick={handleSyncBling}
                            disabled={syncingBling || pullingBling || reimporting}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Enviar medidas do Sistema para o Bling"
                        >
                            {syncingBling ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        </button>
                        <button
                            onClick={handleReimportBling}
                            disabled={reimporting || syncingBling || pullingBling}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Re-sincronizar SKUs (Bling -> Sistema)"
                        >
                            {reimporting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        </button>
                        <button
                            onClick={() => onEdit(model)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                        >
                            <Pencil size={16} />
                        </button>
                        <button
                            onClick={() => onDelete(model)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </td>
            </tr>

            {/* ── Linha expandida: Slug + Medidas ───────────────────── */}
            {expanded && (
                <tr className={`border-b border-slate-200 ${rowBg}`}>
                    <td colSpan={10} className="px-6 py-2.5">
                        <div className="flex flex-wrap items-center gap-6">
                            {/* Slug */}
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Slug:</span>
                                <code className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs text-slate-600">
                                    {model.slug}
                                </code>
                            </div>

                            {/* Peso */}
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Peso:</span>
                                <span className="text-xs text-slate-600">
                                    {model.template_values?.weight_kg || '0'} kg
                                </span>
                            </div>

                            {/* Dimensões */}
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Dimensões (LxAxP):</span>
                                <span className="text-xs text-slate-600">
                                    {model.template_values?.['dimensions.width_cm'] || '0'} x {model.template_values?.['dimensions.height_cm'] || '0'} x {model.template_values?.['dimensions.depth_cm'] || '0'} cm
                                </span>
                            </div>
                        </div>

                        {/* Variações */}
                        <div className="w-full mt-4 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">Composição de Preços (Variações)</h4>
                            </div>
                            <div className="p-4">
                                <table className="w-full text-left text-xs text-slate-600">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-slate-400">
                                            <th className="font-medium pb-2">SKU</th>
                                            <th className="font-medium pb-2">Produto</th>
                                            <th className="font-medium pb-2 text-right">Estoque</th>
                                            <th className="font-medium pb-2 text-right">Custo</th>
                                            <th className="font-medium pb-2 text-right">Varejo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="py-4 text-center text-slate-400 italic">Nenhum produto encontrado neste modelo.</td>
                                            </tr>
                                        )}
                                        {products.map(p => (
                                            <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                                <td className="py-2"><code className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] text-slate-500">{p.sku || p.specs?.sku || 'Sem SKU'}</code></td>
                                                <td className="py-2 font-medium text-slate-700">
                                                    {p.name}
                                                    {p.specs?.color && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">Cor: {p.specs.color}</span>}
                                                    {p.specs?.capacity && <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700">{p.specs.capacity}</span>}
                                                </td>
                                                <td className="py-2 text-right">{p.stock_quantity || 0}</td>
                                                <td className="py-2 text-right">{fmt(p.price_cost)}</td>
                                                <td className="py-2 text-right font-semibold text-slate-800">{fmt(p.price_retail)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {products.length > 1 && (
                                    <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded flex items-start gap-2">
                                        <div className="mt-0.5">ℹ️</div>
                                        <div>
                                            <span className="font-semibold block mb-0.5">Por que o número de cima é diferente?</span>
                                            O preço do Varejo na linha resumida (lá em cima) é uma média ponderada dos valores destas variações. Quando você digita um preço na linha e aperta Enter, ele atualiza todas elas de uma vez!
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ModelsPage() {
    const [models, setModels] = useState<Model[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [seoModalOpen, setSeoModalOpen] = useState(false);
    const [editingModel, setEditingModel] = useState<Model | null>(null);
    const [deleteError, setDeleteError] = useState('');
    const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());

    // ── Filtros ──
    const [search, setSearch] = useState('');
    const [filterBrand, setFilterBrand] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');

    const loadData = async () => {
        try {
            const [modelsData, brandsData] = await Promise.all([
                modelService.list(),
                brandService.list()
            ]);
            setModels(modelsData);
            setBrands(brandsData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleEdit = (model: Model) => { setEditingModel(model); setModalOpen(true); };
    const handleAdd = () => { setEditingModel(null); setModalOpen(true); };

    const handleDelete = async (model: Model) => {
        if (!confirm(`Excluir o modelo "${model.name}"?`)) return;
        try {
            setDeleteError('');
            await modelService.delete(model.id);
            await loadData();
        } catch {
            setDeleteError('Erro ao excluir modelo. Tente novamente.');
        }
    };

    const getBrandName = (brandId: string) =>
        brands.find(b => b.id === brandId)?.name || '—';

    // ── Filtragem + Ordenação (client-side) ──
    const filtered = models
        .filter(m => {
            const brandName = getBrandName(m.brand_id).toLowerCase();
            const term = search.toLowerCase();
            if (term && !m.name.toLowerCase().includes(term) && !brandName.includes(term)) return false;
            if (filterBrand && m.brand_id !== filterBrand) return false;
            if (filterStatus === 'active' && !m.active) return false;
            if (filterStatus === 'inactive' && m.active) return false;
            return true;
        })
        .sort((a, b) => {
            if (sortOrder === 'newest') return new Date(b.created).getTime() - new Date(a.created).getTime();
            if (sortOrder === 'oldest') return new Date(a.created).getTime() - new Date(b.created).getTime();
            if (sortOrder === 'az') return a.name.localeCompare(b.name, 'pt-BR');
            if (sortOrder === 'za') return b.name.localeCompare(a.name, 'pt-BR');
            return 0;
        });

    const toggleSelectAll = () => {
        if (selectedModelIds.size === filtered.length && filtered.length > 0) {
            setSelectedModelIds(new Set());
        } else {
            setSelectedModelIds(new Set(filtered.map(m => m.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedModelIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedModelIds(newSet);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                        <Smartphone size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Gestão de Modelos</h1>
                        <p className="text-slate-500">Gerencie os modelos de produtos por marca</p>
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} />
                    Novo Modelo
                </button>
            </div>

            {deleteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
                    {deleteError}
                    <button onClick={() => setDeleteError('')} className="text-red-500 font-bold ml-4">×</button>
                </div>
            )}

            {/* ── Barra de Pesquisa + Filtros ── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Pesquisa */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Pesquisar por nome ou marca…"
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                    </div>

                    {/* Filtro Marca */}
                    <select
                        value={filterBrand}
                        onChange={e => setFilterBrand(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Todas as marcas</option>
                        {brands.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>

                    {/* Filtro Status */}
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value as any)}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="all">Todos os status</option>
                        <option value="active">Ativos</option>
                        <option value="inactive">Inativos</option>
                    </select>

                    {/* Ordenação */}
                    <select
                        value={sortOrder}
                        onChange={e => setSortOrder(e.target.value as any)}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="newest">Mais recentes</option>
                        <option value="oldest">Mais antigos</option>
                        <option value="az">Nome A→Z</option>
                        <option value="za">Nome Z→A</option>
                    </select>

                    {/* Limpar filtros */}
                    {(search || filterBrand || filterStatus !== 'all' || sortOrder !== 'newest') && (
                        <button
                            onClick={() => { setSearch(''); setFilterBrand(''); setFilterStatus('all'); setSortOrder('newest'); }}
                            className="text-xs text-slate-500 hover:text-red-500 transition-colors underline whitespace-nowrap"
                        >
                            Limpar filtros
                        </button>
                    )}

                    <div className="flex-1 flex justify-end items-center gap-3">
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                            {filtered.length} de {models.length} modelo{models.length !== 1 ? 's' : ''}
                        </span>
                        
                        {selectedModelIds.size > 0 && (
                            <button
                                onClick={() => setSeoModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-xs font-bold transition-colors animate-in fade-in"
                            >
                                <Sparkles size={14} />
                                SEO em Massa ({selectedModelIds.size})
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto max-h-[65vh]">
                <table className="w-full relative">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-4 py-3 text-left w-10">
                                <input
                                    type="checkbox"
                                    checked={filtered.length > 0 && selectedModelIds.size === filtered.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                                    title="Selecionar todos os filtrados"
                                />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Marca</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Modelo</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Custo</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Varejo</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Revenda</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Atacado</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Salvar</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                                    {models.length === 0 ? 'Nenhum modelo cadastrado' : 'Nenhum modelo encontrado para os filtros aplicados'}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((model, i) => (
                                <ModelRow
                                    key={model.id}
                                    model={model}
                                    index={i}
                                    brandName={getBrandName(model.brand_id)}
                                    isSelected={selectedModelIds.has(model.id)}
                                    onToggleSelect={toggleSelect}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onRefresh={loadData}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Total de Modelos</p>
                    <p className="text-2xl font-bold text-slate-800">{models.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Modelos Ativos</p>
                    <p className="text-2xl font-bold text-green-600">{models.filter(m => m.active).length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Marcas com Modelos</p>
                    <p className="text-2xl font-bold text-purple-600">{new Set(models.map(m => m.brand_id)).size}</p>
                </div>
            </div>

            <NextStepBanner
                steps={[
                    { label: 'Categoria', path: '/admin/settings/categories' },
                    { label: 'Marca', path: '/admin/settings/brands' },
                    { label: 'Modelo', path: '/admin/settings/models' },
                    { label: 'Integração Bling', path: '/admin/settings/bling' },
                    { label: 'Produto', path: '/admin/products/new' },
                ]}
                currentStep={2}
                message="Modelos cadastrados?"
            />

            <ModelModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={loadData}
                model={editingModel}
            />

            <BulkSeoModal
                isOpen={seoModalOpen}
                onClose={() => setSeoModalOpen(false)}
                models={models.filter(m => selectedModelIds.has(m.id))}
                brands={brands}
                onSuccess={() => {
                    setSelectedModelIds(new Set());
                    loadData();
                }}
            />
        </div>
    );
}
