
import React, { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, Store, X } from 'lucide-react';
import { ProductStatus } from '../../utils/field-standards';
import { brandService } from '../../services/brands';
import { categoryService } from '../../services/categories';

export interface ProductFiltersState {
    salesChannel?: 'all' | 'shopee' | 'tiktok' | 'mercado_livre' | 'loja_3d' | 'mercado_do_vale' | 'bling';
    channelStatus?: 'all' | 'linked' | 'unlinked';
    shopeeStore: 'all' | 'M' | 'G';
    search: string;
    status: ProductStatus | 'all';
    sortBy: 'newest' | 'oldest' | 'name_asc' | 'name_desc';
    imageStatus: 'all' | 'with_image' | 'without_image';
    parentVisibility: 'hide_parents' | 'show_all' | 'only_parents';
    brand: string;        // 'all' ou nome exato da marca
    categoryId: string;   // 'all' ou UUID da categoria
    shopeeStatus: 'all' | 'synced' | 'not_synced';
    videoStatus: 'all' | 'with_video' | 'without_video';
}

interface ProductFiltersProps {
    onFilterChange: (filters: ProductFiltersState) => void;
    showParentVisibility?: boolean;
}

const INITIAL_FILTERS: ProductFiltersState = {
    salesChannel: 'all',
    channelStatus: 'all',
    shopeeStore: 'all',
    search: '',
    status: 'all',
    sortBy: 'newest',
    imageStatus: 'all',
    parentVisibility: 'hide_parents',
    brand: 'all',
    categoryId: 'all',
    shopeeStatus: 'all',
    videoStatus: 'all',
};

/**
 * ProductFilters Component
 * Provides search and status filtering for products
 */
