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
