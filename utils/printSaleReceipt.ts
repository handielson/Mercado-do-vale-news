import { SaleWithItems } from '../types/sale';
import { CompanySettings } from '../types/companySettings';
import { companySettingsService } from '../services/companySettingsService';
import { CoinBalance } from '../types/cashback';
import {
    buildPaymentPresentation,
    buildSaleItemPresentation,
    buildSaleReceiptDynamicRows,
    getSaleCollectedTotal,
    ProductSpecsMap,
    SaleProfitData
} from './salePresentation';


import { buildGlobalHeader, getHeaderTemplate } from './headerBuilder';

const fmt = (v: number) => `R$ ${(v / 100).toFixed(2).replace('.', ',')}`;

const escapeHtml = (value: unknown): string => {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

export interface PrintReceiptBenefits {
    /** Saldo atual de moedas do cliente */
    coinBalance: CoinBalance | null;
    /** Moedas ganhas com esta venda específica */
    coinsEarnedThisSale: number;
    /** Status de películas do cliente (pode ter 0 ou N benefícios) */
    benefitStatuses: BenefitStatus[];
}

/** Substitui as tags dinâmicas do texto da Folha Extra com dados reais da venda */
function resolveExtraPageTags(
    text: string,
    sale: SaleWithItems,
    settings: CompanySettings,
    benefits?: PrintReceiptBenefits
): string {
    const saleDate = new Date(sale.created_at);

    // — Películas —
    // Soma todos os benefícios ativos do cliente
    const peliSaldo = benefits?.benefitStatuses.reduce((sum, b) => sum + b.monthsRemaining, 0) ?? 0;
    const peliUsadas = benefits?.benefitStatuses.reduce((sum, b) => sum + b.redemptions.length, 0) ?? 0;
    // "Ganhas" = total de benefícios × 12 meses (cada benefício dá 12 películas)
    const peliGanhas = (benefits?.benefitStatuses.length ?? 0) * 12;

    // — Moedas —
    const moedasSaldo = benefits?.coinBalance?.balance ?? 0;
    const moedasGanhasTotal = benefits?.coinBalance?.lifetime_earned ?? 0;
    const moedasGanhasVenda = benefits?.coinsEarnedThisSale ?? 0;

    return text
        // Cliente
        .replace(/\{\{cliente_nome\}\}/g, sale.customer?.name || 'Cliente Avulso')
        .replace(/\{\{cliente_documento\}\}/g, sale.customer?.cpf_cnpj || '')
        .replace(/\{\{cliente_telefone\}\}/g, (sale.customer as any)?.phone || '')
        .replace(/\{\{cliente_email\}\}/g, (sale.customer as any)?.email || '')
        // Empresa
        .replace(/\{\{empresa_nome\}\}/g, settings.company_name || '')
        .replace(/\{\{empresa_telefone\}\}/g, settings.phone || '')
        .replace(/\{\{empresa_email\}\}/g, settings.email || '')
        .replace(/\{\{empresa_cnpj\}\}/g, settings.cnpj || '')
        .replace(/\{\{empresa_endereco\}\}/g, settings.address || '')
        // Venda
        .replace(/\{\{data_venda\}\}/g, saleDate.toLocaleDateString('pt-BR'))
        .replace(/\{\{hora_venda\}\}/g, saleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
        .replace(/\{\{numero_pedido\}\}/g, sale.id.slice(0, 8).toUpperCase())
        // Películas
        .replace(/\{\{pelicula_saldo\}\}/g, String(peliSaldo))
        .replace(/\{\{pelicula_usadas\}\}/g, String(peliUsadas))
        .replace(/\{\{pelicula_ganhas\}\}/g, String(peliGanhas))
        // Moedas
        .replace(/\{\{moedas_saldo\}\}/g, String(moedasSaldo))
        .replace(/\{\{moedas_ganhas_venda\}\}/g, String(moedasGanhasVenda))
        .replace(/\{\{moedas_ganhas_total\}\}/g, String(moedasGanhasTotal));
}

/**
 * Generates HTML for a sale receipt (+ optional extra sheet) and opens a print window.
 */
export function printSaleReceipt(
    sale: SaleWithItems,
    settings: CompanySettings,
    productSpecs?: ProductSpecsMap,
    benefits?: PrintReceiptBenefits,
    profitData?: SaleProfitData
) {
    const logo = (settings as any).logo || settings.receipt_logo_url || '';
    const companyName = settings.company_name || 'Mercado do Vale';
    const saleDate = new Date(sale.created_at);
    const payments: any[] = (sale as any).payment_methods || [];
    const logoHtml = logo
        ? `<img src="${logo}" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain;" />`
        : '';

    const itemsHtml = sale.items.map(item => {
        const itemView = buildSaleItemPresentation(item, productSpecs, profitData);
        const identifier = itemView.identifierLine === 'SKU: N/A' ? '' : itemView.identifierLine;

        return `
        <tr>
            <td style="padding:4px 0;font-size:13px;color:#374151;">
                ${item.quantity > 1 ? `<span style="color:#6b7280">${item.quantity}x </span>` : ''}
                ${escapeHtml(item.product_name)}
                ${item.is_gift ? '<span style="font-size:10px;background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:4px;margin-left:4px;">BRINDE</span>' : ''}
                ${identifier ? `<br><span style="font-size:11px;color:#9ca3af;">${escapeHtml(identifier)}</span>` : ''}
            </td>
            <td style="padding:4px 0;text-align:right;font-size:13px;font-family:monospace;white-space:nowrap;">
                ${item.is_gift ? '<span style="color:#059669">Grátis</span>' : fmt(item.total)}
            </td>
        </tr>`;
    }).join('');

    const paymentsHtml = payments.map(p => {
        const paymentView = buildPaymentPresentation(p);
        const detailHtml = paymentView.details.length > 0
            ? `<br><span style="font-size:11px;color:#6b7280;">${paymentView.details.map(escapeHtml).join('<br>')}</span>`
            : '';
        return `
        <tr>
            <td style="padding:4px 0;font-size:13px;color:#374151;">${escapeHtml(paymentView.labelWithInstallments)}${detailHtml}</td>
            <td style="padding:4px 0;text-align:right;font-size:13px;font-family:monospace;vertical-align:top;">${fmt(paymentView.totalWithFee)}</td>
        </tr>`;
    }).join('');

    const dynamicRowsHtml = buildSaleReceiptDynamicRows(sale, benefits).map(row => `
        <tr>
            <td style="padding:3px 0;font-size:13px;color:#374151;">${escapeHtml(row.label)}</td>
            <td style="padding:3px 0;text-align:right;font-size:13px;font-family:monospace;">${escapeHtml(row.value)}</td>
        </tr>
    `).join('');

    const customerSection = sale.customer ? `
        <div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px dashed #d1d5db;">
            <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0 0 6px;">Cliente</p>
            <p style="margin:0;font-size:13px;font-weight:600;color:#111827;">${escapeHtml(sale.customer.name)}</p>
            ${sale.customer.cpf_cnpj ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280;">CPF/CNPJ: ${escapeHtml(sale.customer.cpf_cnpj)}</p>` : ''}
        </div>` : '';

    // — Folha Extra —
    const showExtraPage = !!(settings as any).receipt_show_extra_page;
    const extraPageText = (settings as any).receipt_extra_page_text || '';
    const extraPageQrUrl = (settings as any).receipt_extra_page_qr_url || '';

    let extraPageHtml = '';
    if (showExtraPage && extraPageText) {
        const resolvedText = resolveExtraPageTags(extraPageText, sale, settings, benefits);
        const formattedText = resolvedText.replace(/\n/g, '<br>');

        const qrHtml = extraPageQrUrl
            ? `<div style="text-align:center;margin-top:24px;">
                <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(extraPageQrUrl)}"
                    alt="QR Code"
                    style="width:180px;height:180px;border:1px solid #e5e7eb;padding:8px;border-radius:8px;"
                />
                <p style="font-size:11px;color:#9ca3af;margin-top:8px;">Escaneie para acessar</p>
               </div>`
            : '';

        const rawCabecalhoExtra = getHeaderTemplate('default_thermal_header', settings);
        let cabecalhoTermicoExtraHTML = buildGlobalHeader(rawCabecalhoExtra, settings, 'Termo de Garantia / Folha Extra');

        extraPageHtml = `
<div class="extra-page">
    ${cabecalhoTermicoExtraHTML}
    <div style="font-size:13px;line-height:1.7;color:#374151;">${formattedText || ''}</div>
    ${qrHtml}
</div>`;
    }

    // — Papel térmico: largura vem das configurações (58mm | 80mm | 100mm) —
    const paperWidth: string = (settings as any).receipt_width || '80mm';
    // Largura do container em px para preview visual (1mm ≈ 3.78px)
    const mmToPx = (mm: string) => {
        const n = parseFloat(mm);
        return `${Math.round(n * 3.78)}px`;
    };
    const containerWidth = mmToPx(paperWidth);

    const rawCabecalhoPrincipal = getHeaderTemplate('default_thermal_header', settings);
    const cabecalhoTermicoPrincipalHTML = buildGlobalHeader(rawCabecalhoPrincipal, settings, 'Comprovante de Venda');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Recibo de Venda</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f8fafc; display: flex; flex-direction: column; align-items: center; padding: 20px; gap: 0; }
    .receipt {
        background: white;
        width: ${containerWidth};
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    }
    .extra-page {
        background: white;
        width: ${containerWidth};
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.10);
        margin-top: 24px;
    }
    .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; }
    .total-row td { padding: 4px 0; font-weight: 700; font-size: 14px; color: #111827; border-top: 2px solid #e5e7eb; }
    .footer { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #d1d5db; text-align: center; font-size: 10px; color: #9ca3af; }
    @media print {
        @page { size: ${paperWidth} auto; margin: 0; }
        body { background: white; padding: 0; }
        .receipt { box-shadow: none; border-radius: 0; width: 100%; page-break-after: always; }
        .extra-page { box-shadow: none; border-radius: 0; width: 100%; margin-top: 0; page-break-after: auto; }
    }
</style>
</head>
<body>
<div class="receipt">
    ${cabecalhoTermicoPrincipalHTML}

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
            ${dynamicRowsHtml}
            <tr class="total-row"><td>TOTAL</td><td style="text-align:right;font-family:monospace;">${fmt(getSaleCollectedTotal(sale, profitData))}</td></tr>
        </table>
    </div>

    <div style="margin-bottom:16px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0 0 8px;">Pagamento</p>
        <table>${paymentsHtml}</table>
    </div>

    ${sale.notes ? `
    <div style="margin-bottom:16px;padding-bottom:14px;border-top:1px dashed #d1d5db;padding-top:10px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0 0 4px;">Observações</p>
        <p style="margin:0;font-size:12px;color:#374151;line-height:1.4;">${escapeHtml(sale.notes)}</p>
    </div>` : ''}
    <div class="footer">
        <p>Obrigado pela preferência! 💙</p>
        <p style="margin-top:4px;">${companyName}</p>
    </div>
</div>
${extraPageHtml}
<script>
window.onload = () => {
    // Mede a altura real do conteúdo após renderização
    const totalHeight = document.body.scrollHeight;
    const heightMm = Math.ceil(totalHeight / 3.7795); // px → mm (96dpi: 1mm = 3.7795px)
    // Injeta @page com tamanho exato (largura configurada + altura real)
    const style = document.createElement('style');
    style.textContent = '@page { size: ${paperWidth} ' + heightMm + 'mm; margin: 0; }';
    document.head.appendChild(style);
    window.print();
};
</script>
</body>
</html>`;

    const pw = window.open('', '_blank');
    if (!pw) return;
    pw.document.write(html);
    pw.document.close();
}
