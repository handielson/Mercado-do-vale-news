import { useState, useEffect, useCallback, useRef } from 'react';
import { SlidersHorizontal, ChevronDown, X, ArrowUpDown } from 'lucide-react';
import type { FilterState } from '@/components/catalog';

interface FilterStats {
    brands: Array<{ name: string; count: number }>;
    priceRange?: { min: number; max: number };
}

interface CatalogFiltersProps {
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
    filterStats: FilterStats;
}

type SortOption = { value: FilterState['sortBy']; label: string };

const SORT_OPTIONS: SortOption[] = [
    { value: 'recent', label: '🕐 Mais recentes' },
    { value: 'price_asc', label: '💰 Menor preço' },
    { value: 'price_desc', label: '💎 Maior preço' },
    { value: 'featured', label: '⭐ Destaques' }
];

function formatPrice(cents: number) {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CatalogFilters({ filters, onFiltersChange, filterStats }: CatalogFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const globalMin = filterStats.priceRange?.min ?? 0;
    const globalMax = filterStats.priceRange?.max ?? 1000000;
    const [sliderMin, setSliderMin] = useState(filters.priceRange?.min ?? globalMin);
    const [sliderMax, setSliderMax] = useState(filters.priceRange?.max ?? globalMax);

    useEffect(() => {
        setSliderMin(filters.priceRange?.min ?? globalMin);
        setSliderMax(filters.priceRange?.max ?? globalMax);
    }, [filters.priceRange, globalMin, globalMax]);

    // Fechar ao clicar fora
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const activeCount =
        filters.brands.length +
        (filters.priceRange ? 1 : 0) +
        (filters.sortBy && filters.sortBy !== 'recent' ? 1 : 0);

    const toggleBrand = useCallback((brand: string) => {
        const updated = filters.brands.includes(brand)
            ? filters.brands.filter(b => b !== brand)
            : [...filters.brands, brand];
        onFiltersChange({ ...filters, brands: updated });
    }, [filters, onFiltersChange]);

    const applyPriceRange = useCallback(() => {
        const isFullRange = sliderMin <= globalMin && sliderMax >= globalMax;
        onFiltersChange({
            ...filters,
            priceRange: isFullRange ? null : { min: sliderMin, max: sliderMax }
        });
    }, [filters, sliderMin, sliderMax, globalMin, globalMax, onFiltersChange]);

    const clearAll = useCallback(() => {
        setSliderMin(globalMin);
        setSliderMax(globalMax);
        onFiltersChange({ ...filters, brands: [], priceRange: null, sortBy: 'recent' });
    }, [filters, globalMin, globalMax, onFiltersChange]);

    const currentSortLabel = SORT_OPTIONS.find(o => o.value === (filters.sortBy ?? 'recent'))?.label ?? '🕐 Mais recentes';

    return (
        <div className="relative">
            {/* Botão trigger — fica inline com SearchBar via flex no pai */}
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(v => !v)}
                className={`flex items-center gap-2 h-full px-4 py-2.5 rounded-xl border text-sm font-medium transition-all whitespace-nowrap ${activeCount > 0 || isOpen
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:text-blue-600'
                    }`}
            >
                <SlidersHorizontal className="w-4 h-4 flex-shrink-0" />
                <span>Filtros</span>
                {activeCount > 0 && (
                    <span className="bg-white/30 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                        {activeCount}
                    </span>
                )}
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div
                    ref={panelRef}
                    className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl p-5 space-y-5 z-50"
                >
                    {/* Cabeçalho */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                            Filtros &amp; Ordenação
                        </span>
                        {activeCount > 0 && (
                            <button
                                onClick={clearAll}
                                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                            >
                                <X className="w-3 h-3" />
                                Limpar tudo
                            </button>
                        )}
                    </div>

                    {/* Ordenar por */}
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <ArrowUpDown className="w-3 h-3" />
                            Ordenar por
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                            {SORT_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => onFiltersChange({ ...filters, sortBy: opt.value })}
                                    className={`text-xs px-3 py-2 rounded-lg border text-left transition-all ${(filters.sortBy ?? 'recent') === opt.value
                                            ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Filtro por Marca */}
                    {filterStats.brands.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Marca</p>
                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                                {filterStats.brands.map(({ name }) => (
                                    <button
                                        key={name}
                                        onClick={() => toggleBrand(name)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${filters.brands.includes(name)
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300'
                                            }`}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Slider de preço */}
                    {globalMax > globalMin && (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Faixa de Preço</p>
                                <span className="text-xs text-blue-600 font-medium">
                                    {formatPrice(sliderMin)} – {formatPrice(sliderMax)}
                                </span>
                            </div>

                            <div className="relative h-6 flex items-center">
                                {/* Track */}
                                <div className="absolute w-full h-1.5 rounded-full bg-slate-200">
                                    <div
                                        className="absolute h-1.5 rounded-full bg-blue-500"
                                        style={{
                                            left: `${((sliderMin - globalMin) / (globalMax - globalMin)) * 100}%`,
                                            right: `${100 - ((sliderMax - globalMin) / (globalMax - globalMin)) * 100}%`
                                        }}
                                    />
                                </div>

                                {/* Slider mín */}
                                <input type="range" min={globalMin} max={globalMax}
                                    step={Math.max(1, Math.floor((globalMax - globalMin) / 100))}
                                    value={sliderMin}
                                    onChange={e => setSliderMin(Math.min(Number(e.target.value), sliderMax - 1))}
                                    onMouseUp={applyPriceRange} onTouchEnd={applyPriceRange}
                                    className="absolute w-full h-1.5 opacity-0 cursor-pointer"
                                    style={{ zIndex: sliderMin > globalMax - (globalMax - globalMin) * 0.1 ? 5 : 3 }}
                                />

                                {/* Slider máx */}
                                <input type="range" min={globalMin} max={globalMax}
                                    step={Math.max(1, Math.floor((globalMax - globalMin) / 100))}
                                    value={sliderMax}
                                    onChange={e => setSliderMax(Math.max(Number(e.target.value), sliderMin + 1))}
                                    onMouseUp={applyPriceRange} onTouchEnd={applyPriceRange}
                                    className="absolute w-full h-1.5 opacity-0 cursor-pointer"
                                    style={{ zIndex: 4 }}
                                />

                                {/* Thumbs visuais */}
                                <div className="absolute w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-md pointer-events-none"
                                    style={{ left: `calc(${((sliderMin - globalMin) / (globalMax - globalMin)) * 100}% - 8px)` }} />
                                <div className="absolute w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-md pointer-events-none"
                                    style={{ left: `calc(${((sliderMax - globalMin) / (globalMax - globalMin)) * 100}% - 8px)` }} />
                            </div>

                            <div className="flex justify-between text-xs text-slate-400 mt-1">
                                <span>{formatPrice(globalMin)}</span>
                                <span>{formatPrice(globalMax)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Chips rápidos visíveis fora do dropdown */}
            {!isOpen && (filters.brands.length > 0 || (filters.sortBy && filters.sortBy !== 'recent')) && (
                <div className="absolute top-full left-0 mt-1 flex flex-wrap gap-1 z-10">
                    {filters.sortBy && filters.sortBy !== 'recent' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            {currentSortLabel}
                            <button onClick={() => onFiltersChange({ ...filters, sortBy: 'recent' })}><X className="w-3 h-3" /></button>
                        </span>
                    )}
                    {filters.brands.map(b => (
                        <span key={b} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            {b}
                            <button onClick={() => toggleBrand(b)}><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
