import { vpsClient } from './vpsClient';

// ============================================================
// Tipos
// ============================================================

export type TagContext =
    | 'scheduled'
    | 'action_sale'
    | 'action_customer'
    | 'welcome'
    | 'warranty'
    | 'product_name'
    | 'static';

export type TagResolverType =
    | 'static'
    | 'count_products'
    | 'sum_products_stock'
    | 'list_products'
    | 'count_sales_today'
    | 'sum_sales_today'
    | 'date_now'
    | 'system_injected';

export interface SystemTag {
    id: string;
    name: string;
    label: string;
    description?: string;
    context: TagContext;
    resolver_type: TagResolverType;
    resolver_config: Record<string, any>;
    preview_value: string;
    active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export type SystemTagInput = Omit<SystemTag, 'id' | 'created_at' | 'updated_at'>;

// Labels para exibição na UI
export const CONTEXT_LABELS: Record<TagContext, string> = {
    scheduled: 'Relatório Agendado',
    action_sale: 'Evento de Venda',
    action_customer: 'Novo Cliente',
    welcome: 'Boas-Vindas WhatsApp',
    warranty: 'Garantia',
    product_name: 'Nome de Produto',
    static: 'Valor Fixo',
};

export const RESOLVER_LABELS: Record<TagResolverType, string> = {
    static: 'Texto fixo',
    count_products: 'Contagem de produtos',
    sum_products_stock: 'Soma de estoque',
    list_products: 'Lista de produtos',
    count_sales_today: 'Contagem de vendas hoje',
    sum_sales_today: 'Soma financeira hoje',
    date_now: 'Data/Hora atual',
    system_injected: 'Injetada pelo sistema (somente leitura)',
};

// ============================================================
// Service
// ============================================================

interface TableDataResponse {
    rows?: SystemTag[];
}

function slugName(value: string): string {
    return value
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

function parseResolverConfig(value: unknown): Record<string, any> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }
    return {};
}

function normalizeTag(row: SystemTag): SystemTag {
    return {
        ...row,
        active: Boolean(row.active),
        sort_order: Number(row.sort_order || 0),
        resolver_config: parseResolverConfig(row.resolver_config),
    };
}

function sortTags(tags: SystemTag[]): SystemTag[] {
    return tags.sort((a, b) => {
        const orderDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0);
        if (orderDiff !== 0) return orderDiff;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });
}

async function loadTags(): Promise<SystemTag[]> {
    const allRows: SystemTag[] = [];
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse>(
            `/table-data/system_tags?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return sortTags(allRows.map(normalizeTag));
}

export const systemTagsService = {
    async list(): Promise<SystemTag[]> {
        return loadTags();
    },

    async listActive(): Promise<SystemTag[]> {
        return (await loadTags()).filter(tag => tag.active);
    },

    async listByContext(context: TagContext): Promise<SystemTag[]> {
        return (await loadTags()).filter(tag => tag.context === context && tag.active);
    },

    async create(input: SystemTagInput): Promise<SystemTag> {
        const data = await vpsClient.post<SystemTag>('/table-data/system_tags', {
            ...input,
            name: slugName(input.name),
        });
        return normalizeTag(data);
    },

    async update(id: string, input: Partial<SystemTagInput>): Promise<SystemTag> {
        const payload: any = { ...input, updated_at: new Date().toISOString() };
        if (input.name) {
            payload.name = slugName(input.name);
        }

        const data = await vpsClient.patch<SystemTag>(
            `/table-data/system_tags/${encodeURIComponent(id)}?pk=id`,
            payload
        );
        return normalizeTag(data);
    },

    async delete(id: string): Promise<void> {
        await vpsClient.delete(`/table-data/system_tags/${encodeURIComponent(id)}?pk=id`);
    },

    async toggleActive(id: string, active: boolean): Promise<void> {
        await vpsClient.patch(
            `/table-data/system_tags/${encodeURIComponent(id)}?pk=id`,
            { active, updated_at: new Date().toISOString() }
        );
    },
};
