import type { CompanySettings } from '../types/companySettings';

const fmt = (centavos: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    awaiting_payment: 'Aguardando pagamento',
    paid: 'Pago',
    payment_failed: 'Pagamento recusado',
    preparing: 'Em preparação',
    shipped: 'Enviado',
    delivered: 'Entregue',
    completed: 'Concluído',
    cancelled: 'Cancelado',
};

const PAYMENT_LABELS: Record<string, string> = {
    pix: 'PIX',
    credit: 'Cartão de Crédito',
    credit_card: 'Cartão de Crédito',
    debit: 'Cartão de Débito',
    debit_card: 'Cartão de Débito',
    on_delivery: 'Pagamento na entrega/retirada',
    money: 'Dinheiro',
};

interface OnlineOrderReceiptInput {
    id: string;
    created_at: string;
    status: string;
    total: number;
    discount_total?: number;
    delivery_total?: number;
    items: Array<{
        product_name: string;
        product_sku?: string | null;
        quantity: number;
        unit_price?: number;
        subtotal: number;
    }>;
    payment_methods?: Array<{ method: string; amount: number; installments?: number }>;
    delivery_type?: string;
    shipping_address?: {
        street?: string;
        number?: string;
        complement?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
        cep?: string;
    };
    shipping_cost?: number;
    payment_gateway?: string;
    gateway_payment_id?: string;
    gateway_pix_data?: { ticket_url?: string };
    customer_name?: string;
    customer_cpf?: string;
}

/**
 * Abre uma nova janela com o recibo do pedido online em formato A4-friendly e
 * dispara `window.print()` automaticamente. O cliente pode imprimir ou salvar
 * em PDF pelo dialog do navegador.
 */
