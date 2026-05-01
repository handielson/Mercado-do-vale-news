import { supabase } from './supabase';

export interface PriceSnapshot {
    id: string;
    product_id: string;
    price_cost: number;
    price_retail: number;
    price_reseller: number;
    price_wholesale: number;
    changed_at: string;
}

function normalizePriceValue(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function normalizePricePayload(prices: {
    price_cost: unknown;
    price_retail: unknown;
    price_reseller: unknown;
    price_wholesale: unknown;
}) {
    return {
        price_cost: normalizePriceValue(prices.price_cost),
        price_retail: normalizePriceValue(prices.price_retail),
        price_reseller: normalizePriceValue(prices.price_reseller),
        price_wholesale: normalizePriceValue(prices.price_wholesale),
    };
}

/** Grava uma entrada no histórico de preços de um produto */
export async function logPriceChange(
    productId: string,
    prices: { price_cost: number | null | undefined; price_retail: number | null | undefined; price_reseller: number | null | undefined; price_wholesale: number | null | undefined }
): Promise<void> {
    const normalizedPrices = normalizePricePayload(prices);

    const { error } = await supabase
        .from('product_price_history')
        .insert({
            product_id: productId,
            price_cost: normalizedPrices.price_cost,
            price_retail: normalizedPrices.price_retail,
            price_reseller: normalizedPrices.price_reseller,
            price_wholesale: normalizedPrices.price_wholesale,
        });

    if (error) console.error('[priceHistory] log error:', error.message);
}

/** Retorna as últimas N entradas do histórico de um produto */
export async function getPriceHistory(productId: string, limit = 5): Promise<PriceSnapshot[]> {
    const { data, error } = await supabase
        .from('product_price_history')
        .select('*')
        .eq('product_id', productId)
        .order('changed_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[priceHistory] fetch error:', error.message);
        return [];
    }
    return data || [];
}

/**
 * Aplica preços médios ponderados a todos os produtos de uma variação
 * e grava o histórico de cada um.
 * 
 * variationProducts: lista de produtos (já filtrada por model_id + RAM + Storage)
 * newPrices: os preços a aplicar (em centavos)
 */
export async function applyPricesToVariation(
    variationProducts: { id: string; stock_quantity?: number }[],
    newPrices: { price_cost: number; price_retail: number; price_reseller: number; price_wholesale: number }
): Promise<void> {
    if (variationProducts.length === 0) return;

    const ids = variationProducts.map(p => p.id);

    // 1. Atualiza os preços de todos os produtos da variação
    const { error } = await supabase
        .from('products')
        .update({
            price_cost: newPrices.price_cost,
            price_retail: newPrices.price_retail,
            price_reseller: newPrices.price_reseller,
            price_wholesale: newPrices.price_wholesale,
        })
        .in('id', ids);

    if (error) throw new Error('[priceHistory] apply prices error: ' + error.message);

    // 2. Grava histórico para cada um
    const normalizedPrices = normalizePricePayload(newPrices);
    const inserts = ids.map(id => ({
        product_id: id,
        ...normalizedPrices,
    }));

    const { error: histError } = await supabase
        .from('product_price_history')
        .insert(inserts);

    if (histError) console.error('[priceHistory] batch log error:', histError.message);
}

export const priceHistoryService = {
    logPriceChange,
    getPriceHistory,
    applyPricesToVariation,
};
