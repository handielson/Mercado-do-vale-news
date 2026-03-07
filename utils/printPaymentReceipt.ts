import { ContaPagar, ContaReceber } from '../types/finance';
import { CompanySettings } from '../types/companySettings';
import { companySettingsService } from '../services/companySettingsService';

const fmt = (v: number) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;

export function printPaymentReceipt(
    conta: ContaPagar | ContaReceber,
    settings: CompanySettings,
    tipo: 'pagar' | 'receber'
) {
    const isReceber = tipo === 'receber';
    const companyName = settings.company_name || 'Mercado do Vale';

    // Format strings
    const contatoNome = conta.contato?.nome || 'Não informado';
    const valorPago = conta.valor - (conta.saldo ?? 0);
    const valorParaRecibo = conta.saldo !== undefined ? valorPago : conta.valor;
    const dataEmissao = new Date().toLocaleDateString('pt-BR');

    const historicoReferencia = (conta.historico || `Referente à transação #${conta.id}`)
        .replace(/\n/g, ' - ')
        .replace(/\r/g, '');

    // Dados base
    const textoAbertura = isReceber
        ? `Recebemos de <strong>${contatoNome}</strong>`
        : `Pagamos a <strong>${contatoNome}</strong>`;

    const logoPlaceholder = (settings as any).logo || settings.receipt_logo_url
        ? `<img src="${(settings as any).logo || settings.receipt_logo_url}" alt="Logo" style="max-height:80px;max-width:150px;object-fit:contain;" />`
        : `<div style="font-size:24px;font-weight:bold;color:#111827;">${companyName}</div>`;

    const template = settings.payment_receipt_template || companySettingsService.getDefaults().payment_receipt_template || '';

    const htmlContent = template
        .replace(/{{logo}}/g, logoPlaceholder)
        .replace(/{{nome_loja}}/g, companyName)
        .replace(/{{endereco}}/g, settings.address || 'Endereço não cadastrado')
        .replace(/{{telefone}}/g, settings.phone || '')
        .replace(/{{email}}/g, settings.email || '')
        .replace(/{{cnpj}}/g, settings.cnpj || '')
        .replace(/{{nome_cliente}}/g, contatoNome)
        .replace(/{{cpf_cliente}}/g, conta.contato?.cpf_cnpj || 'Não cadastrado')
        .replace(/{{telefone_cliente}}/g, conta.contato?.telefone || 'Não cadastrado')
        .replace(/{{email_cliente}}/g, conta.contato?.email || 'Não cadastrado')
        .replace(/{{numero_recibo}}/g, String(conta.id || new Date().getTime().toString().slice(-6)))
        .replace(/{{data_emissao}}/g, dataEmissao)
        .replace(/{{valor}}/g, fmt(valorParaRecibo))
        .replace(/{{historico}}/g, historicoReferencia)
        .replace(/{{texto_abertura}}/g, textoAbertura);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Recibo - #${conta.id || 'Avulso'}</title>
    <style>
        body { margin: 0; padding: 20px; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
            @page { margin: 10mm; size: A4 portrait; }
            body { padding: 0; }
        }
    </style>
</head>
<body>
    ${htmlContent}
    <script>
        window.onload = () => {
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
