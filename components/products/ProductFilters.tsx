
import React, { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { ProductStatus } from '../../utils/field-standards';
import { brandService } from '../../services/brands';
import { categoryService } from '../../services/categories';

export interface ProductFiltersState {
    salesChannel?: 'all' | 'shopee' | 'tiktok' | 'mercado_livre' | 'loja_3d' | 'mercado_do_vale' | 'bling';
    channelStatus?: 'all' | 'linked' | 'unlinked';
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
        filters.search !== '' ||
        filters.status !== 'all' ||
        filters.imageStatus !== 'all' ||
        filters.parentVisibility !== 'hide_parents' ||
        filters.brand !== 'all' ||
        filters.categoryId !== 'all' ||
        filters.shopeeStatus !== 'all' ||
        filters.videoStatus !== 'all';

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex flex-col md:flex-row md:flex-wrap gap-3">
                {/* Search Input */}
                <div className="flex-1 min-w-[240px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={(e) => applyChange({ search: e.target.value })}
                        placeholder="Buscar por Nome, SKU, IMEI 1 ou Serial..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Status Select */}
                <div className="w-full md:w-48">
                    <select
                        value={filters.status}
                        onChange={(e) => applyChange({ status: e.target.value as ProductStatus | 'all' })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                        <option value="all">Todos os Status</option>
                        <option value={ProductStatus.ACTIVE}>Ativo</option>
                        <option value={ProductStatus.INACTIVE}>Inativo</option>
                        <option value={ProductStatus.OUT_OF_STOCK}>Sem Estoque</option>
                        <option value={ProductStatus.DISCONTINUED}>Descontinuado</option>
                    </select>
                </div>

                {/* Brand Select */}
                <div className="w-full md:w-48">
                    <select
                        value={filters.brand}
                        onChange={(e) => applyChange({ brand: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                        <option value="all">Marca: Todas</option>
                        {brandOptions.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>

                {/* Category Select */}
                <div className="w-full md:w-56">
                    <select
                        value={filters.categoryId}
                        onChange={(e) => applyChange({ categoryId: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                        <option value="all">Categoria: Todas</option>
                        {categoryOptions.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Image Status Select */}
                <div className="w-full md:w-48">
                    <select
                        value={filters.imageStatus}
                        onChange={(e) => applyChange({ imageStatus: e.target.value as ProductFiltersState['imageStatus'] })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                        <option value="all">Fotos: Todas</option>
                        <option value="with_image">Com Foto</option>
                        <option value="without_image">Sem Foto</option>
                    </select>
                </div>

                {/* Video Status Select */}
                <div className="w-full md:w-48">
                    <select
                        value={filters.videoStatus}
                        onChange={(e) => applyChange({ videoStatus: e.target.value as ProductFiltersState['videoStatus'] })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                        <option value="all">Vídeo: Todos</option>
                        <option value="with_video">Com Vídeo</option>
                        <option value="without_video">Sem Vídeo</option>
                    </select>
                </div>

                {/* Sales channel and situation */}
                <div className="w-full md:w-48">
                    <select
                        aria-label="Canal de venda"
                        value={filters.salesChannel}
                        onChange={(e) => applyChange({ salesChannel: e.target.value as ProductFiltersState['salesChannel'], channelStatus: e.target.value === 'all' ? 'all' : 'linked' })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                        <option value="all">Canais: Todos</option>
                        <option value="shopee">Shopee</option>
                        <option value="tiktok">TikTok Shop</option>
                        <option value="mercado_livre">Mercado Livre</option>
                        <option value="loja_3d">Loja 3D</option>
                        <option value="mercado_do_vale">Mercado do Vale</option>
                        <option value="bling">Bling</option>
                    </select>
                </div>
                {filters.salesChannel !== 'all' && <div className="w-full md:w-56">
                    <select aria-label="Situação no canal" value={filters.channelStatus}
                        onChange={event => applyChange({ channelStatus: event.target.value as ProductFiltersState['channelStatus'] })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500">
                        <option value="all">Todas as situações</option>
                        <option value="linked">{['loja_3d', 'mercado_do_vale'].includes(filters.salesChannel || '') ? 'No catálogo do site' : 'Com vínculo'}</option>
                        <option value="unlinked">{['loja_3d', 'mercado_do_vale'].includes(filters.salesChannel || '') ? 'Fora do catálogo do site' : 'Sem vínculo'}</option>
                    </select>
                </div>}

                {/* Parent Visibility Select */}
                {showParentVisibility && <div className="w-full md:w-48">
                    <select
                        value={filters.parentVisibility}
                        onChange={(e) => applyChange({ parentVisibility: e.target.value as ProductFiltersState['parentVisibility'] })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                        <option value="hide_parents">Ocultar Pais</option>
                        <option value="show_all">Mostrar Todos</option>
                        <option value="only_parents">Apenas Pais</option>
                    </select>
                </div>}

                {/* Sort Select */}
                <div className="w-full md:w-56">
                    <select
                        value={filters.sortBy}
                        onChange={(e) => applyChange({ sortBy: e.target.value as ProductFiltersState['sortBy'] })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                        <option value="newest">Mais Recentes</option>
                        <option value="oldest">Mais Antigos</option>
                        <option value="name_asc">Nome (A-Z)</option>
                        <option value="name_desc">Nome (Z-A)</option>
                    </select>
                </div>

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                    >
                        <X className="w-4 h-4" />
                        <span className="text-sm font-medium">Limpar</span>
                    </button>
                )}
            </div>
        </div>
    );
};
