export type PaymentMethod = 'debit' | 'pix' | 'credit';

export interface PaymentFee {
    id: string;
    company_id: string;
    payment_method: PaymentMethod;
    installments: number;
    operator_name?: string; // Payment operator name (e.g., PagSeguro, Mercado Pago)
    operator_fee: number; // Percentage
    applied_fee: number; // Percentage
    created_at: string;
    updated_at: string;
}

export interface PaymentFeeInput {
    operator_name?: string;
    operator_fee: number;
    applied_fee: number;
}
