const DAY_MODE_MULTIPLIERS = {
    recentes: { isNew: 5, freshness: 4, discount: 1, views: 1, stock: 1 },
    mais_vendidos: { isNew: 1, freshness: 1, discount: 2, views: 4, stock: 2 },
    oportunidade: { isNew: 1, freshness: 1, discount: 4, views: 1, stock: 3 },
    visual: { isNew: 2, freshness: 2, discount: 1, views: 2, stock: 1 },
};

function getComparableTimestamp(product, nowIso) {
    return product.updated || product.updated_at || product.created || product.created_at || nowIso;
}

function normalizeHashtag(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '')
        .trim();
}

function hasRenderableImage(product) {
    return Array.isArray(product?.images) && product.images.some((image) => typeof image === 'string' && image.trim().length > 0);
}

export function scoreProduct(product, mode, cooldownIds, nowIso) {
    if (!product?.id) return Number.NEGATIVE_INFINITY;
    if (!hasRenderableImage(product)) return Number.NEGATIVE_INFINITY;
    if (cooldownIds.includes(product.id)) return Number.NEGATIVE_INFINITY;

    const weights = DAY_MODE_MULTIPLIERS[mode] || DAY_MODE_MULTIPLIERS.recentes;
    const now = new Date(nowIso).getTime();
    const updatedAt = new Date(getComparableTimestamp(product, nowIso)).getTime();
    const freshnessDays = Math.max(1, Math.ceil((now - updatedAt) / 86_400_000));
    const freshness = Math.max(0, 30 - freshnessDays);

    return (
        (product.is_new ? 10 : 0) * weights.isNew +
        freshness * weights.freshness +
        Number(product.discount_percentage || 0) * weights.discount +
        Math.min(Number(product.views_count || 0), 100) * weights.views +
        Math.min(Number(product.stock_quantity || 0), 20) * weights.stock
    );
}

export function pickEditorialCandidates({
    products,
    dayRule,
    manualPicks = [],
    cooldownProductIds = [],
    nowIso,
}) {
    const validProducts = Array.isArray(products) ? products.filter(Boolean) : [];
    const byId = new Map(validProducts.map((product) => [product.id, product]));
    const manualOrdered = [...manualPicks]
        .sort((left, right) => left.priority - right.priority)
        .map((pick) => byId.get(pick.productId))
        .filter(Boolean);

    const autoOrdered = [...validProducts]
        .filter((product) => !dayRule?.categoryId || product.category_id === dayRule.categoryId)
        .filter((product) => !manualOrdered.some((picked) => picked.id === product.id))
        .map((product) => ({
            product,
            score: scoreProduct(product, dayRule?.mode, cooldownProductIds, nowIso),
        }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.product);

    const ordered = [...manualOrdered, ...autoOrdered];
    if (!ordered.length) {
        return { primary: null, reserves: [] };
    }

    return {
        primary: ordered[0] || null,
        reserves: ordered.slice(1, 3),
    };
}

export function buildTelegramDraft({
    categoryLabel,
    dayTheme,
    selection,
    company,
    primaryFormat = 'sticker',
    cta = '',
    generatedCopy = '',
}) {
    const primary = selection?.primary || null;
    const reserves = Array.isArray(selection?.reserves) ? selection.reserves : [];
    const primaryName = primary?.name || 'Nenhum item selecionado';
    const reserveText = reserves.length
        ? `Reservas: ${reserves.map((item) => item.name).join(' | ')}`
        : 'Reservas: nenhuma';
    const formattedCta = cta?.trim() || 'Chame no WhatsApp para receber atendimento agora.';
    const whatsapp = company?.whatsapp || '';
    const instagram = company?.instagram || 'mercadodovale';
    const brandTag = normalizeHashtag(primary?.brand || categoryLabel || 'Mercado do Vale');
    const productTag = normalizeHashtag(primary?.name || 'Oferta');
    const hashtags = [brandTag, productTag, 'MercadoDoVale', 'Ofertas'].filter(Boolean).map((tag) => `#${tag}`).join(' ');
    const caption = generatedCopy?.trim() || `${primaryName}\n\n${formattedCta}\n\n${hashtags}`;
    const shortCaption = primary
        ? `${primary.name} em foco hoje. ${formattedCta}`
        : `Selecione um item para montar o kit. ${formattedCta}`;
    const formatLabel = primaryFormat === 'status' ? 'Story' : primaryFormat === 'sticker' ? 'Figurinha' : 'Feed';

    return {
        summary: `[${categoryLabel}] ${dayTheme}\nPrincipal: ${primaryName}\nFormato sugerido: ${formatLabel}`,
        caption,
        shortCaption,
        cta: formattedCta,
        hashtags,
        instructions: `Postar o principal primeiro, manter reservas prontas, conferir disponibilidade antes de publicar, usar WhatsApp ${whatsapp} e Instagram @${instagram}. ${reserveText}`,
    };
}
