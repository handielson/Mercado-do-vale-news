import { vpsClient } from './vpsClient';

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

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

async function loadPromotions(pageSize = 200): Promise<Promotion[]> {
    let offset = 0;
    const rows: Promotion[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<Promotion>>(
            `/table-data/promotions?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

function evaluatePromotion(promo: Promotion): boolean {
    if (promo.status === 'inactive') return false;
    if (promo.status === 'active') return true;

    if (promo.status === 'scheduled') {
        const now = new Date();
        const start = promo.start_date ? new Date(promo.start_date) : null;
        const end = promo.end_date ? new Date(promo.end_date) : null;

        if (start && now < start) return false;
        if (end && now > end) return false;
        return true;
    }

    return false;
}

export const promotionService = {
    /**
     * Busca todas as promocoes cadastradas (Admin)
     */
    async getAllPromotions(): Promise<Promotion[]> {
        return (await loadPromotions())
            .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    },

    /**
     * Busca uma promocao especifica pelo tipo (ex: 'one_year_screen_protector')
     * e avalia dinamicamente se ela esta ativa naquele exato momento.
     */
    async getPromotionStatus(type: string): Promise<{ isActive: boolean; promotion: Promotion | null }> {
        const promo = (await loadPromotions()).find(promotion => promotion.type === type);
        if (!promo) return { isActive: false, promotion: null };
        return { isActive: evaluatePromotion(promo), promotion: promo };
    },

    /**
     * Atualiza o status/datas de uma promocao (Admin)
     */
    async updatePromotion(
        id: string,
        updates: Partial<Pick<Promotion, 'status' | 'start_date' | 'end_date' | 'title' | 'description'>>
    ): Promise<boolean> {
        await vpsClient.patch<Promotion>(`/table-data/promotions/${id}`, {
            ...updates,
            updated_at: new Date().toISOString()
        });
        return true;
    }
};
