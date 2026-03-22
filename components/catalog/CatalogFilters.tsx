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
                className={`flex items-center gap-1.5 sm:gap-2 h-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap ${activeCount > 0 || isOpen
                        ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-inner'
                        : 'bg-white text-slate-600 border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50'
                    }`}
            >
                <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Filtros</span>
                {activeCount > 0 && (
                    <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                        {activeCount}
                    </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div
                    ref={panelRef}
                    className="absolute right-0 top-full mt-3 w-[340px] bg-white/95 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] p-6 z-50"
                >
                    {/* Cabeçalho */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                        <span className="text-base font-medium text-slate-800 flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                            Filtros da Loja
                        </span>
                        {activeCount > 0 && (
                            <button
                                onClick={clearAll}
                                className="flex items-center gap-1 text-[11px] bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1.5 rounded-full font-medium transition-colors"
                            >
                                <X className="w-3 h-3" />
                                Limpar
                            </button>
                        )}
                    </div>

                    <div className="space-y-6">
                        {/* Ordenar por */}
                        <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <ArrowUpDown className="w-3.5 h-3.5" />
                                Ordenar por
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {SORT_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => onFiltersChange({ ...filters, sortBy: opt.value })}
                                        className={`text-[11px] px-3 md:px-4 py-2.5 rounded-2xl text-left font-medium transition-all duration-300 ${(filters.sortBy ?? 'recent') === opt.value
                                                ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-900'
                                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Marcas</p>
                            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                {filterStats.brands.map(({ name }) => (
                                    <button
                                        key={name}
                                        onClick={() => toggleBrand(name)}
                                        className={`px-3.5 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 border ${filters.brands.includes(name)
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
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
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Faixa de Preço</p>
                                    <span className="text-[11px] bg-slate-50 text-slate-700 px-2 py-1 rounded-lg font-medium border border-slate-100">
                                        {formatPrice(sliderMin)} – {formatPrice(sliderMax)}
                                    </span>
                                </div>

                                <div className="relative h-6 flex items-center">
                                    {/* Track */}
                                    <div className="absolute w-full h-1.5 rounded-full bg-slate-100">
                                        <div
                                            className="absolute h-1.5 rounded-full bg-slate-800 transition-all duration-75"
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
                                    <div className="absolute w-4 h-4 bg-white border-[3.5px] border-slate-800 rounded-full shadow-sm pointer-events-none transition-transform"
                                        style={{ left: `calc(${((sliderMin - globalMin) / (globalMax - globalMin)) * 100}% - 8px)` }} />
                                    <div className="absolute w-4 h-4 bg-white border-[3.5px] border-slate-800 rounded-full shadow-sm pointer-events-none transition-transform"
                                        style={{ left: `calc(${((sliderMax - globalMin) / (globalMax - globalMin)) * 100}% - 8px)` }} />
                                </div>

                                <div className="flex justify-between text-[10px] text-slate-400 mt-2">
                                    <span>Ocultar os mais baratos</span>
                                    <span>Limite de crédito</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
