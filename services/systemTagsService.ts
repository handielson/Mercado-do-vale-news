import { supabase } from './supabase';

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

export const systemTagsService = {
    async list(): Promise<SystemTag[]> {
        const { data, error } = await supabase
            .from('system_tags')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async listActive(): Promise<SystemTag[]> {
        const { data, error } = await supabase
            .from('system_tags')
            .select('*')
            .eq('active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async listByContext(context: TagContext): Promise<SystemTag[]> {
        const { data, error } = await supabase
            .from('system_tags')
            .select('*')
            .eq('context', context)
            .eq('active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async create(input: SystemTagInput): Promise<SystemTag> {
        const slug = input.name
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');

        const { data, error } = await supabase
            .from('system_tags')
            .insert({ ...input, name: slug })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, input: Partial<SystemTagInput>): Promise<SystemTag> {
        const payload: any = { ...input, updated_at: new Date().toISOString() };
        if (input.name) {
            payload.name = input.name
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '');
        }

        const { data, error } = await supabase
            .from('system_tags')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('system_tags')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async toggleActive(id: string, active: boolean): Promise<void> {
        const { error } = await supabase
            .from('system_tags')
            .update({ active, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    },
};
