import { vpsClient } from './vpsClient';

interface CustomerDebtRow {
    id: string;
    valor_total?: number;
    saldo_devedor?: number;
    status?: string;
    data_vencimento?: string;
}

interface CustomerDebtResponse {
    rows?: CustomerDebtRow[];
    total?: number;
}

export interface CustomerFinancialSummary {
    totalDebts: number;
    openDebts: number;
    overdueDebts: number;
    paidDebts: number;
    totalDebtCents: number;
    openBalanceCents: number;
    overdueBalanceCents: number;
    paidTotalCents: number;
}

function isOverdue(dateValue?: string): boolean {
    if (!dateValue) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(`${dateValue}T00:00:00`);
    return dueDate < today;
}

function normalizeDebtStatus(status?: string): string {
    return String(status || '').toLowerCase();
}

export async function getCustomerFinancialSummary(customerId: string): Promise<CustomerFinancialSummary> {
    const data = await vpsClient.get<CustomerDebtResponse>(
        `/financial/customer-debts?customer_id=${encodeURIComponent(customerId)}&limit=200`
    );
    const rows = Array.isArray(data.rows) ? data.rows : [];

    return rows.reduce<CustomerFinancialSummary>((summary, debt) => {
        const status = normalizeDebtStatus(debt.status);
        const total = Number(debt.valor_total || 0);
        const balance = Number(debt.saldo_devedor || 0);
        const paid = Math.max(0, total - balance);
        const paidOff = status === 'paid' || balance <= 0;
        const cancelled = status === 'cancelled' || status === 'canceled';
        const overdue = !paidOff && !cancelled && isOverdue(debt.data_vencimento);

        summary.totalDebts += 1;
        summary.totalDebtCents += total;
        summary.paidTotalCents += paidOff ? total : paid;

        if (paidOff) {
            summary.paidDebts += 1;
        } else if (!cancelled) {
            summary.openDebts += 1;
            summary.openBalanceCents += balance;
            if (overdue) {
                summary.overdueDebts += 1;
                summary.overdueBalanceCents += balance;
            }
        }

        return summary;
    }, {
        totalDebts: 0,
        openDebts: 0,
        overdueDebts: 0,
        paidDebts: 0,
        totalDebtCents: 0,
        openBalanceCents: 0,
        overdueBalanceCents: 0,
        paidTotalCents: 0,
    });
}
