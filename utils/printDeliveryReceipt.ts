import type { OrderWithItems } from '../types/order';
import type { CompanySettings } from '../types/companySettings';
import { buildGlobalHeader, getHeaderTemplate } from './headerBuilder';
import { companySettingsService } from '../services/companySettingsService';
import { vpsApiService } from '../services/vpsApiService';

const fmt = (v: number) => `R$ ${((v || 0) / 100).toFixed(2).replace('.', ',')}`;

export async function printDeliveryReceipt(order: OrderWithItems, settings: CompanySettings) {
    const rawCabecalho = getHeaderTemplate('default_a4_header', settings);
    const cabecalhoHTML = buildGlobalHeader(rawCabecalho, settings, 'COMPROVANTE DE ENTREGA');

    const dataEmissao = new Date().toLocaleDateString('pt-BR');
    const horaEmissao = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const addressBlock = order.shipping_address
        ? `${order.shipping_address.street}, ${order.shipping_address.number}${order.shipping_address.complement ? `, ${order.shipping_address.complement}` : ''} — ${order.shipping_address.neighborhood}, ${order.shipping_address.city}/${order.shipping_address.state} · CEP: ${order.shipping_address.cep}`
        : 'Retirada na loja';

    // Carrega units do pedido pra mostrar IMEI/serial por item serializado
    const units = await vpsApiService.getUnitsByOrder(order.id).catch(() => null);
    const unitByItemId = new Map<string, any>();
    (units || []).forEach((u: any) => {
        const itemId = (order.items as any[]).find((it: any) => it.serialized_unit_id === u.id)?.id;
        if (itemId) unitByItemId.set(itemId, u);
    });

    const itemsHTML = order.items.map((item: any) => {
        const isWarranty = item.product_name?.startsWith('Garantia Estendida');
        const coveredProduct = isWarranty ? (item.product_name.split(' \u2014 ')[1] || '') : '';
        const colorTag = !isWarranty && item.product_color
            ? ` <span style="color:#666;font-size:11px;">(${item.product_color})</span>`
            : '';
        const skuTag = !isWarranty && item.product_sku
            ? `<br><span style="font-size:10px;color:#999;font-family:monospace;">SKU: ${item.product_sku}</span>`
            : '';
        const coveredTag = isWarranty && coveredProduct
            ? `<br><span style="font-size:10px;color:#1d4ed8;">🛡️ Cobre: ${coveredProduct}</span>`
            : '';
        const unit = unitByItemId.get(item.id);
        const unitParts: string[] = [];
        if (unit?.imei_1) unitParts.push(`IMEI 1: ${unit.imei_1}`);
        if (unit?.imei_2) unitParts.push(`IMEI 2: ${unit.imei_2}`);
        if (unit?.serial) unitParts.push(`Serial: ${unit.serial}`);
        const imeiTag = unitParts.length
            ? `<br><span style="font-size:10px;color:#1d4ed8;font-family:monospace;font-weight:600;">${unitParts.join(' · ')}</span>`
            : '';
        return `<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;">${item.product_name}${colorTag}${skuTag}${imeiTag}${coveredTag}— ${item.quantity}x ${fmt(item.unit_price)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmt(item.subtotal)}</td>
        </tr>`;
    }).join('');

    // Usar template das configurações ou fallback do default
    const template = settings.delivery_receipt_template ||
        companySettingsService.getDefaults().delivery_receipt_template || '';

    const htmlContent = template
        .replace(/{{cabecalho_a4}}/g, cabecalhoHTML)
        .replace(/{{numero_pedido}}/g, order.id.slice(0, 8).toUpperCase())
        .replace(/{{nome_cliente}}/g, order.customer_name)
        .replace(/{{telefone_cliente}}/g, order.customer_phone)
        .replace(/{{endereco_entrega}}/g, addressBlock)
        .replace(/{{itens_pedido}}/g, itemsHTML)
        .replace(/{{total_pedido}}/g, fmt(order.total))
        .replace(/{{data_emissao}}/g, `${dataEmissao} às ${horaEmissao}`)
        .replace(/{{nome_loja}}/g, settings.company_name || 'Mercado do Vale')
        .replace(/{{cnpj}}/g, settings.cnpj || '');

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Comprovante de Entrega #${order.id.slice(0, 8).toUpperCase()}</title>
            <style>
                body { margin: 0; padding: 0; background: #fff; }
                * { box-sizing: border-box; }
                @media print {
                    @page { margin: 0; size: A4; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            ${htmlContent}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 600);
}
