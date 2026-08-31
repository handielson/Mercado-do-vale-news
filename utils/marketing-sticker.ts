import {
    createDefaultStickerTypographySettings,
    type MarketingStickerTypographySettings,
    sanitizeStickerTypographySettings,
} from './marketing-typography';

export type MarketingAssetFormat = 'feed' | 'status' | 'sticker' | 'blueprint';
export type MarketingStickerExportMode = 'png' | 'webp';
export type MarketingStickerExportExtension = 'png' | 'webp';

export type MarketingStickerLayout = 'produto-preco' | 'selo' | 'texto-livre' | 'produto';
export type MarketingStickerShape = 'blob' | 'circulo' | 'retangulo' | 'sem-forma';

export interface MarketingStickerSettings {
    stickerName: string;
    kickerText: string;
    mainText: string;
    footerText: string;
    priceText: string;
    backgroundColor: string;
    accentColor: string;
    textColor: string;
    priceColor: string;
    outlineColor: string;
    layout: MarketingStickerLayout;
    shape: MarketingStickerShape;
    showKicker: boolean;
    showProduct: boolean;
    showPrice: boolean;
    showFooter: boolean;
    showLogo: boolean;
    showOutline: boolean;
    typography: MarketingStickerTypographySettings;
}

export interface MarketingStickerTokenValues {
    name?: string | null;
    brand?: string | null;
    priceLabel?: string | null;
    sku?: string | null;
    color?: string | null;
    category?: string | null;
}

export const DEFAULT_MARKETING_STICKER_SETTINGS: MarketingStickerSettings = {
    stickerName: 'Figurinha Mercado do Vale',
    kickerText: 'Mercado do Vale',
    mainText: '{produto}',
    footerText: 'Chama no WhatsApp',
    priceText: '{preco}',
    backgroundColor: 'transparent',
    accentColor: '#16a34a',
    textColor: '#111827',
    priceColor: '#ffffff',
    outlineColor: '#ffffff',
    layout: 'produto-preco',
    shape: 'blob',
    showKicker: true,
    showProduct: true,
    showPrice: true,
    showFooter: true,
    showLogo: true,
    showOutline: true,
    typography: createDefaultStickerTypographySettings({
        kickerText: 'Mercado do Vale',
        mainText: '{produto}',
        priceText: '{preco}',
        footerText: 'Chama no WhatsApp',
    }),
};

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const normalizeHexColor = (value: string, fallback: string): string => {
    const trimmed = value.trim();
    if (trimmed === 'transparent') return trimmed;
    if (!HEX_COLOR_PATTERN.test(trimmed)) return fallback;

    const raw = trimmed.slice(1);
    if (raw.length === 3) {
        return `#${raw.split('').map((part) => `${part}${part}`).join('')}`.toLowerCase();
    }

    return `#${raw}`.toLowerCase();
};

export const sanitizeMarketingStickerSettings = (
    settings: MarketingStickerSettings,
): MarketingStickerSettings => ({
    ...settings,
    stickerName: settings.stickerName.trim() || DEFAULT_MARKETING_STICKER_SETTINGS.stickerName,
    kickerText: settings.kickerText,
    mainText: settings.mainText,
    footerText: settings.footerText,
    priceText: settings.priceText,
    backgroundColor: normalizeHexColor(settings.backgroundColor, 'transparent'),
    accentColor: normalizeHexColor(settings.accentColor, DEFAULT_MARKETING_STICKER_SETTINGS.accentColor),
    textColor: normalizeHexColor(settings.textColor, DEFAULT_MARKETING_STICKER_SETTINGS.textColor),
    priceColor: normalizeHexColor(settings.priceColor, DEFAULT_MARKETING_STICKER_SETTINGS.priceColor),
    outlineColor: normalizeHexColor(settings.outlineColor, DEFAULT_MARKETING_STICKER_SETTINGS.outlineColor),
    showKicker: settings.showKicker ?? DEFAULT_MARKETING_STICKER_SETTINGS.showKicker,
    showProduct: settings.showProduct ?? DEFAULT_MARKETING_STICKER_SETTINGS.showProduct,
    showPrice: settings.showPrice ?? DEFAULT_MARKETING_STICKER_SETTINGS.showPrice,
    showFooter: settings.showFooter ?? DEFAULT_MARKETING_STICKER_SETTINGS.showFooter,
    showLogo: settings.showLogo ?? DEFAULT_MARKETING_STICKER_SETTINGS.showLogo,
    showOutline: settings.showOutline ?? DEFAULT_MARKETING_STICKER_SETTINGS.showOutline,
    typography: sanitizeStickerTypographySettings(settings.typography, {
        kickerText: settings.kickerText,
        mainText: settings.mainText,
        priceText: settings.priceText,
        footerText: settings.footerText,
    }),
});

export const resolveMarketingStickerText = (
    template: string,
    values: MarketingStickerTokenValues,
): string => {
    const replacements: Record<string, string> = {
        produto: values.name ?? '',
        marca: values.brand ?? '',
        preco: values.priceLabel ?? '',
        sku: values.sku ?? '',
        cor: values.color ?? '',
        categoria: values.category ?? '',
    };

    return template.replace(/\{(produto|marca|preco|sku|cor|categoria)\}/g, (_, token: string) => {
        return replacements[token] ?? '';
    });
};

export const buildMarketingStickerDownloadName = (
    stickerName: string,
    extension: MarketingStickerExportExtension,
): string => {
    const safeName = stickerName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

    return `figurinha-${safeName || 'marketing'}.${extension}`;
};

export const getMarketingStickerExportTargets = (
    mode: MarketingStickerExportMode,
    stickerName: string,
): Array<{ extension: MarketingStickerExportExtension; filename: string }> => {
    return [{
        extension: mode,
        filename: buildMarketingStickerDownloadName(stickerName, mode),
    }];
};

export const getMarketingCanvasSize = (
    format: MarketingAssetFormat,
): { width: number; height: number } => {
    if (format === 'sticker') {
        return { width: 512, height: 512 };
    }

    if (format === 'blueprint') {
        return { width: 1536, height: 1024 };
    }

    return {
        width: 1080,
        height: format === 'feed' ? 1080 : 1920,
    };
};
