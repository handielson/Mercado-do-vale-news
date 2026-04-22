export type MarketingTypographyFieldKey = 'kicker' | 'main' | 'price' | 'footer';
export type MarketingTypographyMode = 'simple' | 'advanced';
export type MarketingTypographySplitMode = 'words' | 'letters';
export type MarketingFontSource = 'builtin' | 'upload' | 'google';
export type MarketingTypographyPresetId = 'impact-3d' | 'sunset-pop' | 'rainbow-pop' | 'neon-night';

export interface MarketingTypographyFontOption {
    id: string;
    label: string;
    family: string;
    source: MarketingFontSource;
    cssUrl?: string;
    fileDataUrl?: string;
}

export interface MarketingTypographyStyle {
    fontId: string;
    fontFamily: string;
    color: string;
    outlineColor: string;
    outlineWidth: number;
    depth: number;
    depthColor: string;
    shadowColor: string;
    shadowBlur: number;
    letterSpacing: number;
    italic: boolean;
}

export interface MarketingTypographySegment {
    id: string;
    text: string;
    style: MarketingTypographyStyle;
}

export interface MarketingTypographyField {
    mode: MarketingTypographyMode;
    text: string;
    presetId: MarketingTypographyPresetId;
    simpleStyle: MarketingTypographyStyle;
    segments: MarketingTypographySegment[];
    selectedSegmentId: string | null;
}

export interface MarketingStickerTypographySettings {
    fonts: MarketingTypographyFontOption[];
    fields: Record<MarketingTypographyFieldKey, MarketingTypographyField>;
}

interface StickerTypographyDefaultsInput {
    kickerText: string;
    mainText: string;
    priceText: string;
    footerText: string;
}

const sanitizeFontToken = (value: string): string => (
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
);

const createCssFamily = (fontName: string): string => `"${fontName}", sans-serif`;

const createGoogleCssUrl = (fontName: string): string => {
    const familyQuery = fontName.trim().split(/\s+/).filter(Boolean).join('+');
    return `https://fonts.googleapis.com/css2?family=${familyQuery}:wght@400;700;900&display=swap`;
};

const typographySegmentId = (prefix: string, index: number): string => `${prefix}-${index}`;

const createCatalogFont = (
    id: string,
    label: string,
    source: MarketingFontSource = 'google',
): MarketingTypographyFontOption => ({
    id,
    label,
    family: createCssFamily(label),
    source,
    cssUrl: createGoogleCssUrl(label),
});

export const BUILTIN_MARKETING_FONTS: MarketingTypographyFontOption[] = [
    createCatalogFont('anton', 'Anton', 'builtin'),
    createCatalogFont('archivo-black', 'Archivo Black', 'builtin'),
    createCatalogFont('fugaz-one', 'Fugaz One', 'builtin'),
    createCatalogFont('lilita-one', 'Lilita One', 'builtin'),
    createCatalogFont('paytone-one', 'Paytone One', 'builtin'),
];

export const ONLINE_MARKETING_FONT_CATALOG: MarketingTypographyFontOption[] = [
    createCatalogFont('bebas-neue', 'Bebas Neue'),
    createCatalogFont('bungee', 'Bungee'),
    createCatalogFont('baloo-2', 'Baloo 2'),
    createCatalogFont('pacifico', 'Pacifico'),
    createCatalogFont('lobster', 'Lobster'),
    createCatalogFont('chewy', 'Chewy'),
];

export const findMarketingTypographyFontOption = (
    fontId: string,
    dynamicFonts: MarketingTypographyFontOption[] = [],
): MarketingTypographyFontOption | undefined => (
    [...BUILTIN_MARKETING_FONTS, ...dynamicFonts, ...ONLINE_MARKETING_FONT_CATALOG]
        .find((font) => font.id === fontId)
);

const TYPOGRAPHY_PRESET_STYLES: Record<MarketingTypographyPresetId, Partial<MarketingTypographyStyle>> = {
    'impact-3d': {
        fontId: 'fugaz-one',
        fontFamily: createCssFamily('Fugaz One'),
        color: '#fff8db',
        outlineColor: '#0f172a',
        outlineWidth: 2,
        depth: 9,
        depthColor: '#166534',
        shadowColor: '#0f172a',
        shadowBlur: 16,
        letterSpacing: 0.01,
        italic: false,
    },
    'sunset-pop': {
        fontId: 'paytone-one',
        fontFamily: createCssFamily('Paytone One'),
        color: '#fff4d6',
        outlineColor: '#9a3412',
        outlineWidth: 2,
        depth: 7,
        depthColor: '#ea580c',
        shadowColor: '#9a3412',
        shadowBlur: 12,
        letterSpacing: 0.01,
        italic: false,
    },
    'rainbow-pop': {
        fontId: 'lobster',
        fontFamily: createCssFamily('Lobster'),
        color: '#ffffff',
        outlineColor: '#1e293b',
        outlineWidth: 2,
        depth: 8,
        depthColor: '#ec4899',
        shadowColor: '#7c3aed',
        shadowBlur: 16,
        letterSpacing: -0.01,
        italic: false,
    },
    'neon-night': {
        fontId: 'lilita-one',
        fontFamily: createCssFamily('Lilita One'),
        color: '#e0f2fe',
        outlineColor: '#082f49',
        outlineWidth: 2,
        depth: 5,
        depthColor: '#0ea5e9',
        shadowColor: '#0f172a',
        shadowBlur: 18,
        letterSpacing: 0,
        italic: false,
    },
};

