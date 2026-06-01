import { vpsClient } from './vpsClient';

export interface DeliveryCredit {
    id: string;
    delivery_person_id: string;
    sale_id: string;
    amount: number;
    delivery_type: string;
    status: 'pending' | 'paid' | 'cancelled';
    created_at: string;
    updated_at?: string;
    paid_at?: string;
}

export interface DeliveryCreditRecord extends DeliveryCredit {
    customer_name?: string;
}

type DeliveryCreditInput = {
    delivery_person_id: string;
    sale_id: string;
    amount: number;
    delivery_type: string;
    status: 'pending' | 'paid' | 'cancelled';
};

type SaleRow = {
    id: string;
    customer_id?: string | null;
};

type CustomerRow = {
    id: string;
    name?: string | null;
};

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

async function loadTableData<T>(table: string, pageSize = 200): Promise<T[]> {
    let offset = 0;
    const rows: T[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<T>>(
            `/table-data/${table}?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

async function loadDeliveryCredits(pageSize = 200): Promise<DeliveryCredit[]> {
    let offset = 0;
    const rows: DeliveryCredit[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<DeliveryCredit>>(
            `/table-data/delivery_credits?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

function byNewestCreatedAt(a: DeliveryCredit, b: DeliveryCredit): number {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
}

async function enrichWithCustomerNames(credits: DeliveryCredit[]): Promise<DeliveryCreditRecord[]> {
    const saleIds = new Set(credits.map(credit => credit.sale_id).filter(Boolean));
    if (saleIds.size === 0) return credits.map(credit => ({ ...credit, customer_name: '-' }));

    const sales = (await loadTableData<SaleRow>('sales')).filter(sale => saleIds.has(sale.id));
    const customerIds = new Set(sales.map(sale => sale.customer_id).filter(Boolean) as string[]);
    const customers = customerIds.size > 0
        ? (await loadTableData<CustomerRow>('customers')).filter(customer => customerIds.has(customer.id))
        : [];

    const customerById = new Map(customers.map(customer => [customer.id, customer.name || '-']));
    const customerIdBySaleId = new Map(sales.map(sale => [sale.id, sale.customer_id || '']));

    return credits.map(credit => ({
        ...credit,
        customer_name: customerById.get(customerIdBySaleId.get(credit.sale_id) || '') || '-',
    }));
}

export const deliveryCreditService = {
    async create(input: DeliveryCreditInput): Promise<DeliveryCredit> {
        return vpsClient.post<DeliveryCredit>('/table-data/delivery_credits', input);
    },

    async listByDeliveryPersonId(deliveryPersonId: string): Promise<DeliveryCreditRecord[]> {
        const credits = (await loadDeliveryCredits())
            .filter(credit => credit.delivery_person_id === deliveryPersonId)
            .sort(byNewestCreatedAt);
        return enrichWithCustomerNames(credits);
    },

    async markPaid(id: string): Promise<DeliveryCredit> {
        return vpsClient.patch<DeliveryCredit>(`/table-data/delivery_credits/${id}`, {
            status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
    },

    async cancelBySaleId(saleId: string): Promise<void> {
        const credits = (await loadDeliveryCredits()).filter(credit => credit.sale_id === saleId);
        await Promise.all(credits.map(credit => (
            vpsClient.patch<DeliveryCredit>(`/table-data/delivery_credits/${credit.id}`, {
                status: 'cancelled',
                updated_at: new Date().toISOString(),
            })
        )));
    },
};
