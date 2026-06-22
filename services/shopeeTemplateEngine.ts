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
        .replace(/\bCor\s*:\s*$/i, '')
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

function extractProductModelFromName(name: string): string {
    const normalized = String(name || '').trim();
    if (!normalized) return '';

    const match = normalized.match(/\b(?:para|compativel com|compatível com)\s+(.+?)(?:\s+cor\s*:|\s+cor\s+-|\s+-\s*cor\b|$)/i);
    if (match?.[1]) return match[1].trim().replace(/\s{2,}/g, ' ');

    const modelPatterns = [
        /\b(iphone\s+\d{1,2}(?:\s+pro)?(?:\s+max)?(?:\s+plus)?(?:\s+mini)?)\b/i,
        /\b(redmi\s+note\s+\d{1,2}(?:\s+\d+g)?(?:\s+pro)?(?:\s+plus)?)\b/i,
        /\b(redmi\s+\d{1,2}[a-z]?(?:\s+\d+g)?(?:\s+pro)?(?:\s+plus)?)\b/i,
        /\b(poco\s+[a-z0-9]+(?:\s+pro)?(?:\s+plus)?)\b/i,
        /\b(galaxy\s+[a-z]\d{1,2}(?:\s+plus|\s+ultra|\s+fe)?)\b/i,
    ];

    for (const pattern of modelPatterns) {
        const modelMatch = normalized.match(pattern);
        if (modelMatch?.[1]) return modelMatch[1].trim().replace(/\s{2,}/g, ' ');
    }

    return '';
}

function extractProductColorFromName(name: string): string {
    const normalized = String(name || '').trim();
    if (!normalized) return '';

    const match = normalized.match(/\bcor\s*:?\s*([^,\n\r;|]+)/i);
    return match?.[1]?.trim().replace(/\s{2,}/g, ' ') || '';
}

function resolveProductModel(product: Record<string, any>, productName: string): string {
    const directModel = String(product?.model || product?.model_name || '').trim();
    const extractedModel = extractProductModelFromName(productName);
    if (!directModel) return extractedModel;
    if (!extractedModel) return directModel;

    const normalizedDirect = normalizeText(directModel);
    const normalizedExtracted = normalizeText(extractedModel);
    if (normalizedExtracted.startsWith(normalizedDirect) && extractedModel.length > directModel.length) {
        return extractedModel;
    }

    return directModel;
}

function buildTemplateVariables(product: Record<string, any>): Record<string, string> {
    const priceCents = Number(product?.price_retail ?? product?.price ?? 0);
    const price = Number.isFinite(priceCents) && priceCents > 0
        ? (priceCents / 100).toFixed(2)
        : '';
    const productName = String(product?.name || '').trim();

    return {
        produto: productName,
        nome: productName,
        sku: String(product?.sku || '').trim(),
        marca: String(product?.brand || '').trim(),
        modelo: resolveProductModel(product, productName),
        cor: getProductSpec(product, ['color', 'cor']) || extractProductColorFromName(productName),
        ram: getProductSpec(product, ['ram']),
        armazenamento: getProductSpec(product, ['storage', 'armazenamento']),
        categoria: String(product?.category_slug || product?.category_name || product?.category || '').trim(),
        descricao: String(product?.description || '').trim(),
        preco: price,
        estoque: String(product?.stock_quantity ?? product?.stock ?? '').trim(),
        package_dimensions: resolvePackageDimensionsText(product),
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

function lastCategorySegment(value?: string | null): string {
    return String(value || '')
        .split('>')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .pop() || '';
}

function fallbackTemplateMatchScore(product: Record<string, any>, template: ShopeeTemplate): number {
    if (String(template.id || '') === 'universal_defaults') return 0;

    const productContext = [
        product?.name,
        product?.sku,
        product?.brand,
        product?.model,
        product?.model_name,
        product?.category_name,
        product?.category_slug,
        product?.category,
    ].map(normalizeText).filter(Boolean).join(' ');

    const candidates = [
        template.name,
        lastCategorySegment(template.shopeeCategoryName),
    ]
        .map(normalizeText)
        .filter((candidate) => candidate.length >= 4 && !['novo template', 'defaults universais', 'todas as categorias'].includes(candidate));

    return candidates.some((candidate) => productContext.includes(candidate)) ? 18 : 0;
}

function scoreTemplate(product: Record<string, any>, template: ShopeeTemplate): number {
    const explicitScore = scoreRule(product, template.rules || {});
    return explicitScore > 0 ? explicitScore : fallbackTemplateMatchScore(product, template);
}

export function resolveBestShopeeTemplate(product: Record<string, any>, templates: ShopeeTemplate[]): ShopeeTemplate | null {
    const ranked = (templates || [])
        .filter((template) => template.active)
        .map((template) => ({
            template,
            score: scoreTemplate(product, template),
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

function positiveDimension(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function readNestedDimension(product: Record<string, any>, keys: string[]): number {
    for (const key of keys) {
        const direct = positiveDimension(product?.[key]);
        if (direct > 0) return direct;
        const dimension = positiveDimension(product?.dimensions?.[key]);
        if (dimension > 0) return dimension;
        const spec = positiveDimension(product?.specs?.[key]);
        if (spec > 0) return spec;
    }
    return 0;
}

function resolvePackageDimensionsText(product: Record<string, any>): string {
    const length = readNestedDimension(product, ['package_length', 'shipping_length', 'depth_cm', 'depth', 'length_cm', 'length', 'comprimento', 'profundidade']);
    const width = readNestedDimension(product, ['package_width', 'shipping_width', 'width_cm', 'width', 'largura']);
    const height = readNestedDimension(product, ['package_height', 'shipping_height', 'height_cm', 'height', 'altura']);
    return length > 0 && width > 0 && height > 0 ? `${length} x ${width} x ${height} cm` : '';
}

export function renderShopeeAttributeDefaultValue(value: string | string[], product: Record<string, any>): string | string[] {
    if (Array.isArray(value)) return value.map((entry) => renderShopeeAttributeDefaultValue(entry, product) as string);
    return renderShopeeTemplateText(String(value || ''), product);
}

export function resolveUniversalShopeeAttributeDefaults(templates: ShopeeTemplate[]): Record<string, string | string[]> {
    const universal = (templates || []).find((template) => template.active && template.id === 'universal_defaults');
    return { ...(universal?.attributeDefaults || {}) };
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
