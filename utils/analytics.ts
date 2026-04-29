/**
 * Google Analytics 4 (GA4) E-commerce Tracking Helper
 * Funções utilitárias para disparar eventos padrão de e-commerce de forma limpa.
 */

// Types baseados na estrutura do Mercado do Vale (Product / CatalogProduct / CartItem)
interface AnalyticsItem {
    item_id: string;
    item_name: string;
    item_category?: string;
    item_brand?: string;
    price: number;
    quantity?: number;
}

/**
 * Função interna segura para disparar eventos apenas se o gtag estiver carregado
 */
const pushEvent = (eventName: string, params: object) => {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        window.gtag('event', eventName, params);
    }
};

/**
 * Formata o preço (centavos do banco para decimal)
 */
const formatPrice = (priceInCents: number) => {
    return priceInCents / 100;
};

// ============================================================================
// 1. EVENTOS DE INTERESSE
// ============================================================================

/**
 * [view_item] - Disparado quando o usuário visualiza os detalhes de um produto
 */
export const trackViewItem = (product: any) => {
    pushEvent('view_item', {
        currency: 'BRL',
        value: formatPrice(product.price),
        items: [
            {
                item_id: product.sku || product.id,
                item_name: product.name,
                item_brand: product.brand || '',
                item_category: product.category_slug || product.category || '',
                price: formatPrice(product.price)
            }
        ]
    });
};

/**
 * [search] - Disparado quando o usuário faz uma busca
 */
export const trackSearch = (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) return;
    pushEvent('search', {
        search_term: searchTerm
    });
};

// ============================================================================
// 2. JORNADA DE COMPRA (CARRINHO)
// ============================================================================

/**
 * [add_to_cart] - Disparado ao adicionar produto na sacola
 */
export const trackAddToCart = (product: any, quantity: number = 1) => {
    pushEvent('add_to_cart', {
        currency: 'BRL',
        value: formatPrice(product.price) * quantity,
        items: [
            {
                item_id: product.sku || product.id,
                item_name: product.name,
                item_brand: product.brand || '',
                item_category: product.category_slug || product.category || '',
                price: formatPrice(product.price),
                quantity: quantity
            }
        ]
    });
};

/**
 * [remove_from_cart] - Disparado ao remover produto da sacola
 */
export const trackRemoveFromCart = (cartItem: any) => {
    pushEvent('remove_from_cart', {
        currency: 'BRL',
        value: formatPrice(cartItem.price) * (cartItem.quantity || 1),
        items: [
            {
                item_id: cartItem.product?.sku || cartItem.product?.id || cartItem.product_id,
                item_name: cartItem.product?.name || cartItem.name || '',
                price: formatPrice(cartItem.price),
                quantity: cartItem.quantity || 1
            }
        ]
    });
};

/**
 * [view_cart] - Disparado ao abrir o carrinho
 */
export const trackViewCart = (cartItems: any[], totalValueCents: number) => {
    pushEvent('view_cart', {
        currency: 'BRL',
        value: formatPrice(totalValueCents),
        items: cartItems.map(item => ({
            item_id: item.product?.sku || item.product?.id || item.product_id,
            item_name: item.product?.name || item.name || '',
            price: formatPrice(item.price),
            quantity: item.quantity || 1
        }))
    });
};

// ============================================================================
// 3. CHECKOUT E COMPRA FINAL
// ============================================================================

/**
 * [begin_checkout] - Disparado quando entra na tela de finalização de compra
 */
export const trackBeginCheckout = (cartItems: any[], totalValueCents: number) => {
    pushEvent('begin_checkout', {
        currency: 'BRL',
        value: formatPrice(totalValueCents),
        items: cartItems.map(item => ({
            item_id: item.product?.sku || item.product?.id || item.product_id,
            item_name: item.product?.name || item.name || '',
            price: formatPrice(item.price),
            quantity: item.quantity || 1
        }))
    });
};

/**
 * [purchase] - Disparado na confirmação de criação do pedido
 */
export const trackPurchase = (
    transactionId: string, 
    cartItems: any[], 
    totalValueCents: number, 
    shippingCents: number = 0,
    couponCode?: string
) => {
    pushEvent('purchase', {
        transaction_id: transactionId,
        currency: 'BRL',
        value: formatPrice(totalValueCents + shippingCents),
        shipping: formatPrice(shippingCents),
        coupon: couponCode || undefined,
        items: cartItems.map(item => ({
            item_id: item.product?.sku || item.product?.id || item.product_id,
            item_name: item.product?.name || item.name || '',
            price: formatPrice(item.price),
            quantity: item.quantity || 1
        }))
    });
};
