import React from 'react';
import { Search, SlidersHorizontal, ArrowUp, ArrowDown, X } from 'lucide-react';
import { InventoryFilters as FiltersType } from '../../types/inventory';

interface InventoryFiltersProps {
    filters: FiltersType;
    onFiltersChange: (filters: FiltersType) => void;
    categories: Array<{ id: string; name: string }>;
    brands: string[];
}

/**
 * InventoryFilters Component
 * Search and filter controls for inventory
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Component < 500 lines
 * - Real-time filtering
 * - Accessible form controls
 */
export function InventoryFilters({ filters, onFiltersChange, categories, brands }: InventoryFiltersProps) {
    const handleSearchChange = (value: string) => {
        onFiltersChange({ ...filters, search: value });
    };

    const handleCategoryChange = (categoryId: string) => {
        onFiltersChange({ ...filters, category_id: categoryId || undefined });
    };

    const handleBrandChange = (brand: string) => {
        onFiltersChange({ ...filters, brand: brand || undefined });
    };

    const handleAvailableToggle = (checked: boolean) => {
        onFiltersChange({ ...filters, only_available: checked });
    };

    const handleSortChange = (sortBy: FiltersType['sort_by']) => {
        onFiltersChange({ ...filters, sort_by: sortBy });
    };

    const handleSortOrderToggle = () => {
        const newOrder = (filters.sort_order || 'asc') === 'asc' ? 'desc' : 'asc';
        onFiltersChange({ ...filters, sort_order: newOrder });
    };

    return (
        <section aria-label="Filtros do estoque" className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><SlidersHorizontal size={17} className="text-blue-600" />Filtrar estoque</h2>
                <button type="button" onClick={() => onFiltersChange({})} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600"><X size={14} />Limpar filtros</button>
            </div>
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    value={filters.search || ''}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Buscar por nome, SKU, EAN ou IMEI1..."
                    aria-label="Buscar produto"
                    className="h-12 w-full pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {/* Category Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Categoria
                    </label>
                    <select
                        aria-label="Categoria"
                        value={filters.category_id || ''}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="h-11 w-full min-w-0 px-3 bg-white text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    >
                        <option value="">Todas as categorias</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Brand Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Marca
                    </label>
                    <select
                        aria-label="Marca"
                        value={filters.brand || ''}
                        onChange={(e) => handleBrandChange(e.target.value)}
                        className="h-11 w-full min-w-0 px-3 bg-white text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    >
                        <option value="">Todas as marcas</option>
                        {brands.map(brand => (
                            <option key={brand} value={brand}>
                                {brand}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Status Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Status
                    </label>
                    <select
                        aria-label="Status da unidade"
                        value={filters.status || ''}
                        onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as any || undefined })}
                        className="h-11 w-full min-w-0 px-3 bg-white text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    >
                        <option value="">Todos os status</option>
                        <option value="available">Disponível</option>
                        <option value="reserved">Reservado</option>
                        <option value="sold">Vendido</option>
                        <option value="maintenance">Manutenção</option>
                        <option value="defective">Defeituoso</option>
                    </select>
                </div>

                {/* Type Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Tipo
                    </label>
                    <select
                        aria-label="Tipo de estoque"
                        value={filters.only_serialized ? 'serialized' : filters.only_non_serialized ? 'non-serialized' : ''}
                        onChange={(e) => {
                            const value = e.target.value;
                            onFiltersChange({
                                ...filters,
                                only_serialized: value === 'serialized' ? true : undefined,
                                only_non_serialized: value === 'non-serialized' ? true : undefined
                            });
                        }}
                        className="h-11 w-full min-w-0 px-3 bg-white text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    >
                        <option value="">Todos os tipos</option>
                        <option value="serialized">Serializados</option>
                        <option value="non-serialized">Não Serializados</option>
                    </select>
                </div>

                {/* Sort By */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Ordenar por
                    </label>
                    <div className="flex gap-2">
                        <select
                            aria-label="Ordenar por"
                            value={filters.sort_by || 'name'}
                            onChange={(e) => handleSortChange(e.target.value as FiltersType['sort_by'])}
                            className="h-11 min-w-0 flex-1 px-3 bg-white text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                        >
                            <option value="name">Nome</option>
                            <option value="sku">SKU</option>
                            <option value="quantity">Quantidade</option>
                            <option value="value">Valor</option>
                        </select>
                        <button
                            onClick={handleSortOrderToggle}
                            type="button"
                            className="flex h-11 w-11 shrink-0 items-center justify-center border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                            aria-label={(filters.sort_order || 'asc') === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'}
                            title={(filters.sort_order || 'asc') === 'asc' ? 'Crescente' : 'Decrescente'}
                        >
                            {(filters.sort_order || 'asc') === 'asc' ? <ArrowUp size={17} /> : <ArrowDown size={17} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Available Only Checkbox */}
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
                <input
                    type="checkbox"
                    id="only-available"
                    checked={filters.only_available || false}
                    onChange={(e) => handleAvailableToggle(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="only-available" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Apenas disponíveis em estoque (Qtd &gt; 0)
                </label>
            </div>

            {/* Active Filters Summary */}
            {(filters.search || filters.category_id || filters.brand || filters.status || filters.only_serialized || filters.only_non_serialized || filters.only_available) && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="flex flex-wrap items-center gap-y-2 text-xs text-slate-500">
                        Filtros ativos:
                        {filters.search && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Busca</span>}
                        {filters.category_id && <span className="ml-2 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">{categories.find(category => category.id === filters.category_id)?.name || 'Categoria'}</span>}
                        {filters.brand && <span className="ml-2 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">{filters.brand}</span>}
                        {filters.status && <span className="ml-2 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">{{ available: 'Disponível', reserved: 'Reservado', sold: 'Vendido', maintenance: 'Manutenção', defective: 'Defeituoso' }[filters.status]}</span>}
                        {(filters.only_serialized || filters.only_non_serialized) && <span className="ml-2 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">{filters.only_serialized ? 'Serializados' : 'Não serializados'}</span>}
                        {filters.only_available && <span className="ml-2 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">Com estoque</span>}
                    </span>
                </div>
            )}
        </section>
    );
}
