import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CashReportSnapshot } from '../types/cashRegister';
import { CASH_METHOD_LABELS, formatCashCents } from '../types/cashRegister';

function formatDateTime(value?: string | null): string {
    return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

export function buildCashReportPdf(snapshot: CashReportSnapshot): jsPDF {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const session = snapshot.session;
    const closing = snapshot.closing;

    doc.setFontSize(16);
    doc.text(snapshot.company || 'Mercado do Vale', 14, 16);
    doc.setFontSize(12);
    doc.text(`Fechamento de Caixa #${session.session_number}`, 14, 23);
    doc.setFontSize(9);
    doc.text(`Operador: ${session.operator_name || session.operator_user_id}`, 14, 30);
    doc.text(`Abertura: ${formatDateTime(session.opened_at)}`, 14, 35);
    doc.text(`Fechamento: ${formatDateTime(closing.closed_at)}`, 14, 40);
    doc.text(`Versao do fechamento: ${closing.version}`, 14, 45);

    autoTable(doc, {
        startY: 51,
        head: [['Forma de pagamento', 'Valor']],
        body: Object.entries(snapshot.totals.by_method || {}).map(([method, amount]) => [
            CASH_METHOD_LABELS[method] || method,
            formatCashCents(amount),
        ]),
        theme: 'grid',
        styles: { fontSize: 8 },
    });

    const methodTableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 60;
    autoTable(doc, {
        startY: methodTableEnd + 5,
        head: [['Conferencia do dinheiro', 'Valor']],
        body: [
            ['Fundo de abertura', formatCashCents(session.opening_amount_cents)],
            ['Dinheiro esperado', formatCashCents(closing.expected_cash_cents)],
            ['Dinheiro contado', formatCashCents(closing.counted_cash_cents)],
            ['Diferenca', formatCashCents(closing.difference_cents)],
        ],
        theme: 'grid',
        styles: { fontSize: 8 },
    });

    const totalsEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || methodTableEnd + 30;
    autoTable(doc, {
        startY: totalsEnd + 5,
        head: [['Venda', 'Cliente', 'Data', 'Total']],
        body: (snapshot.sales || []).map((sale) => [
            sale.id.slice(0, 8).toUpperCase(),
            sale.customer_name || 'Consumidor',
            formatDateTime(sale.created_at),
            formatCashCents(sale.total_cents),
        ]),
        theme: 'striped',
        styles: { fontSize: 7 },
        headStyles: { fillColor: [15, 118, 110] },
    });

    if (closing.justification) {
        const endY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || totalsEnd + 20;
        const y = endY + 7;
        if (y > 275) doc.addPage();
        const targetY = y > 275 ? 16 : y;
        doc.setFontSize(9);
        doc.text('Justificativa da diferenca:', 14, targetY);
        doc.setFontSize(8);
        doc.text(doc.splitTextToSize(closing.justification, 180), 14, targetY + 5);
    }

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text(`Gerado em ${formatDateTime(snapshot.generated_at)} - pagina ${page}/${pageCount}`, 14, 290);
    }

    return doc;
}

export function cashReportPdfBase64(snapshot: CashReportSnapshot): string {
    const buffer = buildCashReportPdf(snapshot).output('arraybuffer');
    return bytesToBase64(new Uint8Array(buffer));
}

export function downloadCashReportPdf(snapshot: CashReportSnapshot, fileName?: string): void {
    buildCashReportPdf(snapshot).save(fileName || `fechamento-caixa-${snapshot.session.session_number}.pdf`);
}
