import type { MarketingAssetFormat } from '../../../../utils/marketing-sticker';

export type MarketingDayMode = 'recentes' | 'mais_vendidos' | 'oportunidade' | 'visual';

export interface MarketingDayRule {
    mode: MarketingDayMode;
    label: string;
    categoryId: string;
}

export interface MarketingCategoryProfile {
    categoryId: string;
    cooldownDays: number;
    preferredFormats: MarketingAssetFormat[];
    tone: string;
    defaultCta: string;
}

export interface MarketingManualPick {
    productId: string;
    priority: number;
}

export type MarketingManualPickMap = Record<string, MarketingManualPick[]>;
export type MarketingCategoryProfileMap = Record<string, MarketingCategoryProfile>;
export type MarketingCooldownCache = Record<string, string>;

export const DAY_MODE_OPTIONS: Array<{ value: MarketingDayMode; label: string }> = [
    { value: 'recentes', label: 'Recentes' },
    { value: 'mais_vendidos', label: 'Mais vendidos' },
    { value: 'oportunidade', label: 'Oportunidade' },
    { value: 'visual', label: 'Visual forte' },
];

export const DEFAULT_DAY_RULES: Record<number, MarketingDayRule> = {
    0: { mode: 'visual', label: 'Domingo leve', categoryId: '' },
    1: { mode: 'recentes', label: 'Segunda de novidades', categoryId: '' },
    2: { mode: 'mais_vendidos', label: 'Terca de destaque', categoryId: '' },
    3: { mode: 'oportunidade', label: 'Quarta de oportunidade', categoryId: '' },
    4: { mode: 'visual', label: 'Quinta visual', categoryId: '' },
    5: { mode: 'oportunidade', label: 'Sexta de conversao', categoryId: '' },
    6: { mode: 'visual', label: 'Sabado vitrine', categoryId: '' },
};

export const DEFAULT_CATEGORY_PROFILE: MarketingCategoryProfile = {
    categoryId: '',
    cooldownDays: 7,
    preferredFormats: ['feed', 'status', 'sticker'],
    tone: 'Oferta direta com leitura rapida',
    defaultCta: 'Chame no WhatsApp para fechar agora.',
};

export const DAY_LABELS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
export const DAY_LABELS_FULL = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
