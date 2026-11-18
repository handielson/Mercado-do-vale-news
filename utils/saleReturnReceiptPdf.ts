import jsPDF from 'jspdf';
import type { CompanySettings } from '@/types/companySettings';
import { REFUND_METHOD_LABELS, type SaleReturnRecord } from '@/services/saleReturnService';

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const when = (value?: string | null) => (value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '');

export interface ReturnReceiptInput {
    company: Partial<CompanySettings>;
    sale: { id: string; created_at?: string; items: Array<{ id: string; product_name: string; quantity: number; total: number }> };
    customer: { name?: string; cpf_cnpj?: string | null } | null;
    ret: SaleReturnRecord;
}

// Recibo de devolução: a cliente assina; com dinheiro, o recibo também é a declaração de recebimento.
export function buildReturnReceiptPdf({ company, sale, customer, ret }: ReturnReceiptInput): { blob: Blob; fileName: string } {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 16, width = 210 - margin * 2;
    let y = 18;
    const line = (text: string, size = 10, bold = false, gap = 5) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
        for (const part of doc.splitTextToSize(text, width)) { if (y > 280) { doc.addPage(); y = 18; } doc.text(part, margin, y); y += gap; }
    };
    const saleCode = sale.id.slice(0, 8).toUpperCase();
    line(company.company_name || 'Mercado do Vale', 14, true, 6);
    line([company.cnpj ? `CNPJ ${company.cnpj}` : '', company.address || '', company.phone || ''].filter(Boolean).join(' · '), 9);
    y += 3; line(`RECIBO DE DEVOLUÇÃO #${ret.code}`, 13, true, 7);
    line(`Data: ${when(ret.created_at)} · Venda original #${saleCode} de ${when(sale.created_at)}`);
    line(`Cliente: ${customer?.name || 'Não informado'}${customer?.cpf_cnpj ? ` · CPF/CNPJ ${customer.cpf_cnpj}` : ''}`);
    if (ret.operator_name) line(`Atendente: ${ret.operator_name}`);
    y += 2; line('Itens da venda original', 11, true, 6);
    for (const item of sale.items) line(`• ${item.quantity}× ${item.product_name} — ${brl(Math.round(Number(item.total) || 0))}`, 9);
    y += 2; line('Itens devolvidos', 11, true, 6);
    for (const item of ret.items) {
        const name = item.name || item.product_name || 'Item';
        line(`• ${item.quantity}× ${name}${item.imei ? ` · IMEI ${item.imei}` : ''} — ${brl(item.value_cents)}`, 10);
    }
    y += 2; line(`Total devolvido: ${brl(ret.total_cents)}`, 11, true, 6);
    line('Como o valor foi devolvido', 11, true, 6);
    for (const r of ret.refunds) line(`• ${REFUND_METHOD_LABELS[r.method] || r.method}: ${brl(r.refund_cents)}${r.gateway_refund_id ? ` (estorno Mercado Pago ${r.gateway_refund_id})` : ''}`, 10);
    line(`Motivo: ${ret.reason}`, 10);
    y += 8;
    if (ret.cash_cents > 0 && ret.cash_words) {
        line(`Declaro que recebi de ${company.company_name || 'Mercado do Vale'} a quantia de ${brl(ret.cash_cents)} (${ret.cash_words}) em dinheiro, referente à devolução dos itens acima da venda #${saleCode}.`, 10, false, 5);
        y += 6;
    }
    line('Declaro que devolvi os itens acima nas condições descritas.', 10);
    y += 18;
    doc.line(margin, y, margin + 90, y); y += 5;
    line(`${customer?.name || 'Cliente'}${customer?.cpf_cnpj ? ` · ${customer.cpf_cnpj}` : ''}`, 9);
    line('Assinatura da cliente', 8);
    return { blob: doc.output('blob'), fileName: `recibo-devolucao-${ret.code}.pdf` };
}
