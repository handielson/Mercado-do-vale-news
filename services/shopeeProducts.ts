import { vpsClient } from './vpsClient';
import { normalizeShopeeConnectionId, PRIMARY_SHOPEE_CONNECTION_ID } from './shopeeConnections';

interface TableDataResponse<T> {
    rows?: T[];
    total?: number;
    limit?: number;
    offset?: number;
}

export interface ShopeeProductLink {
    id?: string;
    product_id: string;
    connection_id?: string | null;
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

function normalizeConnectionId(value: unknown): string {
    return normalizeShopeeConnectionId(String(value || ''));
}

export function getShopeeStoreCode(connectionId: unknown): 'M' | 'G' {
    return normalizeConnectionId(connectionId) === PRIMARY_SHOPEE_CONNECTION_ID ? 'M' : 'G';
}

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

async function getItemIdByProductId(productId: string, connectionId = PRIMARY_SHOPEE_CONNECTION_ID): Promise<number | null> {
    const normalizedConnectionId = normalizeConnectionId(connectionId);
    const link = (await list())
        .filter(row => String(row.product_id) === String(productId))
        .filter(row => normalizeConnectionId(row.connection_id) === normalizedConnectionId)
        .filter(row => parseItemId(row.shopee_item_id) !== null)
        .sort(byLastSyncedDesc)[0];

    return parseItemId(link?.shopee_item_id);
}

async function getItemIdByProductIdMap(connectionId = PRIMARY_SHOPEE_CONNECTION_ID): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const normalizedConnectionId = normalizeConnectionId(connectionId);

    for (const row of await list()) {
        if (normalizeConnectionId(row.connection_id) !== normalizedConnectionId) continue;
        const itemId = parseItemId(row.shopee_item_id);
        if (!itemId) continue;
        const productId = String(row.product_id);
        if (!map.has(productId)) map.set(productId, itemId);
    }

    return map;
}

async function getStoreCodesByProductIdMap(): Promise<Map<string, Array<'M' | 'G'>>> {
    const codeSets = new Map<string, Set<'M' | 'G'>>();

    for (const row of await list()) {
        if (!parseItemId(row.shopee_item_id)) continue;
        const productId = String(row.product_id);
        if (!codeSets.has(productId)) codeSets.set(productId, new Set());
        codeSets.get(productId)?.add(getShopeeStoreCode(row.connection_id));
    }

    return new Map(
        [...codeSets.entries()].map(([productId, codes]) => [
            productId,
            [...codes].sort((a, b) => (a === 'M' ? -1 : b === 'M' ? 1 : a.localeCompare(b))),
        ]),
    );
}

async function getByProductIds(productIds: Array<string | number>): Promise<ShopeeProductLink[]> {
    const ids = new Set(productIds.map(id => String(id)));
    if (ids.size === 0) return [];
    return (await list()).filter(row => ids.has(String(row.product_id)));
}

async function upsert(link: ShopeeProductLinkInput): Promise<void> {
    const productId = String(link.product_id);
    const connectionId = normalizeConnectionId(link.connection_id);
    const existing = (await getByProductIds([productId]))
        .find(row => normalizeConnectionId(row.connection_id) === connectionId);
    const payload = {
        ...link,
        product_id: productId,
        connection_id: connectionId,
    };

    if (existing) {
        await vpsClient.patch(
            `/table-data/shopee_products/${encodeURIComponent(String(existing.id))}?pk=id`,
            payload,
        );
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

async function updateByProductId(productId: string, updates: Partial<ShopeeProductLink>, connectionId = PRIMARY_SHOPEE_CONNECTION_ID): Promise<void> {
    const normalizedConnectionId = normalizeConnectionId(connectionId);
    const existing = (await getByProductIds([productId]))
        .find(row => normalizeConnectionId(row.connection_id) === normalizedConnectionId);
    if (!existing?.id) return;
    await vpsClient.patch(
        `/table-data/shopee_products/${encodeURIComponent(String(existing.id))}?pk=id`,
        { ...updates, connection_id: normalizedConnectionId },
    );
}

async function deleteByProductId(productId: string, connectionId = PRIMARY_SHOPEE_CONNECTION_ID): Promise<void> {
    const normalizedConnectionId = normalizeConnectionId(connectionId);
    const links = (await getByProductIds([productId]))
        .filter(row => normalizeConnectionId(row.connection_id) === normalizedConnectionId);
    for (const link of links) {
        if (!link.id) continue;
        await vpsClient.delete(`/table-data/shopee_products/${encodeURIComponent(String(link.id))}?pk=id`);
    }
}

async function deleteByShopeeItemId(itemId: number | string, connectionId = PRIMARY_SHOPEE_CONNECTION_ID): Promise<void> {
    const targetItemId = String(itemId);
    const normalizedConnectionId = normalizeConnectionId(connectionId);
    const links = (await list())
        .filter(row => String(row.shopee_item_id) === targetItemId)
        .filter(row => normalizeConnectionId(row.connection_id) === normalizedConnectionId);

    for (const link of links) {
        if (!link.id) continue;
        await vpsClient.delete(`/table-data/shopee_products/${encodeURIComponent(String(link.id))}?pk=id`);
    }
}

export const shopeeProductService = {
    list,
    getByProductIds,
    getItemIdByProductId,
    getItemIdByProductIdMap,
    getStoreCodesByProductIdMap,
    upsert,
    upsertMany,
    updateByProductId,
    deleteByProductId,
    deleteByShopeeItemId,
};
