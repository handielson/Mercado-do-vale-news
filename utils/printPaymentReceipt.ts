import { ContaPagar, ContaReceber } from '../types/finance';
import { CompanySettings } from '../types/companySettings';

const fmt = (v: number) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;

export function printPaymentReceipt(
    conta: ContaPagar | ContaReceber,
    settings: CompanySettings,
    tipo: 'pagar' | 'receber'
) {
    const isReceber = tipo === 'receber';
    const title = 'Recibo de Pagamento';
    const mainColor = isReceber ? '#16a34a' : '#2563eb'; // Green/Blue
    const companyName = settings.company_name || 'Mercado do Vale';

    // Format strings
    const contatoNome = conta.contato?.nome || 'Não informado';
    const valorPago = conta.valor - (conta.saldo ?? 0);
    // Se a conta já tá quitada (saldo 0) ou tem saldo, recebemos o valorPago. Se saldo for undefined, assumimos valor total
    const valorParaRecibo = conta.saldo !== undefined ? valorPago : conta.valor;

    const dataEmissao = new Date().toLocaleDateString('pt-BR');

    // Remove line breaks or format HTML for the historical reason
    const historicoReferencia = (conta.historico || `Referente à transação #${conta.id}`)
        .replace(/\n/g, ' - ')
        .replace(/\r/g, '');

    const documentWidth = (settings as any).receipt_width || '80mm';
    const mmToPx = (mm: string) => `${Math.round(parseFloat(mm) * 3.78)}px`;
    const containerWidth = mmToPx(documentWidth);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Recibo - #${conta.id}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f8fafc; display: flex; flex-direction: column; align-items: center; padding: 20px; }
    .receipt {
        background: white;
        width: ${containerWidth}; /* Tamanho padrão de impressora térmica */
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    }
    .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
    
    .section { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #e5e7eb; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
    
    .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; color: #374151; line-height: 1.4; }
    .row strong { font-weight: 600; color: #111827; }
    .row.large { font-size: 14px; margin-top: 6px; }
    .row.large strong { font-size: 16px; }
    
    .recibo-text { 
        font-size: 13px; 
        color: #111827; 
        line-height: 1.6; 
        text-align: justify;
        margin-top: 10px;
    }
    
    .signature {
        margin-top: 40px;
        text-align: center;
    }
    .signature-line {
        border-top: 1px solid #9ca3af;
        width: 80%;
        margin: 0 auto 6px;
    }
    .signature-name {
        font-size: 11px;
        font-weight: 600;
        color: #374151;
    }
    
    .footer { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #d1d5db; text-align: center; font-size: 10px; color: #9ca3af; }
    
    @media print {
        @page { size: ${documentWidth} auto; margin: 0; }
        body { background: white; padding: 0; display: block; }
        .receipt { box-shadow: none; border-radius: 0; width: 100%; border: none; padding: 12px; }
    }
</style>
</head>
<body>
<div class="receipt">
    <div class="header">
        <div>
            ${(settings as any).logo || settings.receipt_logo_url
            ? `<img src="${(settings as any).logo || settings.receipt_logo_url}" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain;" />`
            : `<p style="font-size:16px;font-weight:800;color:#111827;">${companyName}</p>`}
        </div>
        <div style="text-align:right;">
            <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:${mainColor};letter-spacing:1px;">${title}</p>
            ${settings.cnpj ? `<p style="font-size:11px;color:#6b7280;">CNPJ: ${settings.cnpj}</p>` : ''}
            ${settings.phone ? `<p style="font-size:11px;color:#6b7280;">Tel: ${settings.phone}</p>` : ''}
            <p style="font-size:10px;color:#9ca3af;margin-top:4px;">Ref: #${conta.id}</p>
        </div>
    </div>

    <div class="section" style="text-align:center; padding-top: 4px;">
        <p style="font-size:22px; font-weight:800; color:#111827;">${fmt(valorParaRecibo)}</p>
    </div>

    <div class="section" style="border-bottom:none;">
        <p class="recibo-text">
            ${isReceber
            ? `Recebemos de <strong>${contatoNome}</strong>, a quantia de <strong>${fmt(valorParaRecibo)}</strong>`
            : `Comprovamos o pagamento para <strong>${contatoNome}</strong>, no valor de <strong>${fmt(valorParaRecibo)}</strong>`
        }
            referente a <strong>${historicoReferencia}</strong>.
        </p>
        <p class="recibo-text" style="margin-top: 16px; text-align: center;">
            Para maior clareza, firmamos o presente recibo.
        </p>
        <p class="recibo-text" style="margin-top: 12px; text-align: right; font-style: italic; color: #4b5563;">
            Data: ${dataEmissao}
        </p>
    </div>
    
    <div class="signature">
        <div class="signature-line"></div>
        <p class="signature-name">${companyName}</p>
        ${settings.cnpj ? `<p style="font-size:10px;color:#6b7280;">CNPJ: ${settings.cnpj}</p>` : ''}
    </div>
    
    <div class="footer">
        <p>Impresso em: ${new Date().toLocaleString('pt-BR')}</p>
        <p style="margin-top:4px;">${companyName}</p>
    </div>
</div>
<script>
window.onload = () => {
    // Mede a altura real do conteúdo após renderização
    const totalHeight = document.body.scrollHeight;
    const heightMm = Math.ceil(totalHeight / 3.7795); // px → mm (96dpi: 1mm = 3.7795px)
    // Injeta @page com tamanho exato (largura configurada + altura real)
    const style = document.createElement('style');
    style.textContent = '@page { size: ${documentWidth} ' + heightMm + 'mm; margin: 0; }';
    document.head.appendChild(style);
    setTimeout(() => { window.print(); }, 300);
};
</script>
</body>
</html>`;

    const pw = window.open('', '_blank');
    if (!pw) return;
    pw.document.write(html);
    pw.document.close();
}
