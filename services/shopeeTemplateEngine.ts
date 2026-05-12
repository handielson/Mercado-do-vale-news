import type {
    ShopeeDangerousTermRule,
    ShopeeTemplate,
    ShopeeTemplateApplyResult,
    ShopeeTemplateRule,
    ShopeeTitleSafetyResult,
} from '../types/shopee-template';

function normalizeText(value: unknown): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function cleanRenderedText(value: string): string {
    return value
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s+([,.;:!?])/g, '$1')
        .trim();
}

function getProductSpec(product: Record<string, any>, keys: string[]): string {
    for (const key of keys) {
        const direct = product?.[key];
        if (direct !== undefined && direct !== null && String(direct).trim()) return String(direct).trim();

        const spec = product?.specs?.[key];
        if (spec !== undefined && spec !== null && String(spec).trim()) return String(spec).trim();
    }

    return '';
}

function buildTemplateVariables(product: Record<string, any>): Record<string, string> {
    const priceCents = Number(product?.price_retail ?? product?.price ?? 0);
    const price = Number.isFinite(priceCents) && priceCents > 0
        ? (priceCents / 100).toFixed(2)
        : '';

    return {
        produto: String(product?.name || '').trim(),
        nome: String(product?.name || '').trim(),
        sku: String(product?.sku || '').trim(),
        marca: String(product?.brand || '').trim(),
        modelo: String(product?.model || product?.model_name || '').trim(),
        cor: getProductSpec(product, ['color', 'cor']),
        ram: getProductSpec(product, ['ram']),
        armazenamento: getProductSpec(product, ['storage', 'armazenamento']),
        categoria: String(product?.category_slug || product?.category_name || product?.category || '').trim(),
        descricao: String(product?.description || '').trim(),
        preco: price,
        estoque: String(product?.stock_quantity ?? product?.stock ?? '').trim(),
    };
}

export function renderShopeeTemplateText(template: string, product: Record<string, any>): string {
    const variables = buildTemplateVariables(product);
    const rendered = String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, rawKey) => {
        const key = String(rawKey || '').toLowerCase();
        return variables[key] ?? '';
    });

    return cleanRenderedText(rendered);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceInsensitive(text: string, term: string, replacement: string): string {
    if (!term.trim()) return text;
    return text.replace(new RegExp(escapeRegExp(term), 'gi'), replacement);
}

export function analyzeShopeeTitleSafety(title: string, rules: ShopeeDangerousTermRule[]): ShopeeTitleSafetyResult {
    const activeRules = (rules || []).filter((rule) => rule.active && rule.term.trim());
    let suggestedTitle = String(title || '');
    const matches = [];

    for (const rule of activeRules) {
        const pattern = new RegExp(escapeRegExp(rule.term), 'i');
        const match = suggestedTitle.match(pattern) || String(title || '').match(pattern);
        if (!match) continue;

        matches.push({ rule, matchedText: match[0] });

        if (rule.replacement !== undefined) {
            suggestedTitle = replaceInsensitive(suggestedTitle, rule.term, rule.replacement || '');
        }
    }

    suggestedTitle = cleanRenderedText(suggestedTitle);

    return {
        originalTitle: String(title || ''),
        suggestedTitle,
        matches,
        hasWarnings: matches.some((match) => match.rule.level === 'warning'),
        hasBlocks: matches.some((match) => match.rule.level === 'block'),
    };
}

function includesAny(source: string, candidates?: string[]): boolean {
    const normalizedSource = normalizeText(source);
    return (candidates || [])
        .map(normalizeText)
        .filter(Boolean)
        .some((candidate) => normalizedSource.includes(candidate));
}

function scoreRule(product: Record<string, any>, rule: ShopeeTemplateRule): number {
    let score = 0;

    if (rule.categoryId && String(product?.category_id || '') === String(rule.categoryId)) score += 30;
    if (includesAny(product?.name, rule.nameIncludes)) score += 20;
    if (includesAny(product?.sku, rule.skuIncludes)) score += 15;
    if (includesAny(product?.brand, rule.brandIncludes)) score += 10;
    if (includesAny(product?.model || product?.model_name, rule.modelIncludes)) score += 10;

    return score;
}

export function resolveBestShopeeTemplate(product: Record<string, any>, templates: ShopeeTemplate[]): ShopeeTemplate | null {
    const ranked = (templates || [])
        .filter((template) => template.active)
        .map((template) => ({
            template,
            score: scoreRule(product, template.rules || {}),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || b.template.priority - a.template.priority || a.template.name.localeCompare(b.template.name));

    return ranked[0]?.template || null;
}

function resolveTemplatePrice(product: Record<string, any>, template: ShopeeTemplate): number | null {
    const productPrice = Number(product?.price_retail ?? 0) / 100;
    if (template.priceMode === 'fixed') return Number(template.fixedPrice ?? 0) || null;
    if (template.priceMode === 'percent') {
        const percent = Number(template.pricePercent ?? 100);
        return Number.isFinite(productPrice) && productPrice > 0 ? Number((productPrice * (percent / 100)).toFixed(2)) : null;
    }

    return Number.isFinite(productPrice) && productPrice > 0 ? Number(productPrice.toFixed(2)) : null;
}

function resolveTemplateStock(product: Record<string, any>, template: ShopeeTemplate): number | null {
    if (template.stockMode === 'fixed') return Math.max(0, Math.trunc(Number(template.fixedStock ?? 0) || 0));
    const stock = Number(product?.stock_quantity ?? product?.stock ?? 0);
    return Number.isFinite(stock) ? Math.max(0, Math.trunc(stock)) : null;
}

export function applyShopeeTemplateToProduct(product: Record<string, any>, template: ShopeeTemplate): ShopeeTemplateApplyResult {
    const title = renderShopeeTemplateText(template.titleTemplate || product?.name || '', product);
    const description = String(product?.description || '').trim()
        || renderShopeeTemplateText(template.descriptionTemplate || '', product);

    return {
        templateId: template.id,
        title,
        description,
        categoryId: template.shopeeCategoryId,
        categoryName: template.shopeeCategoryName,
        attributeValues: { ...(template.attributeDefaults || {}) },
        price: resolveTemplatePrice(product, template),
        stock: resolveTemplateStock(product, template),
        weightKg: template.dimensionMode === 'fixed' ? template.weightKg ?? null : null,
        packageLength: template.dimensionMode === 'fixed' ? template.packageLength ?? null : null,
        packageWidth: template.dimensionMode === 'fixed' ? template.packageWidth ?? null : null,
        packageHeight: template.dimensionMode === 'fixed' ? template.packageHeight ?? null : null,
        gtinMode: template.gtinMode,
        dangerousTerms: template.dangerousTerms || [],
    };
}
