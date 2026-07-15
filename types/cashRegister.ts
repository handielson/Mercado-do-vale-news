/**
 * Cash Register Types
 * Tipos do modulo de Abertura/Fechamento/Auditoria de Caixa PDV.
 * Todos os valores monetarios em centavos inteiros.
 */

/** Denominacoes brasileiras em centavos (notas e moedas). */
export const CASH_DENOMINATIONS_CENTS = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5] as const;

/** Contagem por denominacao: chave = valor em centavos (string), valor = quantidade. */
export type DenominationCount = Record<string, number>;

export type CashSessionStatus = 'open' | 'closed';

export interface CashSession {
    id: string;
    session_number: number;
    status: CashSessionStatus;
    operator_user_id: string;
    operator_name: string | null;
    device_key: string | null;
    opened_at: string;
    opening_notes: string | null;
    opening_amount_cents: number;
    opening_count_json: DenominationCount | null;
    created_at: string;
}

export interface CashSessionListItem extends CashSession {
    rectification_count: number;
    last_closed_at: string | null;
    last_difference_cents: number | null;
    last_counted_cash_cents: number | null;
}

export interface CashSalePaymentSummary {
    method: string;
    amount_cents: number;
    installments: number;
}

export interface CashSaleSummary {
    id: string;
    status: string;
    created_at: string;
    customer_id: string | null;
    customer_name: string | null;
    total_cents: number;
    payments: CashSalePaymentSummary[];
    items?: Array<{
        product_name: string;
        quantity: number;
        unit_price_cents: number;
        total_cents: number;
        is_gift: boolean;
    }>;
}

export interface CashMovement {
    id: string;
    type: 'opening_float' | 'sangria' | 'suprimento' | 'deposito' | 'retirada' | 'ajuste';
    direction: 'in' | 'out';
    amount_cents: number;
    description: string | null;
    created_by_user_id: string;
    created_by_name: string | null;
    reversed_movement_id: string | null;
    created_at: string;
}

export interface CashSessionSummary {
    by_method: Record<string, number>;
    expected_cash_cents: number;
    total_in_cents: number;
    movements_in_cents: number;
    movements_out_cents: number;
    sales: CashSaleSummary[];
    refunds: Array<{ id: string; status: string; total_cents: number; payments: CashSalePaymentSummary[] }>;
    pix_avulso: Array<{ id: string; amount_cents: number; description: string | null; created_at: string }>;
    debt_payments: Array<{
        id: string;
        debt_id: string;
        customer_id: string | null;
        customer_name: string | null;
        method: string;
        amount_cents: number;
        paid_at: string;
        notes: string | null;
    }>;
    delivery_settlements: Array<{
        id: string;
        customer_id: string;
        customer_name: string | null;
        method: string;
        amount_cents: number;
        paid_at: string;
        description: string | null;
    }>;
    delivery_ledger: Array<{
        id: string;
        customer_id: string;
        customer_name: string | null;
        amount_cents: number;
        description: string | null;
        delivered_at: string;
    }>;
    movements: CashMovement[];
    counts: {
        sales: number;
        refunds: number;
        pix_avulso: number;
        debt_payments: number;
        delivery_settlements: number;
        delivery_ledger: number;
        movements: number;
    };
}

export interface CashClosing {
    id: string;
    session_id: string;
    version: number;
    closed_by_user_id: string;
    closed_by_name: string | null;
    closed_at: string;
    expected_cash_cents: number;
    counted_cash_cents: number;
    counted_count_json: DenominationCount | null;
    difference_cents: number;
    justification: string | null;
    expected_by_method_json: Record<string, number>;
    report_snapshot?: CashReportSnapshot | null;
}

export interface CashRectification {
    id: string;
    session_id: string;
    closing_id: string;
    reason: string;
    previous_values: {
        counted_cash_cents?: number;
        difference_cents?: number;
        justification?: string | null;
    };
    new_values: {
        counted_cash_cents?: number;
        difference_cents?: number;
        justification?: string | null;
    };
    rectified_by_user_id: string;
    rectified_by_name: string | null;
    document_id: string | null;
    created_at: string;
}

export interface CashEvent {
    id: string;
    session_id: string | null;
    closing_id: string | null;
    event_type: string;
    operator_user_id: string | null;
    auth_user_id: string | null;
    auth_user_name: string | null;
    device_key: string | null;
    ip_address: string | null;
    user_agent: string | null;
    amount_cents: number | null;
    reference_type: string | null;
    reference_id: string | null;
    payload: unknown;
    created_at: string;
}

export interface CashDocument {
    id: string;
    session_id: string;
    closing_id: string | null;
    rectification_id: string | null;
    kind: 'closing_report' | 'rectification_report';
    file_name: string;
    syno_path: string | null;
    cdn_url: string | null;
    status: 'pending' | 'uploaded' | 'failed';
    attempts: number;
    last_error: string | null;
    uploaded_at: string | null;
    created_at: string;
}

export interface CashReportSnapshot {
    generated_at: string;
    company: string;
    session: CashSession;
    closing: {
        id: string;
        version: number;
        closed_at: string;
        closed_by_user_id: string;
        closed_by_name: string | null;
        expected_cash_cents: number;
        counted_cash_cents: number;
        counted_count_json: DenominationCount | null;
        difference_cents: number;
        justification: string | null;
    };
    totals: {
        by_method: Record<string, number>;
        total_in_cents: number;
        expected_cash_cents: number;
        movements_in_cents: number;
        movements_out_cents: number;
    };
    sales: CashSaleSummary[];
    refunds: CashSessionSummary['refunds'];
    pix_avulso: CashSessionSummary['pix_avulso'];
    debt_payments: CashSessionSummary['debt_payments'];
    delivery_settlements: CashSessionSummary['delivery_settlements'];
    delivery_ledger: CashSessionSummary['delivery_ledger'];
    movements: CashMovement[];
    counts: CashSessionSummary['counts'];
}

