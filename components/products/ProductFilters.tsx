
import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { ProductStatus } from '../../utils/field-standards';

export interface ProductFiltersState {
    search: string;
    status: ProductStatus | 'all';
}

interface ProductFiltersProps {
    onFilterChange: (filters: ProductFiltersState) => void;
}

/**
 * ProductFilters Component
 * Provides search and status filtering for products
 */
export const ProductFilters: React.FC<ProductFiltersProps> = ({ onFilterChange }) => {
    const [filters, setFilters] = useState<ProductFiltersState>({
        search: '',
        status: 'all'
    });

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFilters = { ...filters, search: e.target.value };
        setFilters(newFilters);
        onFilterChange(newFilters);
    };

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newFilters = { ...filters, status: e.target.value as ProductStatus | 'all' };
        setFilters(newFilters);
        onFilterChange(newFilters);
    };

    const handleClearFilters = () => {
        const clearedFilters: ProductFiltersState = { search: '', status: 'all' };
        setFilters(clearedFilters);
        onFilterChange(clearedFilters);
    };

    const hasActiveFilters = filters.search !== '' || filters.status !== 'all';

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex flex-col md:flex-row gap-3">
                {/* Search Input */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={handleSearchChange}
                        placeholder="Buscar por Nome ou SKU..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Status Select */}
                <div className="w-full md:w-48">
                    <select
                        value={filters.status}
                        onChange={handleStatusChange}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                        <option value="all">Todos os Status</option>
                        <option value={ProductStatus.ACTIVE}>Ativo</option>
                        <option value={ProductStatus.INACTIVE}>Inativo</option>
                        <option value={ProductStatus.OUT_OF_STOCK}>Sem Estoque</option>
                        <option value={ProductStatus.DISCONTINUED}>Descontinuado</option>
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
