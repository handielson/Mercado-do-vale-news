import type { MarketplaceSale } from '../services/adminMarketplaceSalesService';
import { formatMarketplaceStatus } from '../services/adminMarketplaceSalesService';
import type { CompanySettings } from '../types/companySettings';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(value) || 0) / 100);
const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Imprime um pedido de marketplace na largura configurada para a impressora de comprovantes. */
export function printMarketplaceSaleReceipt(sale: MarketplaceSale, settings: CompanySettings): void {
  const width = String((settings as any).receipt_width || '80mm');
  const items = Array.isArray(sale.details?.items) ? sale.details.items : [];
  const created = new Date(sale.occurred_at);
  const itemRows = items.map((item) => `
    <tr><td>${item.quantity > 1 ? `${item.quantity}x ` : ''}${escapeHtml(item.name)}${item.sku ? `<br><small>SKU: ${escapeHtml(item.sku)}</small>` : ''}</td><td>${money(item.total_cents)}</td></tr>`).join('');
  const logo = String((settings as any).logo || settings.receipt_logo_url || '').trim();
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante ${escapeHtml(sale.display_id || sale.external_id)}</title>
  <style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:10px;color:#111}.receipt{width:${width};max-width:100%}header{text-align:center;border-bottom:1px dashed #555;padding-bottom:8px;margin-bottom:8px}header img{max-height:44px;max-width:120px;object-fit:contain}h1{font-size:15px;margin:4px 0}p{margin:3px 0;font-size:12px}.muted,small{color:#555;font-size:10px}table{width:100%;border-collapse:collapse;font-size:12px}td{padding:5px 0;border-bottom:1px dotted #bbb;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}.total{font-size:15px;font-weight:700;border-top:1px solid #111;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between}.footer{text-align:center;margin-top:14px;padding-top:8px;border-top:1px dashed #555;font-size:10px;color:#555}@media print{@page{size:${width} auto;margin:0}body{padding:0}.receipt{width:100%;padding:8px}}</style></head><body><main class="receipt">
  <header>${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(settings.company_name)}">` : ''}<h1>${escapeHtml(settings.company_name || 'Mercado do Vale')}</h1><p>COMPROVANTE DE PEDIDO</p></header>
  <p><strong>Canal:</strong> ${escapeHtml(sale.channel_label)}</p><p><strong>Pedido:</strong> ${escapeHtml(sale.display_id || sale.external_id)}</p><p><strong>Data:</strong> ${created.toLocaleString('pt-BR')}</p><p><strong>Situação:</strong> ${escapeHtml(formatMarketplaceStatus(sale.status))}</p><p><strong>Cliente:</strong> ${escapeHtml(sale.customer_name)}</p>
  <table><tbody>${itemRows || '<tr><td>Itens não informados pelo marketplace.</td><td></td></tr>'}</tbody></table><div class="total"><span>TOTAL</span><span>${money(sale.total_cents)}</span></div>
  <div class="footer">Comprovante emitido pelo sistema Mercado do Vale.</div></main><script>window.onload=()=>setTimeout(()=>window.print(),150)</script></body></html>`;
  const win = window.open('', '_blank', 'width=420,height=720');
  if (!win) throw new Error('Permita pop-ups para imprimir o comprovante.');
  win.document.write(html);
  win.document.close();
}
