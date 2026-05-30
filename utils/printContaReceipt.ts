import { ContaPagar, ContaReceber } from '../types/finance';
import { CompanySettings } from '../types/companySettings';
import { companySettingsService } from '../services/companySettingsService';

const fmt = (v: number) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;

import { buildGlobalHeader, getHeaderTemplate } from './headerBuilder';

function escapeHtml(value: string): string {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatBlingDate(d?: string): string {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
}

function formatBorderoDetails(conta: ContaPagar | ContaReceber): string {
    const baseHistorico = escapeHtml(conta.historico || 'Sem histórico')
        .replace(/\n/g, '<br>')
        .replace(/\r/g, '');
    const borderos = Array.isArray(conta.borderoDetalhes) ? conta.borderoDetalhes : [];

    if (borderos.length === 0) return baseHistorico;

    const borderosHtml = borderos.map((bordero, index) => {
        const pagamentos = Array.isArray(bordero.pagamentos) ? bordero.pagamentos : [];
        const valorPago = pagamentos.reduce((sum, pagamento) => sum + (Number(pagamento.valorPago) || 0), 0);
        const acrescimos = pagamentos.reduce((sum, pagamento) => sum + (Number(pagamento.juros) || 0) + (Number(pagamento.acrescimo) || 0), 0);
        const descontos = pagamentos.reduce((sum, pagamento) => sum + (Number(pagamento.desconto) || 0), 0);
        const tarifas = pagamentos.reduce((sum, pagamento) => sum + (Number(pagamento.tarifa) || 0), 0);
        const details = [
            `<strong>Baixa ${index + 1}</strong>`,
            `Data: ${escapeHtml(formatBlingDate(bordero.data))}`,
            `Histórico: ${escapeHtml(bordero.historico || 'Sem histórico da baixa')}`,
            `Valor pago: ${fmt(valorPago)}`,
            acrescimos ? `Acréscimos/Juros: ${fmt(acrescimos)}` : '',
            descontos ? `Desconto: ${fmt(descontos)}` : '',
            tarifas ? `Tarifa: ${fmt(tarifas)}` : '',
        ].filter(Boolean);

        return details.join('<br>');
    }).join('<br><br>');

    return `${baseHistorico}<br><br>${borderosHtml}`;
}

export function printContaReceipt(
    conta: ContaPagar | ContaReceber,
    settings: CompanySettings,
    tipo: 'pagar' | 'receber'
) {
    const isPagar = tipo === 'pagar';
    const title = isPagar ? 'Comprovante de Conta a Pagar' : 'Comprovante de Conta a Receber';
    const mainColor = isPagar ? '#dc2626' : '#16a34a'; // Red for Pagar, Green for Receber
    const companyName = settings.company_name || 'Mercado do Vale';

    const vencimento = formatBlingDate(conta.vencimento);
    const emissao = formatBlingDate(conta.dataEmissao || '');

    const contatoNome = escapeHtml(conta.contato?.nome || 'Não informado');
    const categoriaDesc = escapeHtml(conta.categoria?.descricao || 'Sem categoria');
    const portadorDesc = escapeHtml(conta.portador?.descricao || 'Não informado');

    const situacaoMap: Record<string, string> = {
        '1': 'Em aberto', 'em_aberto': 'Em aberto',
        '2': 'Pago/Quitado', 'pago': 'Pago/Quitado', 'recebido': 'Pago/Quitado',
        '3': 'Parcial', 'parcial': 'Parcial',
        '4': 'Cancelado', 'cancelado': 'Cancelado',
    };
    const situacaoFormatada = escapeHtml(situacaoMap[String(conta.situacao).toLowerCase()] || String(conta.situacao));

    const historicoFormatado = formatBorderoDetails(conta);

    const rawCabecalho = getHeaderTemplate('default_thermal_header', settings);
    const cabecalhoTermicoHTML = buildGlobalHeader(rawCabecalho, settings, title);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${title} #${conta.id}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f8fafc; display: flex; flex-direction: column; align-items: center; padding: 20px; }
    .receipt {
        background: white;
        width: 80mm; /* Tamanho padrão de impressora térmica */
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    }
    .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
    
    .section { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #e5e7eb; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
    
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px; font-size: 12px; color: #374151; line-height: 1.4; }
    .row span { flex: 0 0 auto; }
    .row strong { min-width: 0; max-width: 58mm; font-weight: 600; color: #111827; text-align: right; overflow-wrap: anywhere; word-break: break-word; }
    .row.large { font-size: 14px; margin-top: 6px; }
    .row.large strong { font-size: 16px; }
    
    .historico-box { 
        background: #f8fafc; 
        padding: 8px; 
        border-radius: 4px; 
        font-size: 12px; 
        color: #111827; 
        line-height: 1.5; 
        font-family: monospace;
        margin-top: 4px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
    }
    
    .footer { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #d1d5db; text-align: center; font-size: 10px; color: #9ca3af; }
    
    @media print {
        @page { size: 80mm auto; margin: 0; }
        body { background: white; padding: 0; display: block; }
        .receipt { box-shadow: none; border-radius: 0; width: 100%; border: none; padding: 12px; }
    }
</style>
</head>
<body>
<div class="receipt">
    ${cabecalhoTermicoHTML}

    <div class="section">
        <p class="section-title">Contatos e Detalhes</p>
        <div class="row">
            <span>${isPagar ? 'Favorecido' : 'Cliente'}:</span>
            <strong>${contatoNome}</strong>
        </div>
        <div class="row">
            <span>Categoria:</span>
            <strong>${categoriaDesc}</strong>
        </div>
        <div class="row">
            <span>Portador:</span>
            <strong>${portadorDesc}</strong>
        </div>
        <div class="row">
            <span>Situação:</span>
            <strong>${situacaoFormatada}</strong>
        </div>
    </div>

    <div class="section">
        <p class="section-title">Datas</p>
        <div class="row">
            <span>Emissão:</span>
            <strong>${emissao}</strong>
        </div>
        <div class="row">
            <span>Vencimento:</span>
            <strong>${vencimento}</strong>
        </div>
    </div>

    <div class="section">
        <p class="section-title">Valores</p>
        <div class="row large">
            <span>Valor Total:</span>
            <strong>${fmt(conta.valor)}</strong>
        </div>
        ${conta.saldo !== undefined && conta.saldo !== conta.valor ?
            `<div class="row">
                <span>Saldo em aberto:</span>
                <strong>${fmt(conta.saldo)}</strong>
            </div>` : ''}
    </div>

    <div class="section" style="border-bottom:none;">
        <p class="section-title" style="margin-bottom:8px;">Histórico Detalhado</p>
        <div class="historico-box">${historicoFormatado}</div>
    </div>
    
    <div class="footer">
        <p>Impresso em: ${new Date().toLocaleString('pt-BR')}</p>
        <p style="margin-top:4px;">Mercado do Vale</p>
    </div>
</div>
<script>
window.onload = () => {
    // Mede a altura real do conteúdo após renderização
    const totalHeight = document.body.scrollHeight;
    const heightMm = Math.ceil(totalHeight / 3.7795); // px → mm (96dpi: 1mm = 3.7795px)
    // Injeta @page com tamanho exato (largura configurada + altura real)
    const style = document.createElement('style');
    style.textContent = '@page { size: 80mm ' + heightMm + 'mm; margin: 0; }';
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
