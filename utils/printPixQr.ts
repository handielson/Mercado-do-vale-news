import type { PdvPixPrintData } from '../types/pdvDisplay';

const fmt = (value: number) => `R$ ${(value / 100).toFixed(2).replace('.', ',')}`;

function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function chunkText(value: string, size = 34): string {
    const chunks: string[] = [];
    for (let index = 0; index < value.length; index += size) {
        chunks.push(value.slice(index, index + size));
    }
    return chunks.join('<br>');
}

export function printPixQr(data: PdvPixPrintData): void {
    const paperWidth = '80mm';
    const copyPasteCode = data.copyPasteCode || data.qrCode || '';
    const qrSrc = data.qrCodeBase64
        ? `data:image/png;base64,${data.qrCodeBase64}`
        : `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(copyPasteCode)}`;
    const itemsHtml = (data.items || []).slice(0, 8).map((item) => `
        <tr>
            <td>${escapeHtml(item.quantity)}x ${escapeHtml(item.product_name)}</td>
            <td style="text-align:right;">${fmt(item.total)}</td>
        </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>QR Code Pix</title>
<style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #111827; font-family: Arial, sans-serif; }
    .ticket { width: 80mm; padding: 12px; text-align: center; }
    .store { font-size: 16px; font-weight: 800; margin-bottom: 4px; }
    .title { border-top: 1px dashed #9ca3af; border-bottom: 1px dashed #9ca3af; font-size: 13px; font-weight: 800; margin: 10px 0; padding: 8px 0; text-transform: uppercase; }
    .amount { font-size: 28px; font-weight: 900; margin: 10px 0; }
    .qr { width: 260px; height: 260px; object-fit: contain; margin: 8px auto; display: block; }
    .instructions { font-size: 12px; line-height: 1.45; margin: 10px 0; }
    .copy { border: 1px dashed #9ca3af; font-family: monospace; font-size: 9px; line-height: 1.35; margin-top: 10px; overflow-wrap: anywhere; padding: 8px; text-align: left; }
    table { border-collapse: collapse; margin-top: 10px; width: 100%; }
    td { border-bottom: 1px dotted #d1d5db; font-size: 10px; padding: 3px 0; text-align: left; }
    .footer { border-top: 1px dashed #9ca3af; color: #6b7280; font-size: 10px; margin-top: 12px; padding-top: 8px; }
    @media print {
        @page { size: ${paperWidth} auto; margin: 0; }
        body { width: ${paperWidth}; }
        .ticket { width: 100%; }
    }
</style>
</head>
<body>
    <main class="ticket">
        <div class="store">${escapeHtml(data.storeName || 'Mercado do Vale')}</div>
        <div class="title">QR Code Pix</div>
        <div class="amount">${fmt(data.amount)}</div>
        <img class="qr" src="${qrSrc}" alt="QR Code Pix" />
        <p class="instructions">${escapeHtml(data.instructions || 'Aponte a camera para o QR Code ou use o Pix copia e cola.')}</p>
        <div class="copy">
            <strong>Pix copia e cola</strong><br>
            ${chunkText(escapeHtml(copyPasteCode))}
        </div>
        ${itemsHtml ? `<table>${itemsHtml}</table>` : ''}
        <div class="footer">Apos pagar, aguarde a confirmacao no caixa.</div>
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