export const MARKETING_TYPOGRAPHY_PRESETS: Array<{
    id: MarketingTypographyPresetId;
    label: string;
    description: string;
}> = [
    { id: 'impact-3d', label: '3D realista', description: 'frente clara e profundidade organica' },
    { id: 'sunset-pop', label: 'Sunset pop', description: 'quente para preco e CTA' },
    { id: 'rainbow-pop', label: 'Script pop', description: 'curvas marcantes para titulo hero' },
    { id: 'neon-night', label: 'Neon', description: 'frio e luminoso' },
];

export const createTypographyStyle = (
    overrides: Partial<MarketingTypographyStyle> = {},
): MarketingTypographyStyle => ({
    fontId: overrides.fontId ?? 'fugaz-one',
    fontFamily: overrides.fontFamily ?? createCssFamily('Fugaz One'),
    color: overrides.color ?? '#111827',
    outlineColor: overrides.outlineColor ?? '#ffffff',
    outlineWidth: overrides.outlineWidth ?? 3,
    depth: overrides.depth ?? 0,
    depthColor: overrides.depthColor ?? '#ec4899',
    shadowColor: overrides.shadowColor ?? '#0f172a',
    shadowBlur: overrides.shadowBlur ?? 8,
    letterSpacing: overrides.letterSpacing ?? 0.01,
    italic: overrides.italic ?? false,
});

const createSegmentsFromParts = (
    parts: string[],
    style: MarketingTypographyStyle,
    prefix: string,
): MarketingTypographySegment[] => (
    parts
        .filter((segment) => segment.length > 0)
        .map((segment, index) => ({
            id: typographySegmentId(prefix, index),
            text: segment,
            style: createTypographyStyle(style),
        }))
);

export const createTypographyField = (
    text: string,
    options: Partial<MarketingTypographyField> = {},
): MarketingTypographyField => {
    const presetId = options.presetId ?? 'impact-3d';
    const presetStyle = createTypographyStyle(TYPOGRAPHY_PRESET_STYLES[presetId]);
    const simpleStyle = createTypographyStyle({
        ...presetStyle,
        ...options.simpleStyle,
    });

    return {
        mode: options.mode ?? 'simple',
        text,
        presetId,
        simpleStyle,
        segments: (options.segments ?? []).map((segment) => ({
            ...segment,
            style: createTypographyStyle(segment.style),
        })),
        selectedSegmentId: options.selectedSegmentId ?? null,
    };
};

export const joinTypographySegments = (segments: MarketingTypographySegment[]): string => (
    segments.map((segment) => segment.text).join('')
);

export const splitTypographyField = (
    field: MarketingTypographyField,
    mode: MarketingTypographySplitMode,
): MarketingTypographyField => {
    const parts = mode === 'letters'
        ? field.text.split('')
        : field.text.match(/\S+\s*|\s+/g) ?? [field.text];
    const segments = createSegmentsFromParts(parts, field.simpleStyle, `segment-${mode}`);

    return {
        ...field,
        mode: 'advanced',
        segments,
        selectedSegmentId: segments[0]?.id ?? null,
    };
};

export const isolateTypographySelection = (
    field: MarketingTypographyField,
    selectionStart: number,
    selectionEnd: number,
): MarketingTypographyField => {
    const start = Math.max(0, Math.min(selectionStart, field.text.length));
    const end = Math.max(start, Math.min(selectionEnd, field.text.length));

    const before = field.text.slice(0, start);
    const selected = field.text.slice(start, end);
    const after = field.text.slice(end);

    const segments = createSegmentsFromParts(
        [before, selected || field.text, after],
        field.simpleStyle,
        'selection',
    );

    return {
        ...field,
        mode: 'advanced',
        segments,
        selectedSegmentId: segments[Math.min(before.length > 0 ? 1 : 0, segments.length - 1)]?.id ?? null,
    };
};

export const applyTypographyPreset = (
    field: MarketingTypographyField,
    presetId: MarketingTypographyPresetId,
): MarketingTypographyField => {
    const presetStyle = createTypographyStyle(TYPOGRAPHY_PRESET_STYLES[presetId]);
    const selectedSegmentId = field.selectedSegmentId;

    return {
        ...field,
        presetId,
        simpleStyle: presetStyle,
        segments: field.segments.map((segment) => (
            !selectedSegmentId || segment.id === selectedSegmentId
                ? { ...segment, style: createTypographyStyle(presetStyle) }
                : segment
        )),
    };
};

export const updateTypographyFieldText = (
    field: MarketingTypographyField,
    text: string,
): MarketingTypographyField => {
    if (field.mode === 'advanced') {
        const preservedStyle = field.segments.find((segment) => segment.id === field.selectedSegmentId)?.style
            ?? field.simpleStyle;
        const segments = text.length > 0
            ? createSegmentsFromParts([text], preservedStyle, 'manual')
            : [];

        return {
            ...field,
            text,
            segments,
            selectedSegmentId: segments[0]?.id ?? null,
        };
    }

    return {
        ...field,
        text,
    };
};

