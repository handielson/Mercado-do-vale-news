import { vpsClient } from './vpsClient';

export type WarrantyPdfWhatsAppResult = {
    status: 'sent' | 'failed' | 'skipped';
    error?: string;
    file_name?: string;
};

export async function sendSaleWarrantyPdfWhatsApp(
    saleId: string,
    pdfBase64: string
): Promise<WarrantyPdfWhatsAppResult> {
    return vpsClient.post<WarrantyPdfWhatsAppResult>('/whatsapp/automation/sale-warranty-pdf', {
        sale_id: saleId,
        pdf_base64: pdfBase64,
    });
}
