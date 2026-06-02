import { ContaPagar, ContaReceber } from '../types/finance';
import { CompanySettings } from '../types/companySettings';
import { companySettingsService } from '../services/companySettingsService';

import { buildGlobalHeader, getHeaderTemplate } from './headerBuilder';

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

    const rawCabecalho = getHeaderTemplate('default_a4_header', settings);
    const cabecalhoA4HTML = buildGlobalHeader(rawCabecalho, settings, 'RECIBO');

    const template = settings.payment_receipt_template || companySettingsService.getDefaults().payment_receipt_template || '';

    const contatoCpfCnpj = conta.contato?.cpf_cnpj || 'Não cadastrado';

    const htmlContent = template
        .replace(/{{cabecalho_a4}}/g, cabecalhoA4HTML)
        .replace(/{{nome_loja}}/g, companyName)
        .replace(/{{nome_cliente}}/g, contatoNome)
        .replace(/{{documento}}/g, contatoCpfCnpj)
        .replace(/{{cpf_cliente}}/g, contatoCpfCnpj)
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
