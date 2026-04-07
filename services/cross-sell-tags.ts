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

        // Evita 409 previsivel: retorna tag existente antes de tentar inserir.
        const { data: existingBeforeInsert, error: existingBeforeInsertError } = await supabase
            .from('cross_sell_tags')
            .select('*')
            .eq('slug', slug)
            .order('created_at', { ascending: false })
            .limit(1);
        if (!existingBeforeInsertError && existingBeforeInsert && existingBeforeInsert.length > 0) {
            return existingBeforeInsert[0];
        }

        // Fallback por nome para casos legados onde o slug pode ter divergido
        const { data: existingByName, error: existingByNameError } = await supabase
            .from('cross_sell_tags')
            .select('*')
            .ilike('name', tag.name)
            .order('created_at', { ascending: false })
            .limit(1);
        if (!existingByNameError && existingByName && existingByName.length > 0) {
            return existingByName[0];
        }

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
                    .order('created_at', { ascending: false })
                    .limit(1);
                if (!fetchErr && existingTag && existingTag.length > 0) return existingTag[0];

                const { data: existingTagByName, error: fetchByNameErr } = await supabase
                    .from('cross_sell_tags')
                    .select('*')
                    .ilike('name', tag.name)
                    .order('created_at', { ascending: false })
                    .limit(1);
                if (!fetchByNameErr && existingTagByName && existingTagByName.length > 0) return existingTagByName[0];
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
