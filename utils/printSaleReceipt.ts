import { SaleWithItems } from '../types/sale';
import { CompanySettings } from '../types/companySettings';

const fmt = (v: number) => `R$ ${(v / 100).toFixed(2).replace('.', ',')}`;

const paymentLabel = (method: string, installments?: number) => {
    const labels: Record<string, string> = {
        money: 'Dinheiro', pix: 'PIX', credit: 'Crédito', debit: 'Débito',
    };
    const base = labels[method] || method;
    return method === 'credit' && installments && installments > 1
        ? `${base} ${installments}x`
        : base;
};

const deliveryLabel = (type: string) => {
    if (!type) return '-';
    const labels: Record<string, string> = {
        pickup: 'Retirada na Loja',
        store_pickup: 'Retirada na Loja',
        delivery: 'Entrega pela Loja',
        store_delivery: 'Entrega pela Loja',
        hybrid: 'Entrega Híbrida',
        hybrid_delivery: 'Entrega Híbrida',
    };
    return labels[type] || type;
};

/**
 * Generates HTML for a sale receipt and opens a print window.
 */
export function printSaleReceipt(
    sale: SaleWithItems,
    settings: CompanySettings,
    productSpecs?: Record<string, Record<string, string>>
) {
    const logo = (settings as any).logo || settings.receipt_logo_url || '';
    const companyName = settings.company_name || 'Mercado do Vale';
    const saleDate = new Date(sale.created_at);
    const payments: any[] = (sale as any).payment_methods || [];
    const discountTotal = sale.discount_total || 0;
    const deliveryTotal = (sale as any).delivery_total || 0;

    const logoHtml = logo
        ? `<img src="${logo}" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain;" />`
        : '';

    const itemsHtml = sale.items.map(item => {
        const specs = productSpecs?.[(item as any).product_id] || {};
        const idParts: string[] = [];
        if (specs.imei1) idParts.push(`IMEI 1: ${specs.imei1}`);
        if (specs.imei2) idParts.push(`IMEI 2: ${specs.imei2}`);
        if (specs.serial) idParts.push(`Serial: ${specs.serial}`);
        const identifier = idParts.length > 0 ? idParts.join(' | ') : ((item as any).product_sku ? `SKU: ${(item as any).product_sku}` : '');

        return `
        <tr>
            <td style="padding:4px 0;font-size:13px;color:#374151;">
                ${item.quantity > 1 ? `<span style="color:#6b7280">${item.quantity}x </span>` : ''}
                ${item.product_name}
                ${item.is_gift ? '<span style="font-size:10px;background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:4px;margin-left:4px;">BRINDE</span>' : ''}
                ${identifier ? `<br><span style="font-size:11px;color:#9ca3af;">${identifier}</span>` : ''}
            </td>
            <td style="padding:4px 0;text-align:right;font-size:13px;font-family:monospace;white-space:nowrap;">
                ${item.is_gift ? '<span style="color:#059669">Grátis</span>' : fmt(item.total)}
            </td>
        </tr>`;
    }).join('');

    const paymentsHtml = payments.map(p => `
        <tr>
            <td style="padding:3px 0;font-size:13px;color:#374151;">${paymentLabel(p.method, p.installments)}</td>
            <td style="padding:3px 0;text-align:right;font-size:13px;font-family:monospace;">${fmt(p.total_with_fee || p.amount)}</td>
        </tr>`).join('');

    const customerSection = sale.customer ? `
        <div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px dashed #d1d5db;">
            <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0 0 6px;">Cliente</p>
            <p style="margin:0;font-size:13px;font-weight:600;color:#111827;">${sale.customer.name}</p>
            ${sale.customer.cpf_cnpj ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280;">CPF/CNPJ: ${sale.customer.cpf_cnpj}</p>` : ''}
        </div>` : '';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Recibo de Venda</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f8fafc; display: flex; justify-content: center; padding: 20px; }
    .receipt {
        background: white;
        width: 360px;
        padding: 24px;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    }
    .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 2px solid #e5e7eb; }
    .separator { border: none; border-top: 1px dashed #d1d5db; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; }
    .total-row td { padding: 4px 0; font-weight: 700; font-size: 15px; color: #111827; border-top: 2px solid #e5e7eb; }
    .footer { margin-top: 16px; padding-top: 12px; border-top: 1px dashed #d1d5db; text-align: center; font-size: 11px; color: #9ca3af; }
    @media print {
        body { background: white; padding: 0; }
        .receipt { box-shadow: none; border-radius: 0; width: 100%; }
    }
</style>
</head>
<body>
<div class="receipt">
    <div class="header">
        <div>${logoHtml}</div>
        <div style="text-align:right;">
            <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Comprovante de Venda</p>
            <p style="font-size:16px;font-weight:800;color:#111827;">${companyName}</p>
            ${settings.cnpj ? `<p style="font-size:11px;color:#6b7280;">CNPJ: ${settings.cnpj}</p>` : ''}
            ${settings.phone ? `<p style="font-size:11px;color:#6b7280;">Tel: ${settings.phone}</p>` : ''}
        </div>
    </div>

    <div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px dashed #d1d5db;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
                <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0 0 2px;">Pedido</p>
                <p style="font-size:16px;font-weight:800;color:#2563eb;">#${sale.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div style="text-align:right;">
                <p style="font-size:11px;color:#6b7280;">${saleDate.toLocaleDateString('pt-BR')}</p>
                <p style="font-size:11px;color:#6b7280;">${saleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
        </div>
    </div>

    ${customerSection}

    <div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px dashed #d1d5db;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0 0 8px;">Itens</p>
        <table>${itemsHtml}</table>
    </div>

    <div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px dashed #d1d5db;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0 0 8px;">Resumo</p>
        <table>
            ${discountTotal > 0 ? `<tr><td style="padding:3px 0;font-size:13px;color:#374151;">Descontos</td><td style="padding:3px 0;text-align:right;font-size:13px;font-family:monospace;color:#dc2626;">- ${fmt(discountTotal)}</td></tr>` : ''}
            ${deliveryTotal > 0 ? `<tr><td style="padding:3px 0;font-size:13px;color:#374151;">Entrega (${deliveryLabel(sale.delivery_type || '')})</td><td style="padding:3px 0;text-align:right;font-size:13px;font-family:monospace;">+ ${fmt(deliveryTotal)}</td></tr>` : ''}
            <tr class="total-row"><td>TOTAL</td><td style="text-align:right;font-family:monospace;">${fmt(sale.total)}</td></tr>
        </table>
    </div>

    <div style="margin-bottom:16px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0 0 8px;">Pagamento</p>
        <table>${paymentsHtml}</table>
    </div>

    <div class="footer">
        <p>Obrigado pela preferência! 💙</p>
        <p style="margin-top:4px;">${companyName}</p>
    </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

    const pw = window.open('', '_blank');
    if (!pw) return;
    pw.document.write(html);
    pw.document.close();
}
