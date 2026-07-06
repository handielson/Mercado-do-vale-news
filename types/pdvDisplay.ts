import type { SaleItem } from './sale';

export type PdvDisplayType = 'cashier' | 'ads' | 'hybrid';
export type PdvDisplayOrientation = 'portrait' | 'landscape';
export type PdvPixPaymentStatus = 'idle' | 'creating' | 'pending' | 'approved' | 'rejected' | 'expired' | 'error';

export interface PdvDisplaySettings {
    showStoreName: boolean;
    showPixAmount: boolean;
    showItems: boolean;
    showInstructions: boolean;
    showAdsDuringPix: boolean;
    adRotationSeconds: number;
}

export interface PdvDisplayIdleContent {
    banners: Array<{
        id?: string;
        title?: string;
        image_url?: string;
        link_url?: string;
    }>;
    products: Array<{
        id?: string;
        product_id?: string;
        name: string;
        sku?: string;
        category_name?: string;
        price?: number;
        image_url?: string;
    }>;
    categories: Array<{
        id?: string;
        category_id: string;
        category_name?: string;
    }>;
    messages: string[];
    wifi?: {
        enabled?: boolean;
        ssid?: string;
        password?: string;
        password_confirm?: string;
        security: 'WPA' | 'WEP' | 'nopass';
    };
}

export interface PdvDisplay {
    id: string;
    name: string;
    slug: string;
    type: PdvDisplayType;
    orientation: PdvDisplayOrientation;
    cashier_key?: string | null;
    is_active: boolean;
    settings_json?: string | null;
    idle_content_json?: string | null;
    settings?: Partial<PdvDisplaySettings>;
    idle_content?: Partial<PdvDisplayIdleContent>;
    active_pix_payment_id?: string | null;
    paired_at?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface PdvDisplayInput {
    name: string;
    slug?: string;
    type: PdvDisplayType;
    orientation: PdvDisplayOrientation;
    cashier_key?: string | null;
    is_active?: boolean;
    settings?: Partial<PdvDisplaySettings>;
    idle_content?: Partial<PdvDisplayIdleContent>;
}

export interface PdvDisplayPairingCodeResponse {
    id: string;
    display_id: string;
    code: string;
    expires_minutes: number;
}

export interface PdvDisplayPairResponse {
    display_id: string;
    token: string;
}

export interface PdvPixPayment {
    id: string;
    sale_draft_id?: string | null;
    local_reference?: string | null;
    cashier_key?: string | null;
    display_id?: string | null;
    mercado_pago_payment_id?: string | null;
    amount: number;
    status: PdvPixPaymentStatus;
    qr_code?: string | null;
    qr_code_base64?: string | null;
    ticket_url?: string | null;
    raw_response?: unknown;
    created_at?: string;
    updated_at?: string;
    approved_at?: string | null;
    receipt?: PdvPixReceipt | null;
}

export interface PdvPixReceipt {
    payment_id: string;
    order_number: string;
    amount: number;
    amount_label: string;
    payment_method: 'Pix' | string;
    authentication_code: string;
    approved_at: string;
    approved_at_label: string;
    store_name: string;
    customer_name?: string | null;
    customer_first_name?: string | null;
    customer_phone_mask?: string | null;
    has_customer_phone?: boolean;
}

export interface PdvPixReceiptShareLinkResponse {
    token: string;
    url: string;
    expires_at: string | null;
    receipt: PdvPixReceipt;
}

export interface PdvPixReceiptShareResponse {
    receipt: PdvPixReceipt;
    expires_at: string | null;
}

export interface PdvPixReceiptWhatsAppInput {
    phone?: string;
    whatsapp?: string;
    customer_phone?: string;
    customer_name?: string;
    name?: string;
}

export interface PdvPixReceiptWhatsAppResponse {
    ok: boolean;
    phone_mask: string;
    receipt: PdvPixReceipt;
    result?: unknown;
}

export interface PdvPixPaymentInput {
    amount: number;
    sale_draft_id?: string | null;
    local_reference?: string;
    cashier_key?: string | null;
    display_id?: string | null;
    description?: string;
    payer_email?: string;
    expires_at?: string;
}

export interface PdvDisplayState {
    display: PdvDisplay;
    active_pix: PdvPixPayment | null;
}

export interface PdvPixPrintData {
    storeName: string;
    amount: number;
    qrCode: string;
    qrCodeBase64?: string | null;
    copyPasteCode: string;
    instructions: string;
    items: Array<Pick<SaleItem, 'product_name' | 'quantity' | 'total'>>;
}
