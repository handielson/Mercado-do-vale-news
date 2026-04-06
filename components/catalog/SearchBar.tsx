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

    // Sync value if initialValue changes externally (like when clearing via URL)
    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    return (
        <form onSubmit={(e) => e.preventDefault()} className="relative block w-full">
            <div
                className={`relative flex items-center transition-all duration-300 border ${isFocused
                    ? 'ring-4 ring-blue-500/10 border-blue-400 bg-white shadow-md'
                    : 'border-slate-200 bg-slate-50 shadow-sm hover:border-slate-300 hover:bg-white'
                    } rounded-2xl`}
            >
                {/* Ícone de busca */}
                <div className="absolute left-3.5 sm:left-4 pointer-events-none">
                    <Search
                        className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${isFocused ? 'text-blue-500' : 'text-slate-400'
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
                    className="w-full pl-10 pr-10 sm:pl-12 sm:pr-12 py-2.5 sm:py-3 text-sm sm:text-base text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none rounded-2xl"
                />

                {/* Botão de limpar */}
                {value && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-3 p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Limpar busca"
                    >
                        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                )}
            </div>
        </form>
    );
}
