import type { Product } from '../types/product';

/**
 * Retorna o preço promocional ativo de um produto (em centavos),
 * ou null se não houver promoção ativa no momento.
 */
export function getActivePromoPrice(product: Product): number | null {
    if (!product.price_promo || product.price_promo <= 0) return null;

    const now = new Date();

    // Se tem data de início, verifica se já começou
    if (product.promo_start && new Date(product.promo_start) > now) return null;

    // Se tem data de fim, verifica se ainda não terminou
    if (product.promo_end && new Date(product.promo_end) < now) return null;

    return product.price_promo;
}

/**
 * Retorna o preço de venda efetivo do produto:
 * preço promo (se ativo) ou preço varejo normal.
 */
export function getEffectiveRetailPrice(product: Product): number {
    return getActivePromoPrice(product) ?? product.price_retail;
}

/**
 * Verifica se o produto tem promoção ativa agora.
 */
export function isPromoActive(product: Product): boolean {
    return getActivePromoPrice(product) !== null;
}
