import type {
    TypeUpgradeRequest,
    TypeUpgradeRequestWithCustomer,
    RequestedCustomerType,
    TypeUpgradeRequestStatus
} from '../types/typeUpgradeRequest';
import { vpsClient } from './vpsClient';

interface TableDataResponse<T> {
    rows?: T[];
}

interface CustomerSummary {
    id: string;
    name: string;
    email: string;
    cpf_cnpj?: string;
    phone?: string;
}

async function loadTableRows<T>(table: string, pageSize = 200): Promise<T[]> {
    const allRows: T[] = [];

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse<T>>(
            `/table-data/${table}?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return allRows;
}

function sortNewestFirst<T extends { created_at?: string; requested_at?: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => {
        const aDate = a.created_at || a.requested_at || '';
        const bDate = b.created_at || b.requested_at || '';
        return bDate.localeCompare(aDate);
    });
}

async function loadUpgradeRequests(): Promise<TypeUpgradeRequest[]> {
    return sortNewestFirst(await loadTableRows<TypeUpgradeRequest>('customer_type_requests'));
}

async function findUpgradeRequest(id: string): Promise<TypeUpgradeRequest | null> {
    const rows = await loadUpgradeRequests();
    return rows.find(row => String(row.id) === String(id)) || null;
}

/**
 * Create a new type upgrade request
 */
export const createUpgradeRequest = async (
    customerId: string,
    requestedType: RequestedCustomerType
): Promise<TypeUpgradeRequest> => {
    void customerId;
    return vpsClient.post<TypeUpgradeRequest>('/customer/type-upgrade', {
        requested_type: requestedType,
    });
};

/**
 * Get current upgrade request status for a customer
 */
export const getCustomerUpgradeRequest = async (
    customerId: string
): Promise<TypeUpgradeRequest | null> => {
    void customerId;
    return vpsClient.get<TypeUpgradeRequest | null>('/customer/type-upgrade');
};

/**
 * Get all upgrade requests (admin only)
 */
export const getAllUpgradeRequests = async (
    status?: TypeUpgradeRequestStatus
): Promise<TypeUpgradeRequestWithCustomer[]> => {
    const [requests, customers] = await Promise.all([
        loadUpgradeRequests(),
        loadTableRows<CustomerSummary>('customers', 500)
    ]);
    const customersById = new Map(customers.map(customer => [String(customer.id), customer]));

    return requests
        .filter(request => !status || request.status === status)
        .map(request => ({
            ...request,
            customer: customersById.get(String(request.customer_id)) || {
                id: request.customer_id,
                name: '',
                email: ''
            }
        }));
};

/**
 * Approve upgrade request (admin only)
 */
export const approveUpgradeRequest = async (
    requestId: string,
    reviewerId: string
): Promise<void> => {
    const request = await findUpgradeRequest(requestId);
    if (!request) throw new Error('Solicitacao nao encontrada');

    await vpsClient.patch(
        `/table-data/customers/${encodeURIComponent(request.customer_id)}?pk=id`,
        { customer_type: 'RESELLER' }
    );

    await vpsClient.patch(
        `/table-data/customer_type_requests/${encodeURIComponent(requestId)}?pk=id`,
        {
            status: 'approved',
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString()
        }
    );
};

/**
 * Reject upgrade request (admin only)
 */
export const rejectUpgradeRequest = async (
    requestId: string,
    reviewerId: string,
    reason?: string
): Promise<void> => {
    await vpsClient.patch(
        `/table-data/customer_type_requests/${encodeURIComponent(requestId)}?pk=id`,
        {
            status: 'rejected',
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString(),
            rejection_reason: reason || null
        }
    );
};

/**
 * Get upgrade request statistics (admin only)
 */
export const getUpgradeRequestStats = async (): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
}> => {
    const requests = await loadUpgradeRequests();

    return requests.reduce(
        (stats, request) => {
            if (request.status === 'pending') stats.pending++;
            if (request.status === 'approved') stats.approved++;
            if (request.status === 'rejected') stats.rejected++;
            stats.total++;
            return stats;
        },
        {
            pending: 0,
            approved: 0,
            rejected: 0,
            total: 0
        }
    );
};
