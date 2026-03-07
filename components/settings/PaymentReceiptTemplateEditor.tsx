import React from 'react';
import { Copy, Eye, FileText } from 'lucide-react';
import { PAYMENT_RECEIPT_TAGS } from '../../types/paymentReceiptDocument';
import { toast } from 'sonner';

interface PaymentReceiptTemplateEditorProps {
    template: string;
    onTemplateChange: (template: string) => void;
    logoUrl: string;
}

export const PaymentReceiptTemplateEditor: React.FC<PaymentReceiptTemplateEditorProps> = ({
    template,
    onTemplateChange,
    logoUrl
}) => {
    const [showPreview, setShowPreview] = React.useState(false);

    const copyTag = (tag: string) => {
        navigator.clipboard.writeText(`{{${tag}}}`);
        toast.success(`Tag {{${tag}}} copiada!`);
    };

    const getPreviewData = () => {
        const logoPlaceholder = logoUrl ? `<img src="${logoUrl}" style="max-width:150px; max-height:80px;" alt="Logo" />` : ('<div style="background:#e2e8f0; width:150px; height:80px; display:flex; align-items:center; justify-content:center; color:#64748b; margin:0 auto;">Logo</div>');

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
        <div className="space-y-6">
            {/* Template Editor */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FileText size={20} className="text-blue-600" />
                        Template HTML do Recibo de Pagamento (A4)
                    </h3>
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <Eye size={16} />
                        {showPreview ? 'Ocultar' : 'Mostrar'} Preview
                    </button>
                </div>

                <textarea
                    value={template}
                    onChange={(e) => onTemplateChange(e.target.value)}
                    className="w-full h-96 p-4 border border-slate-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Digite o template HTML do recibo de pagamento..."
                />

                <p className="text-sm text-slate-600 mt-2">
                    Use as tags para construir um modelo idêntico ao Termo de Garantia, mas para recibos de pagamento ou compra.
                </p>
            </div>

            {/* Available Tags */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Tags Dinâmicas (Clique para copiar)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(PAYMENT_RECEIPT_TAGS).map(([tag, description]) => (
                        <button
                            key={tag}
                            onClick={() => copyTag(tag)}
                            className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors text-left group"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="font-mono text-sm text-blue-600 truncate">
                                    {`{{${tag}}}`}
                                </div>
                                <div className="text-xs text-slate-600 truncate mt-1">
                                    {description}
                                </div>
                            </div>
                            <Copy size={16} className="text-slate-400 group-hover:text-blue-600 ml-2 flex-shrink-0" />
                        </button>
                    ))}
                </div>
            </div>

            {/* Preview */}
            {showPreview && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Eye size={20} className="text-blue-600" />
                        Preview do HTML Renderizado (Para Impressão)
                    </h3>
                    <div className="border border-slate-300 rounded-lg p-6 bg-white overflow-auto max-h-[800px]">
                        <div dangerouslySetInnerHTML={{ __html: getPreviewData() }} />
                    </div>
                </div>
            )}
        </div>
    );
};
