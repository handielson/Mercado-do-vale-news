import { vpsClient } from './vpsClient';

export interface LegacyCustomerPurchaseItem {
    description: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    identifier?: string | null;
}

export interface LegacyCustomerPurchase {
    id: string;
    legacy_sale_id: string;
    customer_id: string;
    sale_date: string;
    total: number;
    payment_method?: string | null;
    installments?: number | null;
    notes?: string | null;
    items: LegacyCustomerPurchaseItem[];
}

interface TableDataResponse<T> {
    rows?: T[];
}

function parseJsonField<T>(value: unknown, fallback: T): T {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value as T;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function normalizeMoneyCents(value: unknown): number {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount);
}

function normalizePurchase(row: any): LegacyCustomerPurchase {
    return {
        id: String(row.id || row.legacy_sale_id || ''),
        legacy_sale_id: String(row.legacy_sale_id || row.id || ''),
        customer_id: String(row.customer_id || ''),
        sale_date: String(row.sale_date || row.created_at || ''),
        total: normalizeMoneyCents(row.total),
        payment_method: row.payment_method || null,
        installments: row.installments == null ? null : Number(row.installments),
        notes: row.notes || null,
        items: parseJsonField<LegacyCustomerPurchaseItem[]>(row.items_json, []).map((item) => ({
            description: String(item.description || 'Item do sistema antigo'),
            quantity: Number(item.quantity) || 1,
            unit_price: normalizeMoneyCents(item.unit_price),
            subtotal: normalizeMoneyCents(item.subtotal),
            identifier: item.identifier || null,
        })),
    };
}

export async function getLegacyCustomerPurchases(customerId: string): Promise<LegacyCustomerPurchase[]> {
    const allRows: any[] = [];
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse<any>>(
            `/table-data/legacy_customer_purchases?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return allRows
        .map(normalizePurchase)
        .filter((purchase) => String(purchase.customer_id || '') === String(customerId))
        .sort((a, b) => String(b.sale_date || '').localeCompare(String(a.sale_date || '')));
}
