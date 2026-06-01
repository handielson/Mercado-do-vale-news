import { vpsClient } from './vpsClient';
import { vpsApiService } from './vpsApiService';

export interface PriceSnapshot {
    id: string;
    product_id: string;
    price_cost: number;
    price_retail: number;
    price_reseller: number;
    price_wholesale: number;
    changed_at: string;
}

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

async function loadPriceHistory(pageSize = 200): Promise<PriceSnapshot[]> {
    let offset = 0;
    const rows: PriceSnapshot[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<PriceSnapshot>>(
            `/table-data/product_price_history?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
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

    try {
        await vpsClient.post<PriceSnapshot>('/table-data/product_price_history', {
            product_id: productId,
            price_cost: normalizedPrices.price_cost,
            price_retail: normalizedPrices.price_retail,
            price_reseller: normalizedPrices.price_reseller,
            price_wholesale: normalizedPrices.price_wholesale,
        });
    } catch (error: any) {
        console.error('[priceHistory] log error:', error.message);
    }
}

/** Retorna as últimas N entradas do histórico de um produto */
export async function getPriceHistory(productId: string, limit = 5): Promise<PriceSnapshot[]> {
    try {
        return (await loadPriceHistory())
            .filter(snapshot => snapshot.product_id === productId)
            .sort((a, b) => new Date(b.changed_at || 0).getTime() - new Date(a.changed_at || 0).getTime())
            .slice(0, limit);
    } catch (error: any) {
        console.error('[priceHistory] fetch error:', error.message);
        return [];
    }
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

    await Promise.all(ids.map(id => (
        vpsApiService.updateProduct(id, {
            price_cost: newPrices.price_cost,
            price_retail: newPrices.price_retail,
            price_reseller: newPrices.price_reseller,
            price_wholesale: newPrices.price_wholesale,
        })
    )));

    // 2. Grava histórico para cada um
    const normalizedPrices = normalizePricePayload(newPrices);
    const inserts = ids.map(id => ({
        product_id: id,
        ...normalizedPrices,
    }));

    try {
        await Promise.all(inserts.map(insert => (
            vpsClient.post<PriceSnapshot>('/table-data/product_price_history', insert)
        )));
    } catch (error: any) {
        console.error('[priceHistory] batch log error:', error.message);
    }
}

export const priceHistoryService = {
    logPriceChange,
    getPriceHistory,
    applyPricesToVariation,
};
