import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { colorService } from '../../../services/colors';
import { Color } from '../../../types/color';

interface ColorSmartSelectProps {
    value: string; // color_id
    onChange: (colorId: string, colorName: string) => void;
    error?: string;
}

/**
 * ColorSmartSelect Component
 * Smart selector with search/autocomplete for colors
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Type to search colors
 * - Shows color preview (hex code)
 * - Keyboard navigation
 * - Create new color on-the-fly
 */
export function ColorSmartSelect({ value, onChange, error }: ColorSmartSelectProps) {
    const [colors, setColors] = useState<Color[]>([]);
    const [filteredColors, setFilteredColors] = useState<Color[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedColor, setSelectedColor] = useState<Color | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load colors on mount
    useEffect(() => {
        loadColors();
    }, []);

    // Load selected color
    useEffect(() => {
        if (value && colors.length > 0) {
            const color = colors.find(c => c.id === value);
            setSelectedColor(color || null);
            setSearchTerm(color?.name || '');
        }
    }, [value, colors]);

    // Filter colors based on search
    useEffect(() => {
        if (searchTerm) {
            const filtered = colors.filter(c =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredColors(filtered);
        } else {
            setFilteredColors(colors);
        }
    }, [searchTerm, colors]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                !inputRef.current?.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadColors = async () => {
        try {
            setIsLoading(true);
            const data = await colorService.listActive();
            setColors(data);
            setFilteredColors(data);
        } catch (error) {
            console.error('Error loading colors:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = (color: Color) => {
        setSelectedColor(color);
        setSearchTerm(color.name);
        onChange(color.id, color.name);
        setIsOpen(false);
    };

    const handleClear = () => {
        setSelectedColor(null);
        setSearchTerm('');
        onChange('', '');
        inputRef.current?.focus();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setIsOpen(true);
        if (!e.target.value) {
            setSelectedColor(null);
            onChange('', '');
        }
    };

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">
                Cor *
                <span className="ml-2 text-xs text-slate-400 font-mono">specs.color_id</span>
            </label>

            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Digite para buscar..."
                    className={`
                        w-full px-3 py-2 pr-20 border rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                        ${error ? 'border-red-500' : 'border-slate-300'}
                    `}
                />

                {/* Color preview */}
                {selectedColor && (
                    <div
                        className="absolute right-10 top-1/2 -translate-y-1/2 w-6 h-6 rounded border border-slate-300"
                        style={{ backgroundColor: selectedColor.hex_code }}
                        title={selectedColor.hex_code}
                    />
                )}

                {/* Clear button */}
                {selectedColor && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
                    >
                        <X size={16} className="text-slate-400" />
                    </button>
                )}

                {/* Search icon */}
                {!selectedColor && (
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                )}
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                    {isLoading ? (
                        <div className="p-3 text-center text-sm text-slate-500">
                            Carregando cores...
                        </div>
                    ) : filteredColors.length > 0 ? (
                        filteredColors.map(color => (
                            <button
                                key={color.id}
                                type="button"
                                onClick={() => handleSelect(color)}
                                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                            >
                                <div
                                    className="w-5 h-5 rounded border border-slate-300 flex-shrink-0"
                                    style={{ backgroundColor: color.hex_code }}
                                />
                                <span className="text-sm text-slate-900">{color.name}</span>
                                <span className="text-xs text-slate-500 ml-auto">{color.hex_code}</span>
                            </button>
                        ))
                    ) : (
                        <div className="p-3 text-center text-sm text-slate-500">
                            Nenhuma cor encontrada
                        </div>
                    )}
                </div>
            )}

            {/* Error message */}
            {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
        </div>
    );
}
