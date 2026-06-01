import { vpsClient } from './vpsClient';

export interface CrossSellTag {
    id: string;
    name: string;
    slug: string;
    created_at?: string;
    updated_at?: string;
}

interface TableDataResponse {
    rows?: CrossSellTag[];
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

function byNewestCreatedAt(a: CrossSellTag, b: CrossSellTag): number {
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
}

async function loadTags(): Promise<CrossSellTag[]> {
    const allRows: CrossSellTag[] = [];
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse>(
            `/table-data/cross_sell_tags?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return allRows;
}

async function findExistingTag(name: string, slug: string): Promise<CrossSellTag | null> {
    const normalizedName = name.trim().toLowerCase();
    const tags = await loadTags();

    return [...tags]
        .sort(byNewestCreatedAt)
        .find((existing) => (
            existing.slug === slug ||
            existing.name.trim().toLowerCase() === normalizedName
        )) || null;
}

function looksLikeDuplicateError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('23505') || message.includes('unique constraint') || message.includes('409');
}

export const crossSellTagsService = {
    async list(): Promise<CrossSellTag[]> {
        const tags = await loadTags();
        return tags.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
    },

    async create(tag: Pick<CrossSellTag, 'name'>): Promise<CrossSellTag> {
        const slug = slugify(tag.name);
        const existingBeforeInsert = await findExistingTag(tag.name, slug);
        if (existingBeforeInsert) return existingBeforeInsert;

        try {
            return await vpsClient.post<CrossSellTag>('/table-data/cross_sell_tags', { name: tag.name, slug });
        } catch (error) {
            if (looksLikeDuplicateError(error)) {
                const existingTag = await findExistingTag(tag.name, slug);
                if (existingTag) return existingTag;
            }
            throw error;
        }
    },

    async update(id: string, tag: Pick<CrossSellTag, 'name'>): Promise<CrossSellTag> {
        const slug = slugify(tag.name);
        return vpsClient.patch<CrossSellTag>(
            `/table-data/cross_sell_tags/${encodeURIComponent(id)}?pk=id`,
            { name: tag.name, slug, updated_at: new Date().toISOString() }
        );
    },

    async delete(id: string): Promise<void> {
        await vpsClient.delete(`/table-data/cross_sell_tags/${encodeURIComponent(id)}?pk=id`);
    }
};
