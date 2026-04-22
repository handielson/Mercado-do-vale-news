import React, { useMemo, useState } from 'react';
import { Type, Upload, Wand2 } from 'lucide-react';

import {
    applyTypographyPreset,
    buildGoogleFontOption,
    buildUploadedFontOption,
    BUILTIN_MARKETING_FONTS,
    findMarketingTypographyFontOption,
    isolateTypographySelection,
    MARKETING_TYPOGRAPHY_PRESETS,
    ONLINE_MARKETING_FONT_CATALOG,
    selectTypographySegment,
    splitTypographyField,
    updateSelectedTypographySegmentStyle,
    updateTypographyFieldText,
    upsertTypographyFontOption,
    type MarketingTypographyFieldKey,
    type MarketingTypographyFontOption,
    type MarketingTypographyStyle,
} from '../../../../utils/marketing-typography';
import type { MarketingStickerSettings } from '../../../../utils/marketing-sticker';

interface MarketingStickerTypographyEditorProps {
    settings: MarketingStickerSettings;
    onChange: (nextSettings: MarketingStickerSettings) => void;
}

const FIELD_META: Array<{ key: MarketingTypographyFieldKey; label: string; helper: string }> = [
    { key: 'kicker', label: 'Topo', helper: 'selo superior' },
    { key: 'main', label: 'Principal', helper: 'texto de impacto' },
    { key: 'price', label: 'Preco', helper: 'valor ou oferta' },
    { key: 'footer', label: 'Rodape', helper: 'cta final' },
];

const STYLE_SLIDERS: Array<{
    key: keyof Pick<MarketingTypographyStyle, 'outlineWidth' | 'depth' | 'shadowBlur' | 'letterSpacing'>;
    label: string;
    min: number;
    max: number;
    step: number;
    formatter?: (value: number) => string;
}> = [
    { key: 'outlineWidth', label: 'Contorno', min: 0, max: 8, step: 1 },
    { key: 'depth', label: 'Extrusao 3D', min: 0, max: 14, step: 1 },
    { key: 'shadowBlur', label: 'Sombra suave', min: 0, max: 24, step: 1 },
    {
        key: 'letterSpacing',
        label: 'Tracking',
        min: -0.08,
        max: 0.14,
        step: 0.01,
        formatter: (value) => value.toFixed(2),
    },
];

const PANEL_TABS = [
    { id: 'style', label: 'Inspector' },
    { id: 'fonts', label: 'Fontes' },
] as const;

const COLOR_FIELDS: Array<{
    key: keyof Pick<MarketingTypographyStyle, 'color' | 'outlineColor' | 'depthColor' | 'shadowColor'>;
    label: string;
}> = [
    { key: 'color', label: 'Face' },
    { key: 'outlineColor', label: 'Contorno' },
    { key: 'depthColor', label: 'Extrusao' },
    { key: 'shadowColor', label: 'Sombra' },
];

const getSegmentLabel = (value: string): string => {
    if (value === ' ') return 'espaco';
    if (value.trim().length === 0) return 'vazio';
    return value;
};

