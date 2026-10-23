
import React, { useState, useEffect, useId, useRef } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { colorService } from '../../../services/colors';
import { modelColorImagesService } from '../../../services/model-color-images';
import { Color } from '../../../types/color';
import { colorSampleStyle } from '../../../utils/colorAppearance.mjs';
import { SearchableSelect } from '../../ui/SearchableSelect';
import { modelColorOptions } from '../../../services/modelColorOptions.mjs';

interface ColorSelectProps {
    value: string;
    onChange: (color: string) => void;
    error?: string;
    modelId?: string;
}

/**
 * ColorSelect Component
 * Select with redirect to color management page
 *
 * ANTIGRAVITY PROTOCOL:
 * - Uses VPS-based colorService (online, multi-tenant)
 * - Shows active colors and colors with photos for the selected model
 * - Redirect to /admin/settings/colors for creation
 * - Refresh button reloads colors from VPS
 */
export const ColorSelect: React.FC<ColorSelectProps> = ({
    value,
    onChange,
    error,
    modelId
}) => {
    const fieldId = useId();
    const [colors, setColors] = useState<Color[]>([]);
    const [photoColorIds, setPhotoColorIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const requestId = useRef(0);

    useEffect(() => {
        void loadColors();
        return () => { requestId.current += 1; };
    }, [modelId]);

    const loadColors = async (forceRefresh = false) => {
        const currentRequest = ++requestId.current;
        try {
            setIsLoading(true);
            setLoadError('');
            if (forceRefresh) await colorService.refreshActive();
            const [data, imageRows] = await Promise.all([
                colorService.list(),
                modelId ? modelColorImagesService.getByModel(modelId).catch(error => {
                    console.error('Error loading model color photos:', error);
                    if (currentRequest === requestId.current) setLoadError('Não foi possível carregar as cores com fotos deste modelo. Atualize a lista para tentar novamente.');
                    return [];
                }) : Promise.resolve([]),
            ]);
            if (currentRequest !== requestId.current) return;
            const choices = modelColorOptions(data, imageRows);
            setPhotoColorIds(choices.suggested.map(color => color.id));
            setColors(choices.options);
        } catch (error) {
            if (currentRequest !== requestId.current) return;
            console.error('Error loading colors:', error);
            setLoadError('Não foi possível atualizar as cores. A lista anterior foi mantida; tente novamente.');
        } finally {
            if (currentRequest === requestId.current) setIsLoading(false);
        }
    };

    const getColorHex = (colorName: string): string | undefined => {
        return colors.find(color => color.name === colorName)?.hex_code || colorService.getColorHex(colorName);
    };
    const suggestedColors = colors.filter(color => photoColorIds.includes(color.id));
    const options = [...suggestedColors, ...colors.filter(color => !photoColorIds.includes(color.id))].map(color => color.name);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                    <label htmlFor={fieldId} className="sr-only">Cor</label>
                    <SearchableSelect
                        id={fieldId}
                        value={value}
                        onChange={onChange}
                        options={options}
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

            {suggestedColors.length > 0 && <div className="flex flex-wrap items-center gap-2" aria-label="Cores com fotos neste modelo">
                <span className="text-xs text-slate-600">Cores com fotos neste modelo:</span>
                {suggestedColors.map(color => <button key={color.id} type="button" onClick={() => onChange(color.name)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${value === color.name ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700'}`}>
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-300" style={colorSampleStyle(color.name, color.hex_code)} aria-hidden="true" />{color.name}
                </button>)}
            </div>}

            {error && (
                <p className="text-xs text-red-600">{error}</p>
            )}
            {loadError && <p role="alert" className="text-xs text-red-600">{loadError}</p>}
        </div>
    );
};
