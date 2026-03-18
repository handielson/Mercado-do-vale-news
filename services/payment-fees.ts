import { vpsClient } from './vpsClient';

export interface PaymentFee {
    id: string;
    method: string | null;
    installments: number;
    operator_fee_pct: number;
    applied_fee_pct: number;
    channel: 'presencial' | 'online_mp' | 'online_ps' | 'all';
    created_at?: string;
    updated_at?: string;
}

export const paymentFeesService = {
    async list(): Promise<PaymentFee[]> {
        return vpsClient.get<PaymentFee[]>('/payment-fees');
    },

    /** Replace ALL fees atomically (PUT replaces entire list) */
    async replaceAll(fees: Omit<PaymentFee, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
        await vpsClient.put<{ ok: boolean; count: number }>('/payment-fees', fees);
    },

    /** Legacy single-record update — patches one fee by id */
    async update(id: string, updates: Partial<PaymentFee>): Promise<void> {
        // Rebuild full list with this one row updated, then replace all
        const all = await this.list();
        const updated = all.map(f => f.id === id ? { ...f, ...updates } : f);
        await this.replaceAll(updated);
    },
};
