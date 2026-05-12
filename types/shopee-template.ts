export type ShopeeTemplatePriceMode = 'product' | 'fixed' | 'percent';
export type ShopeeTemplateStockMode = 'product' | 'fixed';
export type ShopeeTemplateDimensionMode = 'product' | 'fixed';
export type ShopeeTemplateGtinMode = 'product' | 'no_gtin' | 'blank';
export type ShopeeDangerLevel = 'warning' | 'block';

export interface ShopeeTemplateRule {
    categoryId?: string;
    nameIncludes?: string[];
    skuIncludes?: string[];
    brandIncludes?: string[];
    modelIncludes?: string[];
}

export interface ShopeeDangerousTermRule {
    id: string;
    term: string;
    replacement?: string;
    level: ShopeeDangerLevel;
    note?: string;
    active: boolean;
}

export interface ShopeeTemplate {
    id: string;
    name: string;
    active: boolean;
    priority: number;
    rules: ShopeeTemplateRule;
    titleTemplate: string;
    descriptionTemplate: string;
    shopeeCategoryId?: number | null;
    shopeeCategoryName?: string | null;
    attributeDefaults: Record<string, string | string[]>;
    priceMode: ShopeeTemplatePriceMode;
    fixedPrice?: number | null;
    pricePercent?: number | null;
    stockMode: ShopeeTemplateStockMode;
    fixedStock?: number | null;
    dimensionMode: ShopeeTemplateDimensionMode;
    weightKg?: number | null;
    packageLength?: number | null;
    packageWidth?: number | null;
    packageHeight?: number | null;
    gtinMode: ShopeeTemplateGtinMode;
    dangerousTerms: ShopeeDangerousTermRule[];
    createdAt?: string;
    updatedAt?: string;
}

export interface ShopeeTemplateInput extends Omit<ShopeeTemplate, 'id' | 'createdAt' | 'updatedAt'> {
    id?: string;
}

export interface ShopeeTitleSafetyMatch {
    rule: ShopeeDangerousTermRule;
    matchedText: string;
}

export interface ShopeeTitleSafetyResult {
    originalTitle: string;
    suggestedTitle: string;
    matches: ShopeeTitleSafetyMatch[];
    hasWarnings: boolean;
    hasBlocks: boolean;
}

export interface ShopeeTemplateApplyResult {
    templateId: string;
    title: string;
    description: string;
    categoryId?: number | null;
    categoryName?: string | null;
    attributeValues: Record<string, string | string[]>;
    price?: number | null;
    stock?: number | null;
    weightKg?: number | null;
    packageLength?: number | null;
    packageWidth?: number | null;
    packageHeight?: number | null;
    gtinMode: ShopeeTemplateGtinMode;
    dangerousTerms: ShopeeDangerousTermRule[];
}
