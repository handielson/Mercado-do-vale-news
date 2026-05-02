import { vpsClient } from './vpsClient';
import type { PaymentFee } from '../types/payment-fees';
// Re-exporta para manter compatibilidade com imports existentes
export type { PaymentFee } from '../types/payment-fees';

// Tipos retornados brutos pela VPS MySQL (nomes de colunas do banco)
interface RawPaymentFee {
    id: string;
    method: string | null;
    installments: number;
    operator_fee_pct: number;
    applied_fee_pct: number;
    channel: string;
    created_at?: string;
    updated_at?: string;
}

const FEES_SUCCESS_TTL_MS = 5 * 60 * 1000;
const FEES_FAILURE_TTL_MS = 60 * 1000;
let feesCache: { data: PaymentFee[]; expiresAt: number } | null = null;
let failureCooldownUntil = 0;
let feesRequest: Promise<PaymentFee[]> | null = null;

/** Normaliza campos da VPS para o padrão do frontend (types/payment-fees.ts) */
function normalize(raw: RawPaymentFee): PaymentFee {
    return {
        id: raw.id,
        company_id: '',
        payment_method: (raw.method ?? '') as PaymentFee['payment_method'],
        channel: (raw.channel ?? 'presencial') as PaymentFee['channel'],
        installments: raw.installments,
        operator_fee: raw.operator_fee_pct ?? 0,
        applied_fee: raw.applied_fee_pct ?? 0,
        created_at: raw.created_at ?? '',
        updated_at: raw.updated_at ?? '',
    };
}

export const paymentFeesService = {
    async list(): Promise<PaymentFee[]> {
        if (feesCache && Date.now() < feesCache.expiresAt) {
            return feesCache.data;
        }

        if (feesRequest) {
            return feesRequest;
        }

        if (Date.now() < failureCooldownUntil) {
            return feesCache?.data || [];
        }

        feesRequest = (async () => {
            const raw = await vpsClient.get<RawPaymentFee[]>('/payment-fees');
            const normalized = raw.map(normalize);
            feesCache = { data: normalized, expiresAt: Date.now() + FEES_SUCCESS_TTL_MS };
            return normalized;
        })();

        try {
            return await feesRequest;
        } catch (error) {
            failureCooldownUntil = Date.now() + FEES_FAILURE_TTL_MS;
            return feesCache?.data || [];
        } finally {
            feesRequest = null;
        }
    },

    /** Replace ALL fees atomically (PUT replaces entire list) */
    async replaceAll(fees: Omit<PaymentFee, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
        // Converte de volta para o formato da VPS antes de enviar
        const vpsFormat = fees.map(f => ({
            method: f.payment_method,
            installments: f.installments,
            operator_fee_pct: f.operator_fee,
            applied_fee_pct: f.applied_fee,
            channel: f.channel ?? 'presencial',
        }));
        await vpsClient.put<{ ok: boolean; count: number }>('/payment-fees', vpsFormat);
    },

    /** Legacy single-record update — patches one fee by id */
    async update(id: string, updates: Partial<PaymentFee>): Promise<void> {
        // Rebuild full list with this one row updated, then replace all
        const all = await this.list();
        const updated = all.map(f => f.id === id ? { ...f, ...updates } : f);
        await this.replaceAll(updated);
    },
};

