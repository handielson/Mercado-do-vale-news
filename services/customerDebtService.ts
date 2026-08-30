import { vpsClient } from './vpsClient';

export interface CustomerDebt {
    id: string;
    customer_id: string;
    sale_id?: string | null;
    valor_total?: number | string;
    saldo_devedor?: number | string;
    descricao?: string;
    data_vencimento?: string;
    status?: string;
    installment_number?: number;
    installment_count?: number;
    created_at?: string;
}

export interface CustomerDebtPayment {
    id: string;
    debt_id: string;
    valor_pago?: number | string;
    metodo_pagamento?: string;
    forma_pagamento?: string;
    observacoes?: string;
    recibo_numero?: string;
    data_pagamento?: string;
    debito_descricao?: string;
    customer_id?: string;
    mercado_pago_link?: string;
    mercado_pago_id?: string;
    created_at?: string;
    updated_at?: string;
}

export interface CustomerDebtResponse {
    rows?: CustomerDebt[];
    total?: number;
}

export interface CustomerDebtPaymentResponse {
    rows?: CustomerDebtPayment[];
    total?: number;
}

export interface CustomerDebtPaymentInput {
    debt_id: string;
    valor_pago: number;
    data_pagamento: string;
    metodo_pagamento: string;
    observacoes?: string;
    cash_session_id?: string | null;
}

export interface CustomerDebtAllocationInput {
    debt_id: string;
    valor_liquido: number;
}

export interface CustomerDebtMercadoPagoIntent {
    id: string;
    debt_id: string;
    provider: 'mercado_pago';
    provider_intent_id?: string;
    metodo: 'pix' | 'card';
    valor_liquido: number;
    valor_cobrado: number;
    taxa_pct: number;
    status: string;
    checkout_url?: string | null;
    qr_code?: string | null;
    qr_code_base64?: string | null;
    environment?: string;
    is_sandbox?: boolean;
    expires_at?: string;
    debt?: CustomerDebt;
    payments?: CustomerDebtPayment[];
}

export function toCents(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : 0;
}

export function formatCurrencyCents(value: unknown): string {
    const cents = toCents(value);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function formatCurrencyReais(value: unknown): string {
    const amount = Number(value);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(amount) ? amount : 0);
}

export async function listCustomerDebts(customerId?: string): Promise<CustomerDebt[]> {
    const query = new URLSearchParams({ limit: '200' });
    if (customerId) query.set('customer_id', customerId);
    const data = await vpsClient.get<CustomerDebtResponse>(`/financial/customer-debts?${query.toString()}`);
    return Array.isArray(data.rows) ? data.rows : [];
}

export async function listCustomerDebtPayments(customerId?: string): Promise<CustomerDebtPayment[]> {
    const query = new URLSearchParams({ limit: '200' });
    if (customerId) query.set('customer_id', customerId);
    const data = await vpsClient.get<CustomerDebtPaymentResponse>(`/financial/customer-debts/payments?${query.toString()}`);
    return Array.isArray(data.rows) ? data.rows : [];
}

export async function registerCustomerDebtPayment(input: CustomerDebtPaymentInput): Promise<unknown> {
    return vpsClient.post('/financial/customer-debts/pay', input);
}

export async function createCustomerDebtMercadoPagoIntent(input: {
    debt_id?: string;
    valor_liquido: number;
    metodo: 'pix' | 'card';
    allocations?: CustomerDebtAllocationInput[];
}): Promise<CustomerDebtMercadoPagoIntent> {
    return vpsClient.post<CustomerDebtMercadoPagoIntent>('/financial/customer-debts/mp-intent', input);
}

export async function refreshCustomerDebtMercadoPagoIntentStatus(intentId: string): Promise<CustomerDebtMercadoPagoIntent> {
    return vpsClient.post<CustomerDebtMercadoPagoIntent>(
        `/financial/customer-debts/mp-intent/${encodeURIComponent(intentId)}/status`,
        {}
    );
}
