import type { StandalonePixPayment } from '../types/standalonePix';

const fmt = (value: number) => `R$ ${(Number(value || 0) / 100).toFixed(2).replace('.', ',')}`;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
}

export function printStandalonePixReceipt(pix: StandalonePixPayment): void {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Comprovante Pix Avulso</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #111827; font-family: Arial, sans-serif; }
  .ticket { width: 80mm; padding: 12px; }
  .center { text-align: center; }
  .store { font-size: 16px; font-weight: 800; margin-bottom: 4px; }
  .title { border-top: 1px dashed #9ca3af; border-bottom: 1px dashed #9ca3af; font-size: 13px; font-weight: 800; margin: 10px 0; padding: 8px 0; text-transform: uppercase; }
  .amount { color: #047857; font-size: 28px; font-weight: 900; margin: 10px 0; }
  .row { border-bottom: 1px dotted #d1d5db; display: flex; gap: 8px; justify-content: space-between; padding: 6px 0; }
  .label { color: #6b7280; font-size: 10px; text-transform: uppercase; }
  .value { font-size: 12px; font-weight: 700; text-align: right; word-break: break-word; }
  .description { font-size: 11px; line-height: 1.35; margin-top: 8px; word-break: break-word; }
  .footer { border-top: 1px dashed #9ca3af; color: #6b7280; font-size: 10px; margin-top: 12px; padding-top: 8px; text-align: center; }
  @media print {
    @page { size: 80mm auto; margin: 0; }
    body { width: 80mm; }
    .ticket { width: 100%; }
  }
</style>
</head>
<body>
  <main class="ticket">
    <div class="center">
      <div class="store">Mercado do Vale</div>
      <div class="title">Comprovante Pix Avulso</div>
      <div class="amount">${fmt(pix.amount)}</div>
    </div>
    <div class="row"><span class="label">Status</span><span class="value">Pagamento aprovado</span></div>
    <div class="row"><span class="label">Data/hora</span><span class="value">${escapeHtml(formatDateTime(pix.approved_at || pix.updated_at))}</span></div>
    <div class="row"><span class="label">ID Pix</span><span class="value">${escapeHtml(pix.id)}</span></div>
    ${pix.mercado_pago_payment_id ? `<div class="row"><span class="label">Mercado Pago</span><span class="value">${escapeHtml(pix.mercado_pago_payment_id)}</span></div>` : ''}
    ${pix.cashier_key ? `<div class="row"><span class="label">Caixa</span><span class="value">${escapeHtml(pix.cashier_key)}</span></div>` : ''}
    ${pix.description ? `<div class="description"><strong>Descricao:</strong><br>${escapeHtml(pix.description)}</div>` : ''}
    <div class="footer">Comprovante emitido pelo sistema Mercado do Vale.</div>
  </main>
<script>
window.onload = () => window.print();
</script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
}
