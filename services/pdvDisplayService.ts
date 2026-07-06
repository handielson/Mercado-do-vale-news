import { vpsClient } from './vpsClient';
import type {
    PdvDisplay,
    PdvDisplayInput,
    PdvDisplayPairResponse,
    PdvDisplayPairingCodeResponse,
    PdvDisplayState,
    PdvPixReceiptShareLinkResponse,
    PdvPixReceiptShareResponse,
    PdvPixReceiptWhatsAppInput,
    PdvPixReceiptWhatsAppResponse,
    PdvPixPayment,
    PdvPixPaymentInput,
    PdvPixPaymentStatus,
    PdvPixPrintData,
} from '../types/pdvDisplay';
import type { SaleItem } from '../types/sale';

export function normalizePdvPixStatus(status: unknown): PdvPixPaymentStatus {
    const value = String(status || '').toLowerCase();
    if (!value) return 'idle';
    if (value === 'approved') return 'approved';
    if (value === 'rejected' || value === 'cancelled' || value === 'canceled' || value === 'refunded') return 'rejected';
    if (value === 'expired') return 'expired';
    if (value === 'pending' || value === 'in_process' || value === 'authorized' || value === 'created') return 'pending';
    if (value === 'creating') return 'creating';
    return 'error';
}

export function buildPdvPixPrintData(input: {
    payment: PdvPixPayment;
    storeName?: string;
    items?: SaleItem[];
    instructions?: string;
}): PdvPixPrintData {
    const qrCode = input.payment.qr_code || '';
    return {
        storeName: input.storeName || 'Mercado do Vale',
        amount: Number(input.payment.amount || 0),
        qrCode,
        qrCodeBase64: input.payment.qr_code_base64 || null,
        copyPasteCode: qrCode,
        instructions: input.instructions || 'Aponte a camera para o QR Code ou use o Pix copia e cola.',
        items: (input.items || []).map((item) => ({
            product_name: item.product_name,
            quantity: item.quantity,
            total: item.total,
        })),
    };
}

export const pdvDisplayService = {
    async listDisplays(): Promise<PdvDisplay[]> {
        return vpsClient.get<PdvDisplay[]>('/pdv/displays');
    },

    async createDisplay(input: PdvDisplayInput): Promise<PdvDisplay> {
        return vpsClient.post<PdvDisplay>('/pdv/displays', input);
    },

    async updateDisplay(id: string, input: Partial<PdvDisplayInput>): Promise<PdvDisplay> {
        return vpsClient.patch<PdvDisplay>(`/pdv/displays/${encodeURIComponent(id)}`, input);
    },

    async deleteDisplay(id: string): Promise<void> {
        await vpsClient.delete(`/pdv/displays/${encodeURIComponent(id)}`);
    },

    async generatePairingCode(displayId: string, expiresMinutes?: number): Promise<PdvDisplayPairingCodeResponse> {
        return vpsClient.post<PdvDisplayPairingCodeResponse>(`/pdv/displays/${encodeURIComponent(displayId)}/pairing-code`, {
            expires_minutes: expiresMinutes,
        });
    },

    async pairDisplay(code: string): Promise<PdvDisplayPairResponse> {
        return vpsClient.post<PdvDisplayPairResponse>('/pdv/displays/pair', { code });
    },

    async revokeDisplayToken(displayId: string): Promise<void> {
        await vpsClient.post(`/pdv/displays/${encodeURIComponent(displayId)}/revoke-token`, {});
    },

    async cleanupTrash(): Promise<{ ok: boolean; deleted: Record<string, number> }> {
        return vpsClient.post('/pdv/displays/trash/cleanup', {});
    },

    async createPixPayment(input: PdvPixPaymentInput): Promise<PdvPixPayment> {
        const payment = await vpsClient.post<PdvPixPayment>('/pdv/pix-payments', input);
        return { ...payment, status: normalizePdvPixStatus(payment.status) };
    },

    async refreshPixPaymentStatus(id: string): Promise<PdvPixPayment> {
        const payment = await vpsClient.get<PdvPixPayment>(`/pdv/pix-payments/${encodeURIComponent(id)}/status`);
        return { ...payment, status: normalizePdvPixStatus(payment.status) };
    },

    async setActivePix(displayId: string, pixPaymentId: string): Promise<void> {
        await vpsClient.post(`/pdv/displays/${encodeURIComponent(displayId)}/active-pix`, {
            pix_payment_id: pixPaymentId,
        });
    },

    async clearActivePix(displayId: string): Promise<void> {
        await vpsClient.delete(`/pdv/displays/${encodeURIComponent(displayId)}/active-pix`);
    },

    async clearDisplayVisual(displayId: string): Promise<void> {
        await vpsClient.post(`/pdv/displays/${encodeURIComponent(displayId)}/clear-visual`, {});
    },

    async getDisplayState(token: string): Promise<PdvDisplayState> {
        return vpsClient.get<PdvDisplayState>('/pdv/display-state' + `?token=${encodeURIComponent(token)}`);
    },

    async createPixReceiptShareLink(
        pixPaymentId: string,
        input: PdvPixReceiptWhatsAppInput = {}
    ): Promise<PdvPixReceiptShareLinkResponse> {
        return vpsClient.post<PdvPixReceiptShareLinkResponse>(
            `/pdv/pix-payments/${encodeURIComponent(pixPaymentId)}/receipt/share-link`,
            input
        );
    },

    async createDisplayPixReceiptShareLink(
        pixPaymentId: string,
        displayToken: string
    ): Promise<PdvPixReceiptShareLinkResponse> {
        return vpsClient.post<PdvPixReceiptShareLinkResponse>(
            `/pdv/display/pix-payments/${encodeURIComponent(pixPaymentId)}/receipt/share-link`,
            { token: displayToken }
        );
    },

    async sendPixReceiptWhatsApp(
        pixPaymentId: string,
        input: PdvPixReceiptWhatsAppInput
    ): Promise<PdvPixReceiptWhatsAppResponse> {
        return vpsClient.post<PdvPixReceiptWhatsAppResponse>(
            `/pdv/pix-payments/${encodeURIComponent(pixPaymentId)}/receipt/whatsapp`,
            input
        );
    },

    async getTemporaryPixReceipt(token: string): Promise<PdvPixReceiptShareResponse> {
        return vpsClient.get<PdvPixReceiptShareResponse>(`/pdv/receipt-share/${encodeURIComponent(token)}`);
    },
};
