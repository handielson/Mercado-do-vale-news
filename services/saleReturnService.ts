import { vpsClient } from './vpsClient';
import { getAuthSessionToken } from './authSession';
import { buildVpsUrl } from './vpsProxyBase';
import { syncStockToBling } from './blingService';
import { cancelReferralReward } from './cashbackService';
import { deliveryCreditService } from './deliveryCreditService';

export type ReturnRefundMethod = 'money' | 'pix' | 'transfer' | 'card' | 'other' | 'credit' | 'debit' | string;

export interface ReturnableItem {
    saleItemId: string; productId: string | null; name: string; sku: string | null;
    quantity: number; returnedQuantity: number; returnableQuantity: number;
    unitValueCents: number; paidValueCents: number; serializedUnitId: string | null; imei: string | null;
}
export interface SaleReturnRefund {
    id?: string; method: ReturnRefundMethod; goods_cents: number; refund_cents: number;
    gateway_refund_id?: string | null; gateway_payment_id?: string | null; payment_index?: number | null;
}
export interface SaleReturnFile { id: string; kind: 'proof' | 'signed'; refund_id: string | null; file_name: string; mime: string; created_at: string }
export interface SaleReturnRecord {
    id: string; code: string; sale_id: string; status: 'pendente' | 'finalizada'; reason: string; total_cents: number;
    refund_mode: 'same' | 'other'; created_at: string; operator_name?: string | null;
    cash_cents: number; cash_words: string | null;
    items: Array<{ sale_item_id: string; name?: string; product_name?: string; sku?: string | null; quantity: number; value_cents: number; imei?: string | null; serialized_unit_id?: string | null }>;
    refunds: SaleReturnRefund[];
    files?: SaleReturnFile[]; missing_proofs?: string[]; missing_signed?: boolean; full?: boolean;
}
export interface SaleReturnPreview {
    preview: true; suggested_cents: number; total_cents: number; cash_cents: number; cash_words: string | null; refunds: SaleReturnRefund[];
}
export interface SaleReturnRequest {
    items: Array<{ sale_item_id: string; quantity: number }>;
    reason: string;
    amount_cents?: number;
    refund_mode: 'same' | 'other';
    refunds?: Array<{ method: string; amount_cents: number }>;
    cash_session_id?: string | null;
}

export const REFUND_METHOD_LABELS: Record<string, string> = {
    money: 'Dinheiro', cash: 'Dinheiro', pix: 'Pix', transfer: 'Transferência', card: 'Cartão',
    credit: 'Cartão de crédito', debit: 'Cartão de débito', other: 'Outro',
};

export function getSaleReturns(saleId: string) {
    return vpsClient.get<{ returnable: ReturnableItem[]; returns: SaleReturnRecord[] }>(`/admin/sales/${encodeURIComponent(saleId)}/returns`);
}

export function previewSaleReturn(saleId: string, body: SaleReturnRequest) {
    return vpsClient.post<SaleReturnPreview>(`/admin/sales/${encodeURIComponent(saleId)}/returns`, { ...body, dry_run: true });
}

// Grava a devolução e, como no cancelamento, devolve o estoque no Bling; venda inteira também estorna moedas e créditos de entrega.
export async function createSaleReturn(saleId: string, body: SaleReturnRequest, productIdsByItem: Map<string, string | null>) {
    const created = await vpsClient.post<SaleReturnRecord>(`/admin/sales/${encodeURIComponent(saleId)}/returns`, body);
    const notes = `Devolução #${created.code} da venda #${saleId.slice(0, 8).toUpperCase()}`;
    for (const item of body.items) {
        const productId = productIdsByItem.get(item.sale_item_id);
        if (productId) await syncStockToBling(productId, item.quantity, notes, { operation: 'E' }).catch(error => console.error('[devolução] Bling', error));
    }
    if (created.full) {
        await deliveryCreditService.cancelBySaleId(saleId).catch(error => console.error('[devolução] créditos de entrega', error));
        cancelReferralReward(saleId).catch(error => console.error('[devolução] moedas de indicação', error));
    }
    return created;
}

export async function listPendingReturns() {
    const data = await vpsClient.get<{ rows: SaleReturnRecord[] }>('/admin/sale-returns?status=pendente');
    return data.rows || [];
}

const toBase64 = (file: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
});

export async function uploadReturnFile(returnId: string, input: { kind: 'proof' | 'signed'; refundId?: string; file: File }) {
    return vpsClient.post<{ id: string; status: 'pendente' | 'finalizada' }>(`/admin/sale-returns/${encodeURIComponent(returnId)}/files`, {
        kind: input.kind, refund_id: input.refundId, file_name: input.file.name, file_base64: await toBase64(input.file),
    });
}

export async function sendReturnReceiptWhatsApp(returnId: string, pdf: Blob) {
    return vpsClient.post<{ status: string }>(`/admin/sale-returns/${encodeURIComponent(returnId)}/whatsapp`, { pdf_base64: await toBase64(pdf) });
}

export async function openReturnFile(returnId: string, fileId: string) {
    const token = await getAuthSessionToken();
    if (!token) throw new Error('Sessão expirada');
    const response = await fetch(buildVpsUrl(`/admin/sale-returns/${encodeURIComponent(returnId)}/files/${encodeURIComponent(fileId)}`, { method: 'GET' }), {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Arquivo indisponível (${response.status})`);
    const url = URL.createObjectURL(await response.blob());
    window.open(url, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
