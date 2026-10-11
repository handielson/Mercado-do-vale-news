
import React, { useState, useEffect, useId } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { colorService } from '../../../services/colors';
import { Color } from '../../../types/color';
import { colorSampleStyle } from '../../../utils/colorAppearance.mjs';
import { SearchableSelect } from '../../ui/SearchableSelect';

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
 * - Uses VPS-based colorService (online, multi-tenant)
 * - Shows only active colors
 * - Redirect to /admin/settings/colors for creation
 * - Refresh button reloads colors from VPS
 */
export const ColorSelect: React.FC<ColorSelectProps> = ({
    value,
    onChange,
    error
}) => {
    const fieldId = useId();
    const [colors, setColors] = useState<Color[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        loadColors();
    }, []);

    const loadColors = async (forceRefresh = false) => {
        try {
            setIsLoading(true);
            setLoadError('');
            const data = await (forceRefresh ? colorService.refreshActive() : colorService.listActive());
            setColors(data);
        } catch (error) {
            console.error('Error loading colors:', error);
            setLoadError('Não foi possível atualizar as cores. A lista anterior foi mantida; tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const getColorHex = (colorName: string): string | undefined => {
        return colors.find(color => color.name === colorName)?.hex_code || colorService.getColorHex(colorName);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                    <label htmlFor={fieldId} className="sr-only">Cor</label>
                    <SearchableSelect
                        id={fieldId}
                        value={value}
                        onChange={onChange}
                        options={colors.map(color => color.name)}
                        disabled={isLoading}
                        placeholder="Selecione uma cor"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                        renderLeading={name => <span
                            className="block h-5 w-5 shrink-0 rounded border border-slate-300"
                            style={colorSampleStyle(name, getColorHex(name))}
                            title={name}
                        />}
                    />
                </div>

                <button
                    type="button"
                    onClick={() => void loadColors(true)}
                    disabled={isLoading}
                    className="shrink-0 p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center disabled:opacity-50"
                    title="Atualizar lista de cores"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                <a
                    href="/admin/settings/colors"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center"
                    title="Gerenciar Cores (abre em nova aba)"
                >
                    <Plus className="w-5 h-5" />
                </a>
            </div>

            {error && (
                <p className="text-xs text-red-600">{error}</p>
            )}
            {loadError && <p role="alert" className="text-xs text-red-600">{loadError}</p>}
        </div>
    );
};
