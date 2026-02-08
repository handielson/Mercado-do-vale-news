
import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { colorService, COLOR_MAP } from '../../../services/colors';
import { Color } from '../../../types/color';

interface ColorSelectProps {
    value: string;
    onChange: (color: string) => void;
    error?: string;
}

/**
 * ColorSelect Component
 * Select with redirect to color management page
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Uses Supabase-based colorService (online, multi-tenant)
 * - Shows only active colors
 * - Redirect to /admin/settings/colors for creation
 * - Refresh button reloads colors from Supabase
 */
export const ColorSelect: React.FC<ColorSelectProps> = ({
    value,
    onChange,
    error
}) => {
    const [colors, setColors] = useState<Color[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadColors();
    }, []);

    const loadColors = async () => {
        try {
            setIsLoading(true);
            const data = await colorService.listActive(); // Fetches fresh data from Supabase
            setColors(data);
        } catch (error) {
            console.error('Error loading colors:', error);
        } finally {
            setIsLoading(false);
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
                    onClick={loadColors}
                    disabled={isLoading}
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center disabled:opacity-50"
                    title="Atualizar lista de cores"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                <a
                    href="/admin/settings/colors"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center"
                    title="Gerenciar Cores (abre em nova aba)"
                >
                    <Plus className="w-5 h-5" />
                </a>
            </div>

            {error && (
                <p className="text-xs text-red-600">{error}</p>
            )}
        </div>
    );
};
