import { supabase } from './supabase';

export interface CrossSellTag {
    id: string;
    name: string;
    slug: string;
    created_at?: string;
    updated_at?: string;
}

export const crossSellTagsService = {
    async list(): Promise<CrossSellTag[]> {
        const { data, error } = await supabase
            .from('cross_sell_tags')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async create(tag: Pick<CrossSellTag, 'name'>): Promise<CrossSellTag> {
        let slug = tag.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        
        const { data, error } = await supabase
            .from('cross_sell_tags')
            .insert({ name: tag.name, slug })
            .select()
            .single();

        if (error) {
            if (error.code === '23505' || error.message.includes('unique constraint') || error.message.includes('409')) {
                const { data: existingTag, error: fetchErr } = await supabase
                    .from('cross_sell_tags')
                    .select('*')
                    .eq('slug', slug)
                    .single();
                if (!fetchErr && existingTag) return existingTag;
            }
            throw error;
        }
        return data;
    },

    async update(id: string, tag: Pick<CrossSellTag, 'name'>): Promise<CrossSellTag> {
        let slug = tag.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        const { data, error } = await supabase
            .from('cross_sell_tags')
            .update({ name: tag.name, slug, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('cross_sell_tags')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