export function printOnlineOrderReceipt(order: OnlineOrderReceiptInput, settings: CompanySettings | null) {
    const company = {
        name: settings?.company_name || 'Mercado do Vale',
        cnpj: settings?.cnpj || '',
        phone: settings?.phone || '',
        address: settings?.address || '',
        email: settings?.email || '',
    };

    const created = new Date(order.created_at);
    const dateStr = created.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = created.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const statusLabel = STATUS_LABELS[order.status] || order.status;

    const itemsHtml = order.items.map(item => {
        const unitPrice = item.unit_price ?? Math.round(item.subtotal / Math.max(1, item.quantity));
        return `
        <tr>
            <td>
                <div class="item-name">${escape(item.product_name)}</div>
                ${item.product_sku ? `<div class="item-sku">SKU: ${escape(item.product_sku)}</div>` : ''}
            </td>
            <td class="num">${item.quantity}</td>
            <td class="num">${fmt(unitPrice)}</td>
            <td class="num">${fmt(item.subtotal)}</td>
        </tr>`;
    }).join('');

    const payments = order.payment_methods || [];
    const paymentLine = payments.map(p => {
        const label = PAYMENT_LABELS[p.method] || p.method;
        const installmentSuffix = p.method === 'credit' && (p.installments || 1) > 1 ? ` ${p.installments}x` : '';
        return `${escape(label)}${installmentSuffix} — ${fmt(p.amount)}`;
    }).join(' / ') || '-';

    const subtotal = order.items.reduce((sum, it) => sum + it.subtotal, 0);

    const deliveryLine = order.delivery_type === 'pickup'
        ? 'Retirada na loja'
        : order.delivery_type === 'delivery'
            ? 'Entrega no endereço'
            : '-';

    const addr = order.shipping_address;
    const addressBlock = addr
        ? [
              [addr.street, addr.number].filter(Boolean).join(', '),
              addr.complement ? `Compl.: ${addr.complement}` : '',
              [addr.neighborhood, addr.city && addr.state ? `${addr.city}/${addr.state}` : (addr.city || addr.state)].filter(Boolean).join(' · '),
              addr.cep ? `CEP: ${addr.cep}` : '',
          ].filter(Boolean).map(line => `<div>${escape(line)}</div>`).join('')
        : '';

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Recibo do Pedido #${escape(order.id.slice(0, 8).toUpperCase())} — ${escape(company.name)}</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1f2937; margin: 0; padding: 24px; }
    .receipt { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin: 24px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .muted { color: #6b7280; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 16px; border-bottom: 2px solid #1f2937; }
    .header .left { flex: 1; }
    .header .right { text-align: right; font-size: 12px; color: #4b5563; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: #dcfce7; color: #166534; margin-top: 4px; }
    .badge.pending { background: #fef3c7; color: #92400e; }
    .badge.cancelled { background: #fee2e2; color: #991b1b; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; font-size: 13px; }
    .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding: 8px 6px; }
    table td { border-bottom: 1px solid #f3f4f6; padding: 10px 6px; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .item-name { font-weight: 500; }
    .item-sku { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    .totals { margin-top: 16px; }
    .totals .line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .totals .line.total { font-size: 16px; font-weight: 700; border-top: 1px solid #1f2937; margin-top: 6px; padding-top: 8px; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #6b7280; }
    @media print {
        body { padding: 0; }
        .no-print { display: none; }
        @page { margin: 16mm; }
    }
    .actions { margin: 12px 0 24px; display: flex; gap: 8px; justify-content: flex-end; }
    button { font: inherit; padding: 8px 16px; border-radius: 8px; border: 1px solid #d1d5db; background: white; cursor: pointer; }
    button.primary { background: #2563eb; color: white; border-color: #2563eb; }
</style>
</head>
<body>
<div class="receipt">
    <div class="actions no-print">
        <button onclick="window.close()">Fechar</button>
        <button class="primary" onclick="window.print()">Imprimir / Salvar PDF</button>
    </div>

    <div class="header">
        <div class="left">
            <h1>${escape(company.name)}</h1>
            <div class="muted">
                ${company.cnpj ? `CNPJ: ${escape(company.cnpj)}<br />` : ''}
                ${company.address ? `${escape(company.address)}<br />` : ''}
                ${company.phone ? `${escape(company.phone)}` : ''}${company.phone && company.email ? ' · ' : ''}${company.email ? escape(company.email) : ''}
            </div>
        </div>
        <div class="right">
            <div><strong>Pedido</strong></div>
            <div style="font-family: monospace; font-size: 14px;">#${escape(order.id.slice(0, 8).toUpperCase())}</div>
            <div>${dateStr} às ${timeStr}</div>
            <span class="badge ${order.status === 'cancelled' || order.status === 'payment_failed' ? 'cancelled' : (order.status === 'pending' || order.status === 'awaiting_payment' ? 'pending' : '')}">${escape(statusLabel)}</span>
        </div>
    </div>

    <h2>Cliente</h2>
    <div class="card">
        <div><strong>${escape(order.customer_name || '-')}</strong></div>
        ${order.customer_cpf ? `<div class="muted">CPF/CNPJ: ${escape(order.customer_cpf)}</div>` : ''}
    </div>

    <h2>Itens</h2>
    <table>
        <thead>
            <tr><th>Produto</th><th class="num">Qtd</th><th class="num">Unit.</th><th class="num">Subtotal</th></tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
    </table>

    <div class="totals">
        <div class="line"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
        ${order.discount_total ? `<div class="line"><span>Descontos</span><span style="color:#b91c1c">- ${fmt(order.discount_total)}</span></div>` : ''}
        ${order.delivery_total ? `<div class="line"><span>Frete / Entrega</span><span>+ ${fmt(order.delivery_total)}</span></div>` : ''}
        <div class="line total"><span>Total</span><span>${fmt(order.total)}</span></div>
    </div>

    <h2>Pagamento e entrega</h2>
    <div class="grid">
        <div class="card">
            <div class="label">Pagamento</div>
            <div>${escape(paymentLine)}</div>
            ${order.payment_gateway === 'mercado_pago' ? '<div class="muted" style="margin-top:4px;">Processado por Mercado Pago</div>' : ''}
            ${order.gateway_payment_id ? `<div class="muted" style="margin-top:2px; font-family: monospace; font-size: 11px;">ID: ${escape(order.gateway_payment_id)}</div>` : ''}
        </div>
        <div class="card">
            <div class="label">Entrega</div>
            <div><strong>${escape(deliveryLine)}</strong></div>
            ${addressBlock ? `<div class="muted" style="margin-top:4px;">${addressBlock}</div>` : ''}
        </div>
    </div>

    <div class="footer">
        Este é um recibo de comprovação de pedido. Para suporte, entre em contato com a loja.
    </div>
</div>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 200); };</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=900');
    if (!win) {
        alert('Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-up está desativado.');
        return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
}
