import React, { useEffect, useState, useCallback } from 'react';
import { Smartphone, Plus, Pencil, Trash2, ChevronDown, ChevronUp, CheckCircle, Loader2, Clock, Search, Save } from 'lucide-react';
import { Model } from '../../../types/model';
import { Brand } from '../../../types/brand';
import { modelService } from '../../../services/models';
import { brandService } from '../../../services/brands';
import { ModelModal } from '../../../components/settings/ModelModal';
import { NextStepBanner } from '../../../components/ui/NextStepBanner';
import { supabase } from '../../../services/supabase';
import { getPriceHistory, applyPricesToVariation, PriceSnapshot } from '../../../services/priceHistoryService';
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
    onEdit: (m: Model) => void;
    onDelete: (m: Model) => void;
}

function ModelRow({ model, brandName, index, onEdit, onDelete }: ModelRowProps) {
    const [expanded, setExpanded] = useState(false);
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [loadingPrices, setLoadingPrices] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
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
                .select('id, name, specs, stock_quantity, price_cost, price_retail, price_reseller, price_wholesale')
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
    const expandedBg = index % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100/60';

    return (
        <>
            {/* ── Linha principal ─────────────────────────────────────── */}
            <tr className={`transition-colors ${expanded ? expandedBg : rowBg} hover:brightness-95`}>
                {/* Marca */}
                <td className="px-4 py-2.5 text-sm font-medium text-slate-600 whitespace-nowrap">
                    {brandName}
                </td>

                {/* Modelo */}
                <td className="px-4 py-2.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                    {model.name}
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
                            onClick={() => setExpanded(v => !v)}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Slug e Histórico"
                        >
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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

            {/* ── Linha expandida: Slug + Histórico ───────────────────── */}
            {expanded && (
                <tr className={`border-t border-slate-200 ${expandedBg}`}>
                    <td colSpan={8} className="px-6 py-3 space-y-3">
                        {/* Slug */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Slug:</span>
                            <code className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700">
                                {model.slug}
                            </code>
                        </div>

                        {/* Histórico por produto */}
                        {products.length === 0 ? (
                            <p className="text-xs text-slate-400">Nenhum produto ativo para este modelo.</p>
                        ) : (
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    Produtos ({products.length})
                                </p>
                                {products.map(p => (
                                    <div key={p.id} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                                        <button
                                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                                            onClick={() => toggleHistory(p.id)}
                                        >
                                            <Clock size={13} className="text-slate-400 shrink-0" />
                                            <span className="text-xs text-slate-700 flex-1 truncate">{p.name}</span>
                                            <span className="text-xs text-slate-400">Varejo: {fmt(p.price_retail)}</span>
                                            <span className="text-xs text-blue-500 ml-1">
                                                {expandedHistoryId === p.id ? 'fechar ▴' : 'histórico ▾'}
                                            </span>
                                        </button>

                                        {expandedHistoryId === p.id && (
                                            <div className="px-3 pb-3 border-t border-slate-100">
                                                {!history[p.id] ? (
                                                    <p className="text-xs text-slate-400 py-1">Carregando…</p>
                                                ) : history[p.id].length === 0 ? (
                                                    <p className="text-xs text-slate-400 py-1">Nenhum histórico registrado.</p>
                                                ) : (
                                                    <div className="space-y-1 mt-2">
                                                        {history[p.id].map(h => (
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
                        )}
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
    const [editingModel, setEditingModel] = useState<Model | null>(null);
    const [deleteError, setDeleteError] = useState('');

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

                    <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">
                        {filtered.length} de {models.length} modelo{models.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
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
                                <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
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
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
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
        </div>
    );
}