export interface CashSessionDetail {
    session: CashSession;
    summary: CashSessionSummary;
    closings: CashClosing[];
    rectifications: CashRectification[];
    events: CashEvent[];
    documents: CashDocument[];
    rectified: boolean;
}

export interface OpenCashSessionInput {
    opening_amount_cents?: number;
    opening_count_json?: DenominationCount | null;
    notes?: string;
    device_key?: string;
}

export interface CloseCashSessionInput {
    counted_cash_cents?: number;
    counted_count_json?: DenominationCount | null;
    justification?: string;
    device_key?: string;
}

export interface CloseCashSessionResult {
    closing: {
        id: string;
        session_id: string;
        version: number;
        expected_cash_cents: number;
        counted_cash_cents: number;
        difference_cents: number;
        justification: string | null;
    };
    document_id: string;
    report_snapshot: CashReportSnapshot;
}

export const CASH_METHOD_LABELS: Record<string, string> = {
    money: 'Dinheiro',
    pix: 'PIX',
    debit: 'Cartão Débito',
    credit: 'Cartão Crédito',
    card: 'Cartão',
    a_prazo: 'A Prazo (Crediário)',
    saldo_entregas: 'Saldo de Entregas',
    other: 'Outros',
};

export const CASH_EVENT_LABELS: Record<string, string> = {
    opening: 'Caixa Aberto',
    closing: 'Caixa Fechado',
    reopening: 'Reabertura',
    rectification: 'Retificação',
    reprint: 'Reimpressão',
    sangria: 'Sangria',
    suprimento: 'Suprimento',
    deposito: 'Depósito',
    retirada: 'Retirada',
    sale_cancellation: 'Cancelamento de Venda',
    sale_refund: 'Estorno de Venda',
    report_uploaded: 'Relatório Arquivado',
    report_upload_failed: 'Falha no Arquivamento',
    report_upload_retry: 'Nova Tentativa de Arquivamento',
};

/** Calcula o total em centavos de uma contagem por denominacao. */
export function computeDenominationTotalCents(count: DenominationCount | null | undefined): number {
    if (!count) return 0;
    return CASH_DENOMINATIONS_CENTS.reduce((sum, denom) => {
        const qty = Number(count[String(denom)] || 0);
        return sum + (Number.isFinite(qty) && qty > 0 ? Math.trunc(qty) * denom : 0);
    }, 0);
}

const EMPTY_CASH_SUMMARY_COUNTS: CashSessionSummary['counts'] = {
    sales: 0,
    refunds: 0,
    pix_avulso: 0,
    debt_payments: 0,
    delivery_settlements: 0,
    delivery_ledger: 0,
    movements: 0,
};

function normalizeCashNumber(value: unknown, fallback = 0): number {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : fallback;
}

export function createEmptyCashSessionSummary(session?: CashSession | null): CashSessionSummary {
    const openingAmountCents = normalizeCashNumber(session?.opening_amount_cents);
    return {
        by_method: {},
        expected_cash_cents: openingAmountCents,
        total_in_cents: 0,
        movements_in_cents: openingAmountCents,
        movements_out_cents: 0,
        sales: [],
        refunds: [],
        pix_avulso: [],
        debt_payments: [],
        delivery_settlements: [],
        delivery_ledger: [],
        movements: [],
        counts: { ...EMPTY_CASH_SUMMARY_COUNTS },
    };
}

export function normalizeCashSessionSummary(
    summary: CashSessionSummary | null | undefined,
    session?: CashSession | null
): CashSessionSummary {
    const fallback = createEmptyCashSessionSummary(session);
    if (!summary) return fallback;
    return {
        by_method: summary.by_method && typeof summary.by_method === 'object' ? summary.by_method : fallback.by_method,
        expected_cash_cents: normalizeCashNumber(summary.expected_cash_cents, fallback.expected_cash_cents),
        total_in_cents: normalizeCashNumber(summary.total_in_cents, fallback.total_in_cents),
        movements_in_cents: normalizeCashNumber(summary.movements_in_cents, fallback.movements_in_cents),
        movements_out_cents: normalizeCashNumber(summary.movements_out_cents, fallback.movements_out_cents),
        sales: Array.isArray(summary.sales) ? summary.sales : [],
        refunds: Array.isArray(summary.refunds) ? summary.refunds : [],
        pix_avulso: Array.isArray(summary.pix_avulso) ? summary.pix_avulso : [],
        debt_payments: Array.isArray(summary.debt_payments) ? summary.debt_payments : [],
        delivery_settlements: Array.isArray(summary.delivery_settlements) ? summary.delivery_settlements : [],
        delivery_ledger: Array.isArray(summary.delivery_ledger) ? summary.delivery_ledger : [],
        movements: Array.isArray(summary.movements) ? summary.movements : [],
        counts: { ...EMPTY_CASH_SUMMARY_COUNTS, ...(summary.counts || {}) },
    };
}

export function formatCashCents(cents: number | null | undefined): string {
    return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
