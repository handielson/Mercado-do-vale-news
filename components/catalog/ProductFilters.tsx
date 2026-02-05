import { X, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

export interface FilterState {
    categories: string[];
    brands: string[];
    priceRange: { min: number; max: number } | null;
    inStockOnly: boolean;
    featuredOnly: boolean;
    newOnly: boolean;
}

interface ProductFiltersProps {
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
    categories: Array<{ id: string; name: string; count: number }>;
    brands: Array<{ name: string; count: number }>;
    position?: 'sidebar' | 'topbar';
}

export function ProductFilters({
    filters,
    onFilterChange,
    categories,
    brands,
    position = 'sidebar'
}: ProductFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);

    const activeFiltersCount =
        filters.categories.length +
        filters.brands.length +
        (filters.priceRange ? 1 : 0) +
        (filters.inStockOnly ? 1 : 0) +
        (filters.featuredOnly ? 1 : 0) +
        (filters.newOnly ? 1 : 0);

    const handleCategoryToggle = (categoryId: string) => {
        const newCategories = filters.categories.includes(categoryId)
            ? filters.categories.filter((c) => c !== categoryId)
            : [...filters.categories, categoryId];
        onFilterChange({ ...filters, categories: newCategories });
    };

    const handleBrandToggle = (brand: string) => {
        const newBrands = filters.brands.includes(brand)
            ? filters.brands.filter((b) => b !== brand)
            : [...filters.brands, brand];
        onFilterChange({ ...filters, brands: newBrands });
    };

    const handleReset = () => {
        onFilterChange({
            categories: [],
            brands: [],
            priceRange: null,
            inStockOnly: false,
            featuredOnly: false,
            newOnly: false
        });
    };

    const FilterContent = () => (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5" />
                    Filtros
                    {activeFiltersCount > 0 && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                            {activeFiltersCount}
                        </span>
                    )}
                </h3>
                {activeFiltersCount > 0 && (
                    <button
                        onClick={handleReset}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Limpar tudo
                    </button>
                )}
            </div>

            {/* Toggles rápidos */}
            <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={filters.inStockOnly}
                        onChange={(e) =>
                            onFilterChange({ ...filters, inStockOnly: e.target.checked })
                        }
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">
                        Apenas em estoque
                    </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={filters.featuredOnly}
                        onChange={(e) =>
                            onFilterChange({ ...filters, featuredOnly: e.target.checked })
                        }
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900 flex items-center gap-1">
                        ⭐ Apenas em destaque
                    </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={filters.newOnly}
                        onChange={(e) =>
                            onFilterChange({ ...filters, newOnly: e.target.checked })
                        }
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900 flex items-center gap-1">
                        🆕 Apenas novos
                    </span>
                </label>
            </div>

            <hr className="border-slate-200" />

            {/* Categorias */}
            {categories.length > 0 && (
                <div>
                    <h4 className="font-semibold text-slate-900 mb-3">Categorias</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {categories.map((category) => (
                            <label
                                key={category.id}
                                className="flex items-center justify-between gap-3 cursor-pointer group hover:bg-slate-50 p-2 rounded-lg transition-colors"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <input
                                        type="checkbox"
                                        checked={filters.categories.includes(category.id)}
                                        onChange={() => handleCategoryToggle(category.id)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700 group-hover:text-slate-900">
                                        {category.name}
                                    </span>
                                </div>
                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {category.count}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <hr className="border-slate-200" />

            {/* Marcas */}
            {brands.length > 0 && (
                <div>
                    <h4 className="font-semibold text-slate-900 mb-3">Marcas</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {brands.map((brand) => (
                            <label
                                key={brand.name}
                                className="flex items-center justify-between gap-3 cursor-pointer group hover:bg-slate-50 p-2 rounded-lg transition-colors"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <input
                                        type="checkbox"
                                        checked={filters.brands.includes(brand.name)}
                                        onChange={() => handleBrandToggle(brand.name)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700 group-hover:text-slate-900">
                                        {brand.name}
                                    </span>
                                </div>
                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {brand.count}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    if (position === 'topbar') {
        return (
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filtros
                    {activeFiltersCount > 0 && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                            {activeFiltersCount}
                        </span>
                    )}
                </button>

                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/20 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <div className="absolute top-full mt-2 right-0 w-80 bg-white rounded-lg shadow-xl border border-slate-200 p-6 z-50">
                            <FilterContent />
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Sidebar variant
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-4">
            <FilterContent />
        </div>
    );
}
