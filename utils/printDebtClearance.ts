import { ContaPagar, ContaReceber } from '../types/finance';
import { CompanySettings } from '../types/companySettings';
import { companySettingsService } from '../services/companySettingsService';

const fmt = (v: number) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;

import { buildGlobalHeader, getHeaderTemplate } from './headerBuilder';

export function printDebtClearance(
    conta: ContaReceber,
    settings: CompanySettings
) {
    const companyName = settings.company_name || 'Mercado do Vale';
    const dataEmissao = new Date().toLocaleDateString('pt-BR');

    const rawCabecalho = getHeaderTemplate('default_a4_header', settings);
    const cabecalhoA4HTML = buildGlobalHeader(rawCabecalho, settings, 'CARTA DE QUITAÇÃO DE DÉBITO');

    // 2. Resolver o Template de Quitação
    let template = settings.debt_clearance_template || companySettingsService.getDefaults().debt_clearance_template || '';

    const htmlContent = template
        .replace(/{{cabecalho_a4}}/g, cabecalhoA4HTML)
        .replace(/{{nome_cliente}}/g, conta.contato?.nome || 'Não informado')
        .replace(/{{cpf_cliente}}/g, conta.contato?.cpf_cnpj || 'Não informado')
        .replace(/{{numero_recibo}}/g, String(conta.id))
        .replace(/{{valor_quitado}}/g, fmt(conta.valor))
        .replace(/{{historico_conta}}/g, conta.historico || 'Sem histórico')
        .replace(/{{data_emissao}}/g, new Date().toLocaleDateString('pt-BR'))
        .replace(/{{nome_loja}}/g, companyName)
        .replace(/{{cnpj}}/g, settings.cnpj || '');

    // 3. Imprimir
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Carta de Quitação - #${conta.id}</title>
                <style>
                    body { margin: 0; padding: 0; background: #fff; }
                    * { box-sizing: border-box; }
                    @media print {
                        @page { margin: 0; size: auto; }
                        body { padding: 0cm; }
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
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }
}
