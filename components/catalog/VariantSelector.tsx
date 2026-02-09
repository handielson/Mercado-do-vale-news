import { useState } from 'react';
import { Check } from 'lucide-react';
import type { ProductVariants, VariantSpecs } from '@/services/productVariants';

interface VariantSelectorProps {
    variants: ProductVariants;
    selected: VariantSpecs;
    onSelect: (specs: VariantSpecs) => void;
    productImages?: Record<string, string>; // color -> image URL
}

export function VariantSelector({
    variants,
    selected,
    onSelect,
    productImages = {}
}: VariantSelectorProps) {
    const [hoveredColor, setHoveredColor] = useState<string | null>(null);

    // Handle RAM/Storage selection
    const handleMemorySelect = (ram: string, storage: string) => {
        onSelect({ ...selected, ram, storage });
    };

    // Handle color selection
    const handleColorSelect = (color: string) => {
        onSelect({ ...selected, color });
    };

    // Build memory options (RAM/Storage combinations)
    const memoryOptions: string[] = [];
    for (const ram of variants.rams) {
        for (const storage of variants.storages) {
            memoryOptions.push(`${ram}/${storage}`);
        }
    }

    return (
        <div className="space-y-6">
            {/* Memory Selection */}
            {memoryOptions.length > 0 && (
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Memória
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {memoryOptions.map((option) => {
                            const [ram, storage] = option.split('/');
                            const isSelected = selected.ram === ram && selected.storage === storage;

                            return (
                                <button
                                    key={option}
                                    onClick={() => handleMemorySelect(ram, storage)}
                                    className={`
                                        relative px-4 py-2.5 rounded-lg font-medium text-sm
                                        transition-all duration-200
                                        ${isSelected
                                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md scale-105'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-102'
                                        }
                                    `}
                                >
                                    {option}
                                    {isSelected && (
                                        <Check className="absolute top-1 right-1 w-4 h-4" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Color Selection with Preview */}
            {variants.colors.length > 0 && (
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Cor
                    </label>

                    {/* Color Preview Image */}
                    {hoveredColor && productImages[hoveredColor] && (
                        <div className="mb-4 rounded-lg overflow-hidden border-2 border-blue-500 shadow-lg">
                            <img
                                src={productImages[hoveredColor]}
                                alt={hoveredColor}
                                className="w-full h-48 object-cover transition-opacity duration-300"
                            />
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                        {variants.colors.map((color) => {
                            const isSelected = selected.color === color.name;

                            return (
                                <button
                                    key={color.name}
                                    onClick={() => handleColorSelect(color.name)}
                                    onMouseEnter={() => setHoveredColor(color.name)}
                                    onMouseLeave={() => setHoveredColor(null)}
                                    className={`
                                        relative flex items-center gap-2 px-4 py-2.5 rounded-lg
                                        font-medium text-sm transition-all duration-200
                                        ${isSelected
                                            ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md scale-105'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-102'
                                        }
                                    `}
                                >
                                    {/* Color Circle */}
                                    {color.hex && (
                                        <div
                                            className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                                            style={{ backgroundColor: color.hex }}
                                        />
                                    )}
                                    <span>{color.name}</span>
                                    {isSelected && (
                                        <Check className="w-4 h-4 ml-1" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
