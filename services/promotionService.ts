import { supabase } from './supabase';

export type PromotionStatus = 'active' | 'inactive' | 'scheduled';

export interface Promotion {
    id: string;
    type: string;
    title: string;
    description: string | null;
    status: PromotionStatus;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    updated_at: string;
}

export const promotionService = {
    /**
     * Busca todas as promoções cadastradas (Admin)
     */
    async getAllPromotions(): Promise<Promotion[]> {
        const { data, error } = await supabase
            .from('promotions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Promotion[];
    },

    /**
     * Busca uma promoção específica pelo tipo (ex: 'one_year_screen_protector')
     * e avalia dinamicamente se ela está ativa naquele exato momento.
     */
    async getPromotionStatus(type: string): Promise<{ isActive: boolean; promotion: Promotion | null }> {
        const { data, error } = await supabase
            .from('promotions')
            .select('*')
            .eq('type', type)
            .maybeSingle();

        if (error || !data) return { isActive: false, promotion: null };

        const promo = data as Promotion;

        // Verifica status manual
        if (promo.status === 'inactive') return { isActive: false, promotion: promo };
        if (promo.status === 'active') return { isActive: true, promotion: promo };

        // Lógica de Agendamento ('scheduled')
        if (promo.status === 'scheduled') {
            const now = new Date();
            const start = promo.start_date ? new Date(promo.start_date) : null;
            const end = promo.end_date ? new Date(promo.end_date) : null;

            if (start && now < start) return { isActive: false, promotion: promo };
            if (end && now > end) return { isActive: false, promotion: promo };

            return { isActive: true, promotion: promo };
        }

        return { isActive: false, promotion: promo };
    },

    /**
     * Atualiza o status/datas de uma promoção (Admin)
     */
    async updatePromotion(
        id: string,
        updates: Partial<Pick<Promotion, 'status' | 'start_date' | 'end_date' | 'title' | 'description'>>
    ): Promise<boolean> {
        const { data, error } = await supabase
            .from('promotions')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('id');

        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Permissão negada ou promoção não encontrada.');
        return true;
    }
};
