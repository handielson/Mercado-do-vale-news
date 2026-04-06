import React from 'react';
import { Copy, Eye, FileText } from 'lucide-react';
import { PAYMENT_RECEIPT_TAGS } from '../../types/paymentReceiptDocument';
import { toast } from 'sonner';

interface PaymentReceiptTemplateEditorProps {
    template: string;
    onTemplateChange: (template: string) => void;
    logoUrl: string;
    tagsDict?: Record<string, string>;
    getPreviewHTML?: (template: string, logo: string) => string;
}

export const PaymentReceiptTemplateEditor: React.FC<PaymentReceiptTemplateEditorProps> = ({
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

        return template
            .replace(/{{logo}}/g, logoPlaceholder)
            .replace(/{{nome_loja}}/g, 'Mercado do Vale')
            .replace(/{{endereco}}/g, 'Rua Exemplo, 123 - Centro - Cidade/UF')
            .replace(/{{telefone}}/g, '(11) 98765-4321')
            .replace(/{{email}}/g, 'contato@mercadodovale.com.br')
            .replace(/{{cnpj}}/g, '12.345.678/0001-90')
            .replace(/{{nome_cliente}}/g, 'João da Silva')
            .replace(/{{cpf_cliente}}/g, '123.456.789-00')
            .replace(/{{telefone_cliente}}/g, '(11) 91234-5678')
            .replace(/{{email_cliente}}/g, 'joao@email.com')
            .replace(/{{numero_recibo}}/g, 'REC-999')
            .replace(/{{data_emissao}}/g, new Date().toLocaleDateString('pt-BR'))
            .replace(/{{valor}}/g, 'R$ 1.500,00')
            .replace(/{{historico}}/g, 'Compra do pedido #1234')
            .replace(/{{texto_abertura}}/g, 'Recebemos de <strong>João da Silva</strong>');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Template Editor */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FileText size={20} className="text-blue-600" />
                        Template HTML do Recibo de Pagamento (A4)
                    </h3>
                </div>

                <textarea
                    value={template}
                    onChange={(e) => onTemplateChange(e.target.value)}
                    className="flex-1 w-full min-h-[400px] p-4 border border-slate-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Digite o template HTML do recibo de pagamento..."
                />

                <p className="text-sm text-slate-600 mt-4">
                    Use as tags disponíveis no Dicionário Global para construir este recibo.
                </p>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col h-full">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Eye size={20} className="text-blue-600" />
                    Preview do HTML Renderizado (Para Impressão)
                </h3>
                <div className="flex-1 border border-slate-300 bg-white overflow-auto max-h-[800px] flex justify-center">
                    {/* A wrapper div sets the zoom level slightly out to fit A4 previews comfortably on most screens */}
                    <div className="w-full h-fit transform origin-top left p-4">
                        <div dangerouslySetInnerHTML={{ __html: getPreviewData() }} />
                    </div>
                </div>
            </div>
        </div>
    );
};
