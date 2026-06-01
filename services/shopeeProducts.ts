import { vpsClient } from './vpsClient';

interface TableDataResponse<T> {
    rows?: T[];
    total?: number;
    limit?: number;
    offset?: number;
}

export interface ShopeeProductLink {
    id?: string;
    product_id: string;
    shopee_item_id?: number | string | null;
    shopee_category_id?: number | string | null;
    shopee_category_name?: string | null;
    shopee_price?: number | string | null;
    shopee_model_id?: number | string | null;
    shopee_model_sku?: string | null;
    shopee_model_name?: string | null;
    shopee_tier_index?: unknown;
    status?: string | null;
    last_synced_at?: string | null;
}

type ShopeeProductLinkInput = Omit<ShopeeProductLink, 'id'> & { id?: string };

function parseItemId(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function byLastSyncedDesc(a: ShopeeProductLink, b: ShopeeProductLink): number {
    return String(b.last_synced_at || '').localeCompare(String(a.last_synced_at || ''));
}

async function list(): Promise<ShopeeProductLink[]> {
    const rows: ShopeeProductLink[] = [];
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse<ShopeeProductLink>>(
            `/table-data/shopee_products?limit=${pageSize}&offset=${offset}`
        );
        const pageRows = Array.isArray(data.rows) ? data.rows : [];
        rows.push(...pageRows);
        if (pageRows.length < pageSize) break;
    }

    return rows;
}

async function getItemIdByProductId(productId: string): Promise<number | null> {
    const link = (await list())
        .filter(row => String(row.product_id) === String(productId))
        .filter(row => parseItemId(row.shopee_item_id) !== null)
        .sort(byLastSyncedDesc)[0];

    return parseItemId(link?.shopee_item_id);
}

async function getItemIdByProductIdMap(): Promise<Map<string, number>> {
    const map = new Map<string, number>();

    for (const row of await list()) {
        const itemId = parseItemId(row.shopee_item_id);
        if (!itemId) continue;
        const productId = String(row.product_id);
        if (!map.has(productId)) map.set(productId, itemId);
    }

    return map;
}

async function getByProductIds(productIds: Array<string | number>): Promise<ShopeeProductLink[]> {
    const ids = new Set(productIds.map(id => String(id)));
    if (ids.size === 0) return [];
    return (await list()).filter(row => ids.has(String(row.product_id)));
}

async function upsert(link: ShopeeProductLinkInput): Promise<void> {
    const productId = String(link.product_id);
    const existing = (await getByProductIds([productId]))[0];
    const payload = {
        ...link,
        product_id: productId,
    };

    if (existing) {
        await updateByProductId(productId, payload);
        return;
    }

    await vpsClient.post('/table-data/shopee_products', {
        id: link.id || crypto.randomUUID(),
        ...payload,
    });
}

async function upsertMany(links: ShopeeProductLinkInput[]): Promise<number> {
    let count = 0;
    for (const link of links) {
        await upsert(link);
        count += 1;
    }
    return count;
}

async function updateByProductId(productId: string, updates: Partial<ShopeeProductLink>): Promise<void> {
    await vpsClient.patch(
        `/table-data/shopee_products/${encodeURIComponent(productId)}?pk=product_id`,
        updates
    );
}

async function deleteByProductId(productId: string): Promise<void> {
    await vpsClient.delete(`/table-data/shopee_products/${encodeURIComponent(productId)}?pk=product_id`);
}

async function deleteByShopeeItemId(itemId: number | string): Promise<void> {
    const targetItemId = String(itemId);
    const links = (await list()).filter(row => String(row.shopee_item_id) === targetItemId);

    for (const link of links) {
        await deleteByProductId(String(link.product_id));
    }
}

export const shopeeProductService = {
    list,
    getByProductIds,
    getItemIdByProductId,
    getItemIdByProductIdMap,
    upsert,
    upsertMany,
    updateByProductId,
    deleteByProductId,
    deleteByShopeeItemId,
};
