import type { ShopeeTemplate } from '../types/shopee-template';

function parseObject(value: unknown): Record<string, any> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }
    return {};
}

function parseArray(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function sanitizeDefaultTemplateAttributeDefaults(templateId: unknown, defaults: Record<string, any>): Record<string, any> {
    const id = String(templateId || '');
    if (id !== 'universal_defaults' && id !== 'power_supply') return defaults;

    const sanitized = { ...defaults };
    if (String(sanitized[101029] || sanitized['101029'] || '').trim().toLowerCase() === '1 piece') {
        delete sanitized[101029];
        delete sanitized['101029'];
    }
    return sanitized;
}

export function mapShopeeTemplateFromRow(row: any): ShopeeTemplate {
    const attributeDefaults = sanitizeDefaultTemplateAttributeDefaults(row.id, parseObject(row.attribute_defaults));

    return {
        id: row.id,
        name: row.name,
        active: Boolean(row.active),
        priority: Number(row.priority || 0),
        rules: parseObject(row.rules),
        titleTemplate: row.title_template || '',
        descriptionTemplate: row.description_template || '',
        shopeeCategoryId: row.shopee_category_id ?? null,
        shopeeCategoryName: row.shopee_category_name ?? null,
        attributeDefaults,
        priceMode: row.price_mode || 'product',
        fixedPrice: row.fixed_price ?? null,
        pricePercent: row.price_percent ?? null,
        stockMode: row.stock_mode || 'product',
        fixedStock: row.fixed_stock ?? null,
        dimensionMode: row.dimension_mode || 'product',
        weightKg: row.weight_kg ?? null,
        packageLength: row.package_length ?? null,
        packageWidth: row.package_width ?? null,
        packageHeight: row.package_height ?? null,
        gtinMode: row.gtin_mode || 'product',
        dangerousTerms: parseArray(row.dangerous_terms),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
