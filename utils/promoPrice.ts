import type { Product } from '../types/product';

export function normalizeCentValue(value: unknown): number {
    const numeric = typeof value === 'number'
        ? value
        : Number(String(value ?? 0).replace(',', '.'));

    if (!Number.isFinite(numeric)) return 0;
    return Math.round(numeric);
}

/**
 * Retorna o preço promocional ativo de um produto (em centavos),
 * ou null se não houver promoção ativa no momento.
 */
export function getActivePromoPrice(product: Product): number | null {
    const promoPrice = normalizeCentValue(product.price_promo);
    if (!promoPrice || promoPrice <= 0) return null;

    const now = new Date();

    // Se tem data de início, verifica se já começou
    if (product.promo_start && new Date(product.promo_start) > now) return null;

    // Se tem data de fim, verifica se ainda não terminou
    if (product.promo_end && new Date(product.promo_end) < now) return null;

    return promoPrice;
}

/**
 * Retorna o preço de venda efetivo do produto:
 * preço promo (se ativo) ou preço varejo normal.
 */
export function getEffectiveRetailPrice(product: Product): number {
    return getActivePromoPrice(product) ?? normalizeCentValue(product.price_retail);
}

/**
 * Verifica se o produto tem promoção ativa agora.
 */
export function isPromoActive(product: Product): boolean {
    return getActivePromoPrice(product) !== null;
}
