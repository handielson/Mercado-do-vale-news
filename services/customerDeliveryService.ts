import { vpsClient } from './vpsClient';
import { toCents } from './customerDebtService';

export interface CustomerDeliveryLedgerEntry {
    id: string;
    customer_id: string;
    job_id?: string | null;
    sale_id?: string | null;
    order_number?: string | null;
    buyer_name?: string | null;
    delivery_address_text?: string | null;
    proof_image_url?: string | null;
    delivery_person_note?: string | null;
    amount: number | string;
    description: string;
    status: 'open' | 'settled' | 'cancelled';
    delivered_at: string;
    created_at?: string;
}

export interface CustomerDeliverySettlement {
    id: string;
    customer_id: string;
    ledger_id?: string | null;
    debt_id?: string | null;
    type: 'payment' | 'debt_offset';
    amount: number | string;
    paid_at: string;
    payment_method?: string | null;
    description: string;
    created_at?: string;
}

export interface CustomerDeliveryLedgerResponse {
    ledger: CustomerDeliveryLedgerEntry[];
    settlements: CustomerDeliverySettlement[];
    summary: {
        open_cents: number;
        earned_cents: number;
        settled_cents: number;
    };
}
export interface CustomerDeliveryPaymentResponse {
    id?: string | null;
    customer_id: string;
    type: 'payment';
    amount: number;
    settlement_amount: number;
    overpayment_amount: number;
    paid_at: string;
    payment_method?: string | null;
    description: string;
    overpayment_debt_id?: string | null;
}
export interface CustomerDeliveryJob {
    id: string;
    token: string;
    sale_id: string;
    order_number?: string | null;
    buyer_customer_id?: string | null;
    buyer_name: string;
    buyer_phone?: string | null;
    delivery_person_customer_id: string;
    delivery_amount: number | string;
    payment_amount: number | string;
    payment_status: 'not_required' | 'pending' | 'approved' | 'failed' | 'cancelled';
    delivery_status: 'pending' | 'in_route' | 'delivered' | 'cancelled';
    delivery_address_text: string;
    delivery_route_url?: string | null;
    receipt_snapshot_json?: {
        sale?: Record<string, unknown>;
        items?: Array<Record<string, unknown>>;
    };
    mercado_pago_payment_id?: string | null;
    qr_code?: string | null;
    qr_code_base64?: string | null;
    ticket_url?: string | null;
    pix_expires_at?: string | null;
    delivered_at?: string | null;
    admin_completion_reason?: string | null;
    completed_by_admin_at?: string | null;
    completion_whatsapp_sent_at?: string | null;
    completion_whatsapp_error?: string | null;
    route_whatsapp_sent_at?: string | null;
    route_whatsapp_error?: string | null;
}

export interface CustomerDeliverySettings {
    completion_whatsapp_enabled: boolean;
    completion_whatsapp_template: string;
}

export interface CustomerDeliveryJobLog {
    id: string;
    job_id: string;
    level: 'info' | 'warning' | 'error';
    event_type: string;
    message: string;
    details_json?: Record<string, unknown> | string | null;
    created_at: string;
}

export interface CustomerDeliveryProof {
    id: string;
    job_id: string;
    image_url: string;
    original_file_name?: string | null;
    compressed_size_bytes?: number | null;
    description?: string | null;
    created_at?: string | null;
}

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

export async function getCustomerDeliveryLedger(customerId: string): Promise<CustomerDeliveryLedgerResponse> {
    const data = await vpsClient.get<CustomerDeliveryLedgerResponse>(`/customers/${customerId}/delivery-ledger`);
    return {
        ledger: Array.isArray(data.ledger) ? data.ledger : [],
        settlements: Array.isArray(data.settlements) ? data.settlements : [],
        summary: {
            open_cents: toCents(data.summary?.open_cents),
            earned_cents: toCents(data.summary?.earned_cents),
            settled_cents: toCents(data.summary?.settled_cents),
        },
    };
}

export async function getCustomerDeliveryJobs(customerId: string): Promise<CustomerDeliveryJob[]> {
    const data = await vpsClient.get<{ jobs?: CustomerDeliveryJob[] }>(`/customers/${customerId}/delivery-jobs`);
    return Array.isArray(data.jobs) ? data.jobs : [];
}

