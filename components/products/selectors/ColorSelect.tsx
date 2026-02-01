
import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { colorService, COLOR_MAP } from '../../../services/colors';
import { Color } from '../../../types/color';

interface ColorSelectProps {
    value: string;
    onChange: (color: string) => void;
    error?: string;
}

/**
 * ColorSelect Component
 * Select with inline color creation and visual preview dots
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Uses localStorage-based colorService
 * - Shows only active colors
 * - Inline creation capability
 * - Visual hex preview for known colors
 */
export const ColorSelect: React.FC<ColorSelectProps> = ({
    value,
    onChange,
    error
}) => {
    const [colors, setColors] = useState<Color[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newColorName, setNewColorName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadColors();
    }, []);

    const loadColors = async () => {
        try {
            setIsLoading(true);
            const data = await colorService.listActive(); // Only active colors
            setColors(data);
        } catch (error) {
            console.error('Error loading colors:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateColor = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newColorName.trim()) return;

        try {
            setIsCreating(true);
            const newColor = await colorService.create({
                name: newColorName.trim(),
                active: true
            });
            await loadColors(); // Reload to get updated list
            onChange(newColor.name); // Set the new color as selected
            setNewColorName('');
            setShowCreateDialog(false);
        } catch (error) {
            console.error('Error creating color:', error);
            alert('Erro ao criar cor');
        } finally {
            setIsCreating(false);
        }
    };

    const getColorHex = (colorName: string): string | undefined => {
        return colorService.getColorHex(colorName);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={isLoading}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                    >
                        <option value="">Selecione uma cor</option>
                        {colors.map((color) => (
                            <option key={color.id} value={color.name}>
                                {color.name}
                            </option>
                        ))}
                    </select>

                    {/* Color preview dot */}
                    {value && getColorHex(value) && (
                        <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded-full border border-slate-300"
                                style={{ backgroundColor: getColorHex(value) }}
                                title={value}
                            />
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setShowCreateDialog(true)}
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Nova Cor"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {error && (
                <p className="text-xs text-red-600">{error}</p>
            )}

            {/* Inline Create Dialog */}
            {showCreateDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Nova Cor</h3>
                            <button
                                onClick={() => setShowCreateDialog(false)}
                                className="p-1 hover:bg-slate-100 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateColor} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nome da Cor
                                </label>
                                <input
                                    type="text"
                                    value={newColorName}
                                    onChange={(e) => setNewColorName(e.target.value)}
                                    placeholder="Ex: Azul Meia-Noite"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Cores conhecidas terão preview visual automático
                                </p>
                            </div>

                            {/* Preview of known colors */}
                            <div className="flex flex-wrap gap-2">
                                {Object.keys(COLOR_MAP).map((colorName) => (
                                    <button
                                        key={colorName}
                                        type="button"
                                        onClick={() => setNewColorName(colorName)}
                                        className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                                    >
                                        <div
                                            className="w-3 h-3 rounded-full border border-slate-300"
                                            style={{ backgroundColor: COLOR_MAP[colorName] }}
                                        />
                                        {colorName}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateDialog(false)}
                                    disabled={isCreating}
                                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating || !newColorName.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isCreating ? 'Criando...' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