export default function MarketingStickerTypographyEditor({
    settings,
    onChange,
}: MarketingStickerTypographyEditorProps) {
    const [activeFieldKey, setActiveFieldKey] = useState<MarketingTypographyFieldKey>('main');
    const [googleFontName, setGoogleFontName] = useState('');
    const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
    const [activePanel, setActivePanel] = useState<(typeof PANEL_TABS)[number]['id']>('style');

    const activeField = settings.typography.fields[activeFieldKey];
    const selectedSegment = activeField.segments.find((segment) => segment.id === activeField.selectedSegmentId) ?? null;
    const activeStyle = selectedSegment?.style ?? activeField.simpleStyle;

    const allFontOptions = useMemo(() => {
        const seen = new Set<string>();
        return [...BUILTIN_MARKETING_FONTS, ...settings.typography.fonts, ...ONLINE_MARKETING_FONT_CATALOG]
            .filter((font) => {
                if (seen.has(font.id)) return false;
                seen.add(font.id);
                return true;
            });
    }, [settings.typography.fonts]);

    const commitTypography = (
        nextTypography: MarketingStickerSettings['typography'],
    ) => {
        const nextFields = nextTypography.fields;
        onChange({
            ...settings,
            typography: nextTypography,
            kickerText: nextFields.kicker.text,
            mainText: nextFields.main.text,
            priceText: nextFields.price.text,
            footerText: nextFields.footer.text,
        });
    };

    const updateField = (
        fieldKey: MarketingTypographyFieldKey,
        nextField: MarketingStickerSettings['typography']['fields'][MarketingTypographyFieldKey],
        nextFonts: MarketingTypographyFontOption[] = settings.typography.fonts,
    ) => {
        commitTypography({
            ...settings.typography,
            fonts: nextFonts,
            fields: {
                ...settings.typography.fields,
                [fieldKey]: nextField,
            },
        });
    };

    const handleTextChange = (value: string) => {
        updateField(activeFieldKey, updateTypographyFieldText(activeField, value));
    };

    const handlePreset = (presetId: typeof MARKETING_TYPOGRAPHY_PRESETS[number]['id']) => {
        updateField(activeFieldKey, applyTypographyPreset(activeField, presetId));
    };

    const handleStylePatch = (patch: Partial<MarketingTypographyStyle>) => {
        updateField(activeFieldKey, updateSelectedTypographySegmentStyle(activeField, patch));
    };

    const handleSplit = (mode: 'letters' | 'words') => {
        updateField(activeFieldKey, splitTypographyField(activeField, mode));
    };

    const handleIsolateSelection = () => {
        if (selectionRange.end <= selectionRange.start) return;
        updateField(
            activeFieldKey,
            isolateTypographySelection(activeField, selectionRange.start, selectionRange.end),
        );
    };

    const handleSwitchBackToSimple = () => {
        updateField(activeFieldKey, {
            ...activeField,
            mode: 'simple',
            segments: [],
            selectedSegmentId: null,
        });
    };

    const applyFontOption = (font: MarketingTypographyFontOption, shouldPersist: boolean) => {
        const nextFonts = shouldPersist
            ? upsertTypographyFontOption(settings.typography.fonts, font)
            : settings.typography.fonts;

        updateField(
            activeFieldKey,
            updateSelectedTypographySegmentStyle(activeField, {
                fontId: font.id,
                fontFamily: font.family,
            }),
            nextFonts,
        );
    };

    const handleGoogleFontAdd = () => {
        const trimmed = googleFontName.trim();
        if (!trimmed) return;
        const font = buildGoogleFontOption(trimmed);
        applyFontOption(font, true);
        setGoogleFontName('');
    };

    const handleFontUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const [file] = Array.from(event.target.files ?? []);
        if (!file) return;

        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ''));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });

        const font = buildUploadedFontOption(file.name.replace(/\.[^.]+$/, ''), dataUrl);
        applyFontOption(font, true);
        event.target.value = '';
    };

    return (
        <div className="space-y-4 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Tipografia avancada</p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">Mais controle sem quebrar o layout</h3>
                    <p className="mt-1 max-w-xl text-sm text-slate-500">
                        Comece por um preset, ajuste o 3D no inspector e so desmembre em letras quando realmente precisar.
                    </p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 shadow-sm">
                    studio sticker
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {FIELD_META.map((field) => {
                    const item = settings.typography.fields[field.key];
                    return (
                        <button
                            key={field.key}
                            type="button"
                            onClick={() => setActiveFieldKey(field.key)}
                            className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                                activeFieldKey === field.key
                                    ? 'border-emerald-500 bg-white shadow-sm'
                                    : 'border-emerald-100 bg-emerald-100/40 hover:bg-white'
                            }`}
                        >
                            <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">{field.label}</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-500">{field.helper}</p>
                            <p className="mt-2 text-xs font-bold text-slate-700">
                                {item.mode === 'advanced' ? `${item.segments.length} segmento(s)` : 'Modo simples'}
                            </p>
                        </button>
                    );
                })}
            </div>

            <div className="space-y-4 rounded-xl border border-white/80 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Campo ativo</p>
                        <h4 className="text-base font-black text-slate-900">
                            {FIELD_META.find((field) => field.key === activeFieldKey)?.label}
                        </h4>
                    </div>
                    {activeField.mode === 'advanced' ? (
                        <button
                            type="button"
                            onClick={handleSwitchBackToSimple}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Voltar ao simples
                        </button>
                    ) : (
                        <div className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
                            Simples
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Texto base
                    </label>
                    <textarea
                        value={activeField.text}
                        onChange={(event) => handleTextChange(event.target.value)}
                        onSelect={(event) => setSelectionRange({
                            start: event.currentTarget.selectionStart ?? 0,
                            end: event.currentTarget.selectionEnd ?? 0,
                        })}
                        className="h-24 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Digite ou use tags como {produto} e {preco}"
                    />
                    <p className="text-[11px] text-slate-500">
                        Selecione um trecho e use <strong>Isolar selecao</strong> para editar so aquela parte.
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Ferramentas de quebra
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={handleIsolateSelection}
                            disabled={selectionRange.end <= selectionRange.start}
                            className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 disabled:opacity-50"
                        >
                            Isolar selecao
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSplit('words')}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                        >
                            Separar palavras
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSplit('letters')}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                        >
                            Separar letras
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Presets
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {MARKETING_TYPOGRAPHY_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => handlePreset(preset.id)}
                                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                                    activeField.presetId === preset.id
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Wand2 className="h-4 w-4 text-emerald-600" />
                                    <span className="text-sm font-black text-slate-900">{preset.label}</span>
                                </div>
                                <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">{preset.description}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {activeField.mode === 'advanced' && activeField.segments.length > 0 && (
                    <div className="space-y-2">
                        <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                            Segmentos editaveis
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {activeField.segments.map((segment) => (
                                <button
                                    key={segment.id}
                                    type="button"
                                    onClick={() => updateField(activeFieldKey, selectTypographySegment(activeField, segment.id))}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                                        segment.id === activeField.selectedSegmentId
                                            ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                                            : 'border-slate-200 bg-slate-50 text-slate-600'
                                    }`}
                                >
                                    {getSegmentLabel(segment.text)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2">
                        <Type className="h-4 w-4 text-slate-600" />
                        <p className="text-sm font-black text-slate-900">Amostra e controles finos</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">Fonte atual</p>
                        <p
                            className="mt-2 break-words text-2xl font-black leading-[0.95]"
                            style={{
                                color: activeStyle.color,
                                fontFamily: activeStyle.fontFamily,
                                fontStyle: activeStyle.italic ? 'italic' : 'normal',
                                letterSpacing: `${activeStyle.letterSpacing}em`,
                            }}
                        >
                            Aa Bb Cc 123
                        </p>
                        <p className="mt-2 text-xs font-medium text-slate-500">
                            {selectedSegment ? 'Editando o segmento selecionado.' : 'Editando o estilo base do campo.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {PANEL_TABS.map((panel) => (
                            <button
                                key={panel.id}
                                type="button"
                                onClick={() => setActivePanel(panel.id)}
                                className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                                    activePanel === panel.id
                                        ? 'bg-slate-900 text-white'
                                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                {panel.label}
                            </button>
                        ))}
                    </div>

                    {activePanel === 'style' ? (
                        <div className="space-y-3">
                            <label className="block">
                                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                                    Fonte aplicada
                                </span>
                                <select
                                    value={activeStyle.fontId}
                                    onChange={(event) => {
                                        const font = findMarketingTypographyFontOption(
                                            event.target.value,
                                            settings.typography.fonts,
                                        );
                                        if (!font) return;
                                        applyFontOption(font, font.source !== 'builtin');
                                    }}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    {allFontOptions.map((font) => (
                                        <option key={font.id} value={font.id}>
                                            {font.label} ({font.source})
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="grid grid-cols-2 gap-2">
                                {COLOR_FIELDS.map((colorField) => (
                                    <label
                                        key={colorField.key}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                                    >
                                        <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
                                            {colorField.label}
                                        </span>
                                        <input
                                            type="color"
                                            value={activeStyle[colorField.key]}
                                            onChange={(event) => handleStylePatch({
                                                [colorField.key]: event.target.value,
                                            } as Partial<MarketingTypographyStyle>)}
                                            className="h-8 w-10 rounded border border-slate-200 bg-white"
                                        />
                                    </label>
                                ))}
                            </div>

                            <div className="space-y-2">
                                {STYLE_SLIDERS.map((slider) => {
                                    const numericValue = Number(activeStyle[slider.key]);
                                    return (
                                        <label key={slider.key} className="block rounded-lg border border-slate-200 bg-white px-3 py-2">
                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
                                                    {slider.label}
                                                </span>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {slider.formatter ? slider.formatter(numericValue) : numericValue}
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min={slider.min}
                                                max={slider.max}
                                                step={slider.step}
                                                value={numericValue}
                                                onChange={(event) => handleStylePatch({
                                                    [slider.key]: Number(event.target.value),
                                                } as Partial<MarketingTypographyStyle>)}
                                                className="w-full accent-emerald-600"
                                            />
                                        </label>
                                    );
                                })}
                            </div>

                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={activeStyle.italic}
                                    onChange={(event) => handleStylePatch({ italic: event.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                Italico
                            </label>

                            <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                                Dica: fontes script e mais organicas costumam ficar melhores com <strong>tracking</strong> entre
                                <strong> -0.02 e 0.01</strong> e contorno menor.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                {allFontOptions.map((font) => (
                                    <button
                                        key={font.id}
                                        type="button"
                                        onClick={() => applyFontOption(font, font.source !== 'builtin')}
                                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                                            activeStyle.fontId === font.id
                                                ? 'border-emerald-500 bg-emerald-50'
                                                : 'border-slate-200 bg-white hover:bg-slate-50'
                                        }`}
                                    >
                                        <p className="text-sm font-black text-slate-900">{font.label}</p>
                                        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                                            {font.source}
                                        </p>
                                    </button>
                                ))}
                            </div>

                            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3">
                                <label className="flex cursor-pointer items-center justify-center gap-2 text-sm font-bold text-slate-700">
                                    <Upload className="h-4 w-4 text-emerald-600" />
                                    Enviar fonte .ttf/.otf
                                    <input
                                        type="file"
                                        accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                                        className="hidden"
                                        onChange={handleFontUpload}
                                    />
                                </label>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                                <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
                                    Google Font manual
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={googleFontName}
                                        onChange={(event) => setGoogleFontName(event.target.value)}
                                        placeholder="Ex: Oswald"
                                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleGoogleFontAdd}
                                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