export async function getCustomerDeliveryJobBySaleId(saleId: string): Promise<CustomerDeliveryJob | null> {
    const targetSaleId = String(saleId || '').trim();
    if (!targetSaleId) return null;

    const pageSize = 200;
    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse<CustomerDeliveryJob>>(
            `/table-data/customer_delivery_jobs?limit=${pageSize}&offset=${offset}`
        );
        const jobs = extractRows(data);
        const job = jobs.find((item) => String(item.sale_id || '') === targetSaleId);
        if (job) return job;
        if (jobs.length < pageSize) return null;
    }
}

export async function createDeliveryJobFromSale(saleId: string): Promise<CustomerDeliveryJob | null> {
    const data = await vpsClient.post<CustomerDeliveryJob | { skipped?: boolean }>('/delivery/jobs/from-sale', { sale_id: saleId });
    if ((data as { skipped?: boolean })?.skipped) return null;
    return data as CustomerDeliveryJob;
}

export async function getCustomerDeliverySettings(): Promise<CustomerDeliverySettings> {
    return vpsClient.get<CustomerDeliverySettings>('/delivery/settings');
}

export async function updateCustomerDeliverySettings(input: Partial<CustomerDeliverySettings>): Promise<CustomerDeliverySettings> {
    return vpsClient.patch<CustomerDeliverySettings>('/delivery/settings', input);
}

export async function getCustomerDeliveryJobLogs(token: string): Promise<CustomerDeliveryJobLog[]> {
    const data = await vpsClient.get<{ logs?: CustomerDeliveryJobLog[] }>(`/delivery/jobs/${encodeURIComponent(token)}/logs`);
    return Array.isArray(data.logs) ? data.logs : [];
}

export async function createCustomerDeliveryAdjustment(customerId: string, input: {
    amount: number;
    description: string;
    observation?: string;
    sale_id?: string;
    order_number?: string;
    cash_session_id?: string | null;
}): Promise<CustomerDeliveryLedgerEntry> {
    return vpsClient.post<CustomerDeliveryLedgerEntry>(`/customers/${customerId}/delivery-adjustments`, input);
}

export async function registerCustomerDeliveryPayment(customerId: string, input: { amount: number; description: string; paid_at?: string; payment_method?: string; cash_session_id?: string | null }): Promise<CustomerDeliveryPaymentResponse> {
    return vpsClient.post<CustomerDeliveryPaymentResponse>(`/customers/${customerId}/delivery-payments`, input);
}

export async function offsetCustomerDeliveryBalance(customerId: string, input: { debt_id: string; amount: number; description: string; cash_session_id?: string | null }) {
    return vpsClient.post(`/customers/${customerId}/delivery-offsets`, input);
}

export async function getDeliveryJob(token: string): Promise<{ job: CustomerDeliveryJob; proof?: CustomerDeliveryProof | null; proofs?: CustomerDeliveryProof[] }> {
    return vpsClient.get(`/delivery/jobs/${encodeURIComponent(token)}`);
}

export async function createDeliveryPixIntent(token: string): Promise<CustomerDeliveryJob> {
    return vpsClient.post(`/delivery/jobs/${encodeURIComponent(token)}/pix-intent`, {});
}

export async function refreshDeliveryPaymentStatus(token: string): Promise<CustomerDeliveryJob> {
    return vpsClient.post(`/delivery/jobs/${encodeURIComponent(token)}/payment-status`, {});
}

export async function startDeliveryRoute(token: string): Promise<CustomerDeliveryJob> {
    return vpsClient.post(`/delivery/jobs/${encodeURIComponent(token)}/start-route`, {});
}

export async function saveDeliveryProof(token: string, input: {
    image_url: string;
    original_file_name?: string;
    compressed_size_bytes?: number;
    description?: string;
}): Promise<CustomerDeliveryProof> {
    return vpsClient.post(`/delivery/jobs/${encodeURIComponent(token)}/proof`, input);
}

export async function completeDeliveryJob(token: string, input: { delivery_person_note?: string }): Promise<CustomerDeliveryJob> {
    return vpsClient.post(`/delivery/jobs/${encodeURIComponent(token)}/complete`, input);
}

export async function adminCompleteDeliveryJob(token: string, input: { admin_completion_reason: string; delivery_person_note?: string }): Promise<CustomerDeliveryJob> {
    return vpsClient.post(`/delivery/jobs/${encodeURIComponent(token)}/admin-complete`, input);
}
