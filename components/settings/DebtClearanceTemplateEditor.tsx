import React from 'react';
import { Copy, Eye, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface DebtClearanceTemplateEditorProps {
    template: string;
    onTemplateChange: (template: string) => void;
    logoUrl: string;
    tagsDict?: Record<string, string>;
    getPreviewHTML?: (template: string, logo: string) => string;
}

export const DebtClearanceTemplateEditor: React.FC<DebtClearanceTemplateEditorProps> = ({
    template,
    onTemplateChange,
    logoUrl,
    tagsDict,
    getPreviewHTML
}) => {
    const getPreviewData = () => {
        if (getPreviewHTML) {
            return getPreviewHTML(template, logoUrl);
        }

        // Fallback backward compatibility
        const svgPlaceholder = `<svg width="150" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="80" fill="#e2e8f0"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#64748b" text-anchor="middle" dominant-baseline="middle">Logo</text></svg>`;
        const logoPlaceholder = logoUrl ? `<img src="${logoUrl}" style="max-width:150px; max-height:80px;" alt="Logo" />` : `<img src="data:image/svg+xml;base64,${btoa(svgPlaceholder)}" alt="Logo" />`;

        const cabecalhoA4 = `
<div style="display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
    <div style="flex: 1;">
        ${logoPlaceholder}
    </div>
    <div style="flex: 2; text-align: right;">
        <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">CARTA DE QUITAÇÃO</h2>
        <p style="margin: 5px 0 0; font-weight: bold;">Mercado do Vale</p>
        <p style="margin: 0; font-size: 11px;">CNPJ: 12.345.678/0001-90</p>
        <p style="margin: 0; font-size: 11px;">Rua Exemplo, 123 - Centro - Cidade/UF</p>
        <p style="margin: 0; font-size: 11px;">(11) 98765-4321 | contato@mercadodovale.com.br</p>
    </div>
</div>`;

        return template
            .replace(/{{cabecalho_a4}}/g, cabecalhoA4)
            .replace(/{{nome_loja}}/g, 'Mercado do Vale')
            .replace(/{{cnpj}}/g, '12.345.678/0001-90')
            .replace(/{{endereco}}/g, 'Rua Exemplo, 123 - Centro - Cidade/UF')
            .replace(/{{telefone}}/g, '(11) 98765-4321')
            .replace(/{{email}}/g, 'contato@mercadodovale.com.br')
            .replace(/{{nome_cliente}}/g, 'João da Silva')
            .replace(/{{cpf_cliente}}/g, '123.456.789-00')
            .replace(/{{telefone_cliente}}/g, '(11) 91234-5678')
            .replace(/{{numero_recibo}}/g, '14002')
            .replace(/{{data_emissao}}/g, new Date().toLocaleDateString('pt-BR'))
            .replace(/{{valor_quitado}}/g, 'R$ 1.500,00')
            .replace(/{{historico_conta}}/g, 'Referente ao conserto de tela do iPhone 13');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Template Editor */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FileText size={20} className="text-blue-600" />
                        Template HTML da Carta de Quitação (A4)
                    </h3>
                </div>

                <textarea
                    value={template}
                    onChange={(e) => onTemplateChange(e.target.value)}
                    className="flex-1 w-full min-h-[400px] p-4 border border-slate-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Digite o template HTML da carta de quitação..."
                />

                <p className="text-sm text-slate-600 mt-4">
                    A carta de quitação será emitida no Financeiro ao baixar uma conta totalmente transferindo seu saldo a zero.
                    Você pode usar as tags do Dicionário Global para personalizá-la.
                </p>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col h-full">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Eye size={20} className="text-blue-600" />
                    Preview do HTML Renderizado (Para Impressão)
                </h3>
                <div className="flex-1 border border-slate-300 bg-white overflow-auto max-h-[800px] flex justify-center">
                    <div className="w-full h-fit transform origin-top left p-4">
                        <div dangerouslySetInnerHTML={{ __html: getPreviewData() }} />
                    </div>
                </div>
            </div>
        </div>
    );
};
