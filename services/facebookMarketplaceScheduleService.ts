import { vpsClient } from './vpsClient';

export type FacebookMarketplaceStatus = 'scheduled' | 'ready' | 'published' | 'cancelled';

export interface FacebookMarketplaceDestination {
    name: string;
    url?: string;
    type: 'marketplace' | 'group';
}

export interface FacebookMarketplaceSchedule {
    id: string;
    product_id: string | null;
    product_name: string;
    price_cents: number;
    description: string;
    image_urls: string[];
    destinations: FacebookMarketplaceDestination[];
    scheduled_for: string;
    status: FacebookMarketplaceStatus;
    notes: string | null;
    published_url: string | null;
    published_at: string | null;
    reminder_sent_at: string | null;
    created_at: string;
    updated_at: string;
}

export type FacebookMarketplaceScheduleInput = Omit<
    FacebookMarketplaceSchedule,
    'id' | 'published_at' | 'reminder_sent_at' | 'created_at' | 'updated_at'
>;

type RawSchedule = Omit<FacebookMarketplaceSchedule, 'image_urls' | 'destinations'> & {
    image_urls: string[] | string | null;
    destinations: FacebookMarketplaceDestination[] | string | null;
};

interface TableDataResponse {
    rows?: RawSchedule[];
}

function parseJsonArray<T>(value: T[] | string | null | undefined): T[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function normalizeSchedule(row: RawSchedule): FacebookMarketplaceSchedule {
    return {
        ...row,
        price_cents: Number(row.price_cents) || 0,
        image_urls: parseJsonArray<string>(row.image_urls),
        destinations: parseJsonArray<FacebookMarketplaceDestination>(row.destinations),
    };
}

async function listAll(): Promise<FacebookMarketplaceSchedule[]> {
    const rows: NonNullable<TableDataResponse['rows']> = [];
    const pageSize = 200;
    for (let offset = 0; ; offset += pageSize) {
        const page = await vpsClient.get<TableDataResponse>(
            `/table-data/facebook_marketplace_schedule?limit=${pageSize}&offset=${offset}`,
        );
        const pageRows = Array.isArray(page.rows) ? page.rows : [];
        rows.push(...pageRows);
        if (pageRows.length < pageSize) break;
    }

    return rows
        .map(normalizeSchedule)
        .sort((a, b) => String(a.scheduled_for).localeCompare(String(b.scheduled_for)));
}

export const facebookMarketplaceScheduleService = {
    list: listAll,

    async create(input: FacebookMarketplaceScheduleInput): Promise<FacebookMarketplaceSchedule> {
        const row = await vpsClient.post<RawSchedule>(
            '/table-data/facebook_marketplace_schedule',
            input,
        );
        return normalizeSchedule(row);
    },

    async update(
        id: string,
        input: Partial<FacebookMarketplaceScheduleInput> & Partial<Pick<FacebookMarketplaceSchedule, 'published_at'>>,
    ): Promise<FacebookMarketplaceSchedule> {
        const row = await vpsClient.patch<RawSchedule>(
            `/table-data/facebook_marketplace_schedule/${encodeURIComponent(id)}?pk=id`,
            input,
        );
        return normalizeSchedule(row);
    },

    async delete(id: string): Promise<void> {
        await vpsClient.delete(`/table-data/facebook_marketplace_schedule/${encodeURIComponent(id)}?pk=id`);
    },
};
