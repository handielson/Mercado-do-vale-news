import { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
    onSearch: (query: string) => void;
    placeholder?: string;
    debounceMs?: number;
    initialValue?: string;
}

export function SearchBar({
    onSearch,
    placeholder = 'Buscar produtos...',
    debounceMs = 300,
    initialValue = ''
}: SearchBarProps) {
    const [value, setValue] = useState(initialValue);
    const [isFocused, setIsFocused] = useState(false);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            onSearch(value);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [value, debounceMs, onSearch]);

    const handleClear = useCallback(() => {
        setValue('');
        onSearch('');
    }, [onSearch]);

    return (
        <div className="relative">
            <div
                className={`relative flex items-center transition-all ${isFocused
                        ? 'ring-2 ring-blue-500 shadow-lg'
                        : 'ring-1 ring-slate-300 shadow-sm'
                    } rounded-lg bg-white`}
            >
                {/* Ícone de busca */}
                <div className="absolute left-4 pointer-events-none">
                    <Search
                        className={`w-5 h-5 transition-colors ${isFocused ? 'text-blue-600' : 'text-slate-400'
                            }`}
                    />
                </div>

                {/* Input */}
                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholder}
                    className="w-full pl-12 pr-12 py-3 text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none"
                />

                {/* Botão de limpar */}
                {value && (
                    <button
                        onClick={handleClear}
                        className="absolute right-4 p-1 rounded-full hover:bg-slate-100 transition-colors"
                        aria-label="Limpar busca"
                    >
                        <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                    </button>
                )}
            </div>

            {/* Indicador de busca ativa */}
            {value && (
                <div className="absolute top-full mt-2 left-0 right-0 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                    Buscando por: <span className="font-semibold">"{value}"</span>
                </div>
            )}
        </div>
    );
}