export const updateSelectedTypographySegmentStyle = (
    field: MarketingTypographyField,
    patch: Partial<MarketingTypographyStyle>,
): MarketingTypographyField => {
    if (field.mode !== 'advanced' || !field.selectedSegmentId) {
        return {
            ...field,
            simpleStyle: createTypographyStyle({
                ...field.simpleStyle,
                ...patch,
            }),
        };
    }

    const segments = field.segments.map((segment) => (
        segment.id === field.selectedSegmentId
            ? {
                ...segment,
                style: createTypographyStyle({
                    ...segment.style,
                    ...patch,
                }),
            }
            : segment
    ));

    return {
        ...field,
        segments,
    };
};

export const selectTypographySegment = (
    field: MarketingTypographyField,
    segmentId: string | null,
): MarketingTypographyField => ({
    ...field,
    selectedSegmentId: segmentId,
});

export const upsertTypographyFontOption = (
    fonts: MarketingTypographyFontOption[],
    nextFont: MarketingTypographyFontOption,
): MarketingTypographyFontOption[] => {
    const existingIndex = fonts.findIndex((font) => font.id === nextFont.id);
    if (existingIndex === -1) {
        return [...fonts, nextFont];
    }

    return fonts.map((font, index) => index === existingIndex ? nextFont : font);
};

export const buildGoogleFontOption = (fontName: string): MarketingTypographyFontOption => {
    const trimmed = fontName.trim();
    const safeName = trimmed || 'Google Font';
    return {
        id: `google-${sanitizeFontToken(safeName)}`,
        label: safeName,
        family: createCssFamily(safeName),
        source: 'google',
        cssUrl: createGoogleCssUrl(safeName),
    };
};

export const buildUploadedFontOption = (
    fontName: string,
    fileDataUrl: string,
): MarketingTypographyFontOption => {
    const safeName = fontName.trim() || 'Fonte enviada';
    return {
        id: `upload-${sanitizeFontToken(safeName)}`,
        label: safeName,
        family: createCssFamily(safeName),
        source: 'upload',
        fileDataUrl,
    };
};

export const createDefaultStickerTypographySettings = (
    input: StickerTypographyDefaultsInput,
): MarketingStickerTypographySettings => ({
    fonts: [],
    fields: {
        kicker: createTypographyField(input.kickerText, {
            presetId: 'neon-night',
            simpleStyle: createTypographyStyle(TYPOGRAPHY_PRESET_STYLES['neon-night']),
        }),
        main: createTypographyField(input.mainText, {
            presetId: 'impact-3d',
            simpleStyle: createTypographyStyle(TYPOGRAPHY_PRESET_STYLES['impact-3d']),
        }),
        price: createTypographyField(input.priceText, {
            presetId: 'sunset-pop',
            simpleStyle: createTypographyStyle(TYPOGRAPHY_PRESET_STYLES['sunset-pop']),
        }),
        footer: createTypographyField(input.footerText, {
            presetId: 'rainbow-pop',
            simpleStyle: createTypographyStyle(TYPOGRAPHY_PRESET_STYLES['rainbow-pop']),
        }),
    },
});

export const sanitizeStickerTypographySettings = (
    value: Partial<MarketingStickerTypographySettings> | undefined,
    input: StickerTypographyDefaultsInput,
): MarketingStickerTypographySettings => {
    const fallback = createDefaultStickerTypographySettings(input);
    const fields = value?.fields ?? {};

    return {
        fonts: Array.isArray(value?.fonts) ? value!.fonts.filter(Boolean) : [],
        fields: {
            kicker: createTypographyField(
                fields.kicker?.text ?? input.kickerText,
                {
                    ...fallback.fields.kicker,
                    ...fields.kicker,
                    simpleStyle: createTypographyStyle({
                        ...fallback.fields.kicker.simpleStyle,
                        ...fields.kicker?.simpleStyle,
                    }),
                },
            ),
            main: createTypographyField(
                fields.main?.text ?? input.mainText,
                {
                    ...fallback.fields.main,
                    ...fields.main,
                    simpleStyle: createTypographyStyle({
                        ...fallback.fields.main.simpleStyle,
                        ...fields.main?.simpleStyle,
                    }),
                },
            ),
            price: createTypographyField(
                fields.price?.text ?? input.priceText,
                {
                    ...fallback.fields.price,
                    ...fields.price,
                    simpleStyle: createTypographyStyle({
                        ...fallback.fields.price.simpleStyle,
                        ...fields.price?.simpleStyle,
                    }),
                },
            ),
            footer: createTypographyField(
                fields.footer?.text ?? input.footerText,
                {
                    ...fallback.fields.footer,
                    ...fields.footer,
                    simpleStyle: createTypographyStyle({
                        ...fallback.fields.footer.simpleStyle,
                        ...fields.footer?.simpleStyle,
                    }),
                },
            ),
        },
    };
};