export const ProductFilters: React.FC<ProductFiltersProps> = ({ onFilterChange, showParentVisibility = true }) => {
    const [filters, setFilters] = useState<ProductFiltersState>(INITIAL_FILTERS);
    const [brandOptions, setBrandOptions] = useState<string[]>([]);
    const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>([]);

    useEffect(() => {
        let cancelled = false;
        brandService.list()
            .then(brands => {
                if (cancelled) return;
                const names = brands.map(b => b.name).filter(Boolean) as string[];
                names.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
                setBrandOptions(names);
            })
            .catch(err => console.warn('[ProductFilters] falha ao carregar marcas', err));
        categoryService.list()
            .then(cats => {
                if (cancelled) return;
                const opts = (cats || [])
                    .map(c => ({ id: c.id, name: c.name }))
                    .filter(c => c.id && c.name)
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
                setCategoryOptions(opts);
            })
            .catch(err => console.warn('[ProductFilters] falha ao carregar categorias', err));
        return () => { cancelled = true; };
    }, []);

    const applyChange = (patch: Partial<ProductFiltersState>) => {
        const next = { ...filters, ...patch };
        setFilters(next);
        onFilterChange(next);
    };

    const handleClearFilters = () => {
        setFilters(INITIAL_FILTERS);
        onFilterChange(INITIAL_FILTERS);
    };

    const hasActiveFilters =
        filters.salesChannel !== 'all' ||
        filters.shopeeStore !== 'all' ||
        filters.search !== '' ||
        filters.status !== 'all' ||
        filters.imageStatus !== 'all' ||
        filters.parentVisibility !== 'hide_parents' ||
        filters.brand !== 'all' ||
        filters.categoryId !== 'all' ||
        filters.shopeeStatus !== 'all' ||
        filters.videoStatus !== 'all';

    const cardClass = 'min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 shadow-sm transition-colors focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100';
    const labelClass = 'mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500';
    const controlClass = 'w-full min-w-0 bg-transparent text-sm font-medium text-slate-800 outline-none';

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <SlidersHorizontal className="h-4 w-4" />
                    </span>
                    Filtros do catálogo
                </div>
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={handleClearFilters}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                    >
                        <X className="h-3.5 w-3.5" />
                        Limpar filtros
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <label className={`${cardClass} relative sm:col-span-2`}>
                    <span className={labelClass}>Buscar produto</span>
                    <Search className="absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={(event) => applyChange({ search: event.target.value })}
                        placeholder="Nome, SKU, IMEI ou serial"
                        className={`${controlClass} pl-6`}
                    />
                </label>

                <label className={cardClass}>
                    <span className={labelClass}>Status</span>
                    <select aria-label="Status do produto" value={filters.status}
                        onChange={(event) => applyChange({ status: event.target.value as ProductStatus | 'all' })}
                        className={controlClass}>
                        <option value="all">Todos</option>
                        <option value={ProductStatus.ACTIVE}>Ativo</option>
                        <option value={ProductStatus.INACTIVE}>Inativo</option>
                        <option value={ProductStatus.OUT_OF_STOCK}>Sem estoque</option>
                        <option value={ProductStatus.DISCONTINUED}>Descontinuado</option>
                    </select>
                </label>

                <label className={cardClass}>
                    <span className={labelClass}>Marca</span>
                    <select aria-label="Marca" value={filters.brand} onChange={(event) => applyChange({ brand: event.target.value })} className={controlClass}>
                        <option value="all">Todas</option>
                        {brandOptions.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                </label>

                <label className={cardClass}>
                    <span className={labelClass}>Categoria</span>
                    <select aria-label="Categoria" value={filters.categoryId} onChange={(event) => applyChange({ categoryId: event.target.value })} className={controlClass}>
                        <option value="all">Todas</option>
                        {categoryOptions.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                </label>

                <label className={cardClass}>
                    <span className={labelClass}>Fotos</span>
                    <select aria-label="Fotos" value={filters.imageStatus}
                        onChange={(event) => applyChange({ imageStatus: event.target.value as ProductFiltersState['imageStatus'] })}
                        className={controlClass}>
                        <option value="all">Todas</option>
                        <option value="with_image">Com foto</option>
                        <option value="without_image">Sem foto</option>
                    </select>
                </label>

                <label className={cardClass}>
                    <span className={labelClass}>Vídeo</span>
                    <select aria-label="Vídeo" value={filters.videoStatus}
                        onChange={(event) => applyChange({ videoStatus: event.target.value as ProductFiltersState['videoStatus'] })}
                        className={controlClass}>
                        <option value="all">Todos</option>
                        <option value="with_video">Com vídeo</option>
                        <option value="without_video">Sem vídeo</option>
                    </select>
                </label>

                <label className={cardClass}>
                    <span className={labelClass}>Canal de venda</span>
                    <select
                        aria-label="Canal de venda"
                        value={filters.salesChannel}
                        onChange={(event) => {
                            const salesChannel = event.target.value as ProductFiltersState['salesChannel'];
                            applyChange({
                                salesChannel,
                                channelStatus: salesChannel === 'all' ? 'all' : 'linked',
                                ...(salesChannel !== 'shopee' ? { shopeeStore: 'all' as const } : {}),
                            });
                        }}
                        className={controlClass}
                    >
                        <option value="all">Todos</option>
                        <option value="shopee">Shopee</option>
                        <option value="tiktok">TikTok Shop</option>
                        <option value="mercado_livre">Mercado Livre</option>
                        <option value="loja_3d">Loja 3D</option>
                        <option value="mercado_do_vale">Mercado do Vale</option>
                        <option value="bling">Bling</option>
                    </select>
                </label>

                <label className={`${cardClass} border-orange-200 bg-orange-50/60`}>
                    <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-700">
                        <Store className="h-3 w-3" /> Loja Shopee
                    </span>
                    <select
                        aria-label="Loja Shopee"
                        value={filters.shopeeStore}
                        onChange={(event) => {
                            const shopeeStore = event.target.value as ProductFiltersState['shopeeStore'];
                            applyChange({
                                shopeeStore,
                                ...(shopeeStore !== 'all' ? { salesChannel: 'shopee' as const, channelStatus: 'linked' as const } : {}),
                            });
                        }}
                        className={controlClass}
                    >
                        <option value="all">Todas as lojas</option>
                        <option value="M">Mercado do Vale</option>
                        <option value="G">Glaucia</option>
                    </select>
                </label>

                {filters.salesChannel !== 'all' && (
                    <label className={cardClass}>
                        <span className={labelClass}>Situação no canal</span>
                        <select aria-label="Situação no canal" value={filters.channelStatus}
                            onChange={event => applyChange({ channelStatus: event.target.value as ProductFiltersState['channelStatus'] })}
                            className={controlClass}>
                            <option value="all">Todas</option>
                            <option value="linked">{['loja_3d', 'mercado_do_vale'].includes(filters.salesChannel || '') ? 'No catálogo do site' : 'Com vínculo'}</option>
                            <option value="unlinked">{['loja_3d', 'mercado_do_vale'].includes(filters.salesChannel || '') ? 'Fora do catálogo do site' : 'Sem vínculo'}</option>
                        </select>
                    </label>
                )}

                {showParentVisibility && (
                    <label className={cardClass}>
                        <span className={labelClass}>Produtos pai</span>
                        <select aria-label="Visibilidade dos produtos pai" value={filters.parentVisibility}
                            onChange={(event) => applyChange({ parentVisibility: event.target.value as ProductFiltersState['parentVisibility'] })}
                            className={controlClass}>
                            <option value="hide_parents">Ocultar pais</option>
                            <option value="show_all">Mostrar todos</option>
                            <option value="only_parents">Apenas pais</option>
                        </select>
                    </label>
                )}

                <label className={cardClass}>
                    <span className={labelClass}>Ordenação</span>
                    <select aria-label="Ordenação" value={filters.sortBy}
                        onChange={(event) => applyChange({ sortBy: event.target.value as ProductFiltersState['sortBy'] })}
                        className={controlClass}>
                        <option value="newest">Mais recentes</option>
                        <option value="oldest">Mais antigos</option>
                        <option value="name_asc">Nome (A–Z)</option>
                        <option value="name_desc">Nome (Z–A)</option>
                    </select>
                </label>
            </div>
        </div>
    );
};
