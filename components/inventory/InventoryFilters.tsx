import React from 'react';
import { Search, Filter } from 'lucide-react';
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
        const newOrder = filters.sort_order === 'asc' ? 'desc' : 'asc';
        onFiltersChange({ ...filters, sort_order: newOrder });
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    value={filters.search || ''}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Buscar por nome, SKU, EAN ou IMEI1..."
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Category Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Categoria
                    </label>
                    <select
                        value={filters.category_id || ''}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        value={filters.brand || ''}
                        onChange={(e) => handleBrandChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        value={filters.status || ''}
                        onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as any || undefined })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Todos os status</option>
                        <option value="available">🟢 Disponível</option>
                        <option value="reserved">🟡 Reservado</option>
                        <option value="sold">🔴 Vendido</option>
                        <option value="maintenance">🔵 Manutenção</option>
                        <option value="defective">⚫ Defeituoso</option>
                    </select>
                </div>

                {/* Type Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Tipo
                    </label>
                    <select
                        value={filters.only_serialized ? 'serialized' : filters.only_non_serialized ? 'non-serialized' : ''}
                        onChange={(e) => {
                            const value = e.target.value;
                            onFiltersChange({
                                ...filters,
                                only_serialized: value === 'serialized' ? true : undefined,
                                only_non_serialized: value === 'non-serialized' ? true : undefined
                            });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Todos os tipos</option>
                        <option value="serialized">🔵 Serializados</option>
                        <option value="non-serialized">📦 Não Serializados</option>
                    </select>
                </div>

                {/* Sort By */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Ordenar por
                    </label>
                    <div className="flex gap-2">
                        <select
                            value={filters.sort_by || 'name'}
                            onChange={(e) => handleSortChange(e.target.value as FiltersType['sort_by'])}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="name">Nome</option>
                            <option value="sku">SKU</option>
                            <option value="quantity">Quantidade</option>
                            <option value="value">Valor</option>
                        </select>
                        <button
                            onClick={handleSortOrderToggle}
                            className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                            title={filters.sort_order === 'asc' ? 'Crescente' : 'Decrescente'}
                        >
                            {filters.sort_order === 'asc' ? '↑' : '↓'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Available Only Checkbox */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
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
            {(filters.search || filters.category_id || filters.brand || filters.only_available) && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-slate-600">
                        Filtros ativos:
                        {filters.search && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Busca</span>}
                        {filters.category_id && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Categoria</span>}
                        {filters.brand && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Marca</span>}
                        {filters.only_available && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Disponíveis</span>}
                    </span>
                    <button
                        onClick={() => onFiltersChange({})}
                        className="ml-auto text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Limpar filtros
                    </button>
                </div>
            )}
        </div>
    );
}
