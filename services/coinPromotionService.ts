import { vpsClient } from './vpsClient';
import { addCoins } from './cashbackService';

export interface CoinPromotion {
    id: string;
    name: string;
    description: string | null;
    product_id: string | null;
    category_id: string | null;
    min_purchase: number;
    bonus_coins: number;
    starts_at: string;
    expires_at: string | null;
    max_uses: number | null;
    uses_count: number;
    active: boolean;
    created_at: string;
    products?: { name: string } | null;
    categories?: { name: string } | null;
}

export interface CoinPromoMatch {
    promo: CoinPromotion;
    bonus: number;
}

interface TableDataResponse<T> {
    rows?: T[];
}

interface NamedRow {
    id: string;
    name: string;
}

async function loadTableRows<T>(table: string, pageSize = 500): Promise<T[]> {
    const allRows: T[] = [];

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse<T>>(
            `/table-data/${table}?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return allRows;
}

function sortNewestFirst(promos: CoinPromotion[]): CoinPromotion[] {
    return [...promos].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

async function loadCoinPromotions(): Promise<CoinPromotion[]> {
    return sortNewestFirst(await loadTableRows<CoinPromotion>('coin_promotions'));
}

function stripJoinedFields(updates: Partial<CoinPromotion>): Partial<CoinPromotion> {
    const { products: _products, categories: _categories, ...row } = updates;
    return row;
}

async function enrichPromotionNames(promos: CoinPromotion[]): Promise<CoinPromotion[]> {
    const [products, categories] = await Promise.all([
        loadTableRows<NamedRow>('products'),
        loadTableRows<NamedRow>('categories')
    ]);
    const productsById = new Map(products.map(product => [String(product.id), product]));
    const categoriesById = new Map(categories.map(category => [String(category.id), category]));

    return promos.map(promo => ({
        ...promo,
        products: promo.product_id ? productsById.get(String(promo.product_id)) || null : null,
        categories: promo.category_id ? categoriesById.get(String(promo.category_id)) || null : null
    }));
}

// ============================================================
// CRUD ADMIN
// ============================================================

export async function listCoinPromotions(): Promise<CoinPromotion[]> {
    return enrichPromotionNames(await loadCoinPromotions());
}

export async function createCoinPromotion(
    promo: Omit<CoinPromotion, 'id' | 'uses_count' | 'created_at' | 'products' | 'categories'>
): Promise<CoinPromotion> {
    return vpsClient.post<CoinPromotion>('/table-data/coin_promotions', promo);
}

export async function updateCoinPromotion(
    id: string,
    updates: Partial<CoinPromotion>
): Promise<void> {
    await vpsClient.patch(
        `/table-data/coin_promotions/${encodeURIComponent(id)}?pk=id`,
        stripJoinedFields(updates)
    );
}

export async function deleteCoinPromotion(id: string): Promise<void> {
    await vpsClient.delete(`/table-data/coin_promotions/${encodeURIComponent(id)}?pk=id`);
}

export async function toggleCoinPromotion(id: string, active: boolean): Promise<void> {
    await updateCoinPromotion(id, { active });
}

// ============================================================
// LOGICA DE APLICACAO
// ============================================================

/**
 * Verifica quais promocoes ativas se aplicam a uma compra.
 * Retorna lista de promocoes correspondentes com bonus calculado.
 */
export async function getApplicablePromotions(
    productIds: string[],
    categoryIds: string[],
    purchaseTotal: number
): Promise<CoinPromoMatch[]> {
    const now = new Date().toISOString();
    const promos = (await loadCoinPromotions()).filter(promo => {
        if (!promo.active) return false;
        if (promo.starts_at && promo.starts_at > now) return false;
        if (promo.expires_at && promo.expires_at <= now) return false;
        return true;
    });
    const matches: CoinPromoMatch[] = [];

    for (const promo of promos) {
        if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) continue;

        const productMatch = promo.product_id && productIds.includes(promo.product_id);
        const categoryMatch = promo.category_id && categoryIds.includes(promo.category_id);
        const valueMatch = !promo.product_id && !promo.category_id && purchaseTotal >= promo.min_purchase;

        if (productMatch || categoryMatch || valueMatch) {
            matches.push({ promo, bonus: promo.bonus_coins });
        }
    }

    return matches;
}

/**
 * Aplica as promocoes correspondentes: credita bonus e incrementa contadores.
 */
export async function applyPromotions(
    customerId: string,
    matches: CoinPromoMatch[],
    saleId: string
): Promise<number> {
    let totalBonus = 0;

    for (const { promo, bonus } of matches) {
        try {
            await addCoins(
                customerId,
                bonus,
                'earn_manual',
                `Promocao: ${promo.name}`,
                saleId,
                'sale'
            );
        } catch (error) {
            console.error(`[Promocao] Erro ao creditar bonus "${promo.name}":`, error);
            continue;
        }

        await updateCoinPromotion(promo.id, { uses_count: (promo.uses_count || 0) + 1 });
        totalBonus += bonus;
    }

    return totalBonus;
}
