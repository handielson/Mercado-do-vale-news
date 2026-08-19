import jsPDF from 'jspdf';
import type { CompanySettings } from '@/types/companySettings';
import type { OrderWithItems } from '@/types/order';
import { formatCurrency } from '@/utils/saleCalculations';

export interface OrderRefundReceiptArtifact {
    blob: Blob;
    fileName: string;
    title: string;
    message: string;
}

export type OrderRefundReceiptShareResult = 'shared' | 'downloaded' | 'cancelled';

const PAYMENT_LABELS: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão de crédito',
    debit_card: 'Cartão de débito',
    on_delivery: 'Pagamento na entrega/retirada',
};

function formatDate(value?: string): string {
    if (!value) return 'Data não registrada';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Data não registrada';
    return parsed.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function normalizeWhatsAppNumber(value?: string): string {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('55') ? digits : `55${digits}`;
}

function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function generateOrderRefundReceiptPdf(
    order: OrderWithItems,
    company: CompanySettings,
): OrderRefundReceiptArtifact {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 16;
    const contentWidth = pageWidth - (margin * 2);
    const primary = [30, 64, 175] as [number, number, number];
    const purple = [126, 34, 206] as [number, number, number];
    const dark = [31, 41, 55] as [number, number, number];
    const muted = [100, 116, 139] as [number, number, number];
    const light = [248, 250, 252] as [number, number, number];
    let y = 17;

    const section = (title: string) => {
        doc.setFillColor(...light);
        doc.roundedRect(margin, y, contentWidth, 7, 1.2, 1.2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...primary);
        doc.text(title, margin + 3, y + 4.7);
        y += 11;
    };

    const line = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...dark);
        doc.text(`${label}:`, margin + 3, y);
        doc.setFont('helvetica', 'normal');
        const labelWidth = doc.getTextWidth(`${label}: `);
        const wrapped = doc.splitTextToSize(value || '-', contentWidth - labelWidth - 7);
        doc.text(wrapped, margin + 3 + labelWidth, y);
        y += Math.max(5, wrapped.length * 4.2);
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...primary);
    doc.text(String(company.company_name || 'Mercado do Vale').toUpperCase(), margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    const companyLines = [
        company.cnpj ? `CNPJ: ${company.cnpj}` : '',
        company.address || '',
        [company.phone, company.email].filter(Boolean).join('  |  '),
    ].filter(Boolean);
    for (const companyLine of companyLines) {
        doc.text(doc.splitTextToSize(companyLine, contentWidth), margin, y);
        y += 4;
    }

    y += 2;
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.7);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...purple);
    doc.text('COMPROVANTE DE ESTORNO', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(`Pedido #${order.id.slice(0, 8).toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
    y += 9;

    section('DADOS DO CLIENTE');
    line('Nome', order.customer_name || '-');
    line('WhatsApp', order.customer_phone || '-');
    if (order.customer_email) line('E-mail', order.customer_email);
    y += 3;

    section('DADOS DO ESTORNO');
    line('Situação', 'Pagamento estornado');
    line('Valor estornado', formatCurrency(order.refund_amount ?? order.total));
    line('Data do estorno', formatDate(order.refunded_at || order.updated_at));
    line('Forma de pagamento', PAYMENT_LABELS[order.payment_method] || order.payment_method || '-');
    line('Gateway', order.payment_gateway === 'mercado_pago' ? 'Mercado Pago' : (order.payment_gateway || '-'));
    if (order.refund_id) line('ID do estorno', order.refund_id);
    if (order.gateway_payment_id) line('ID do pagamento', order.gateway_payment_id);
    y += 3;

    section('ITENS DO PEDIDO');
    doc.setFontSize(8.5);
    for (const item of order.items) {
        if (y > 268) {
            doc.addPage();
            y = 18;
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...dark);
        const itemText = `${item.quantity}x ${item.product_name || 'Produto'}`;
        const wrapped = doc.splitTextToSize(itemText, 125);
        doc.text(wrapped, margin + 3, y);
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(item.subtotal), pageWidth - margin - 3, y, { align: 'right' });
        y += Math.max(5, wrapped.length * 4.2);
    }

    y += 4;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...purple);
    doc.text('TOTAL ESTORNADO', margin, y);
    doc.text(formatCurrency(order.refund_amount ?? order.total), pageWidth - margin, y, { align: 'right' });
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    const footer = 'Este documento comprova a solicitação de estorno registrada para o pedido acima. O prazo para o crédito aparecer depende da instituição financeira do cliente.';
    doc.text(doc.splitTextToSize(footer, contentWidth), margin, y);

    const reference = order.id.slice(0, 8).toUpperCase();
    return {
        blob: doc.output('blob'),
        fileName: `comprovante-estorno-${reference}.pdf`,
        title: `Comprovante de estorno #${reference}`,
        message: `Olá, ${order.customer_name}. Segue o comprovante em PDF do estorno do pedido #${reference}, no valor de ${formatCurrency(order.refund_amount ?? order.total)}.`,
    };
}

export function downloadOrderRefundReceiptPdf(artifact: OrderRefundReceiptArtifact): void {
    downloadBlob(artifact.blob, artifact.fileName);
}

export async function shareOrderRefundReceiptPdf(
    artifact: OrderRefundReceiptArtifact,
    customerPhone?: string,
): Promise<OrderRefundReceiptShareResult> {
    const file = new File([artifact.blob], artifact.fileName, { type: 'application/pdf' });
    const shareData: ShareData = { title: artifact.title, text: artifact.message, files: [file] };

    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        try {
            await navigator.share(shareData);
            return 'shared';
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
        }
    }

    downloadBlob(artifact.blob, artifact.fileName);
    const number = normalizeWhatsAppNumber(customerPhone);
    if (number) {
        window.open(`https://wa.me/${number}?text=${encodeURIComponent(`${artifact.message}\n\nO PDF foi baixado. Anexe o arquivo ${artifact.fileName} nesta conversa.`)}`, '_blank', 'noopener,noreferrer');
    }
    return 'downloaded';
}
