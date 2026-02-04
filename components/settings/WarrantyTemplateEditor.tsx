/**
 * WarrantyTemplateEditor Component
 * Editor for warranty term template with tag support
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Controlled component with clear state management
 * - Tag list for easy copying
 * - Preview with example data
 * - Display options for company info
 */

import React from 'react';
import { Copy, Eye, FileText } from 'lucide-react';
import { WARRANTY_TAGS } from '../../types/warrantyDocument';
import { toast } from 'sonner';

interface WarrantyTemplateEditorProps {
    template: string;
    onTemplateChange: (template: string) => void;
    logoUrl: string;
    showLogo: boolean;
    showCompanyName: boolean;
    showCnpj: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showAddress: boolean;
    onToggle: (field: string, value: boolean) => void;
}

export const WarrantyTemplateEditor: React.FC<WarrantyTemplateEditorProps> = ({
    template,
    onTemplateChange,
    logoUrl,
    showLogo,
    showCompanyName,
    showCnpj,
    showPhone,
    showEmail,
    showAddress,
    onToggle
}) => {
    const [showPreview, setShowPreview] = React.useState(false);

    const copyTag = (tag: string) => {
        navigator.clipboard.writeText(`{{${tag}}}`);
        toast.success(`Tag {{${tag}}} copiada!`);
    };

    const getPreviewData = () => {
        // Use real logo or SVG placeholder
        const logoPlaceholder = logoUrl || ('data:image/svg+xml;base64,' + btoa(`
            <svg width="150" height="80" xmlns="http://www.w3.org/2000/svg">
                <rect width="150" height="80" fill="#e2e8f0"/>
                <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#64748b" text-anchor="middle" dominant-baseline="middle">Logo</text>
            </svg>
        `));

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
            .replace(/{{numero_venda}}/g, 'VD-12345')
            .replace(/{{data_compra}}/g, new Date().toLocaleDateString('pt-BR'))
            .replace(/{{produto}}/g, 'iPhone 13 128GB')
            .replace(/{{marca}}/g, 'Apple')
            .replace(/{{modelo}}/g, 'iPhone 13')
            .replace(/{{cor}}/g, 'Azul')
            .replace(/{{ram}}/g, '4GB')
            .replace(/{{memoria}}/g, '128GB')
            .replace(/{{imei1}}/g, '123456789012345')
            .replace(/{{imei2}}/g, '543210987654321')
            .replace(/{{dias_garantia}}/g, '90')
            .replace(/{{tipo_garantia}}/g, 'Garantia Legal')
            .replace(/{{declaracao_recebimento}}/g, 'Declaro que retirei a mercadoria na loja em perfeito estado e testei.');
    };

    return (
        <div className="space-y-6">
            {/* Display Options */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-blue-600" />
                    Opções de Exibição
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showLogo}
                            onChange={(e) => onToggle('warranty_show_logo', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm">Mostrar Logo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showCompanyName}
                            onChange={(e) => onToggle('warranty_show_company_name', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm">Mostrar Nome da Empresa</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showCnpj}
                            onChange={(e) => onToggle('warranty_show_cnpj', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm">Mostrar CNPJ</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showPhone}
                            onChange={(e) => onToggle('warranty_show_phone', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm">Mostrar Telefone</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showEmail}
                            onChange={(e) => onToggle('warranty_show_email', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm">Mostrar Email</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showAddress}
                            onChange={(e) => onToggle('warranty_show_address', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm">Mostrar Endereço</span>
                    </label>
                </div>
            </div>

            {/* Template Editor */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Template do Termo de Garantia</h3>
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
                    placeholder="Digite o template do termo de garantia..."
                />

                <p className="text-sm text-slate-600 mt-2">
                    Use as tags abaixo para inserir dados dinâmicos no termo
                </p>
            </div>

            {/* Available Tags */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Tags Disponíveis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(WARRANTY_TAGS).map(([tag, description]) => (
                        <button
                            key={tag}
                            onClick={() => copyTag(tag)}
                            className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors text-left group"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="font-mono text-sm text-blue-600 truncate">
                                    {`{{${tag}}}`}
                                </div>
                                <div className="text-xs text-slate-600 truncate">
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
                        Preview com Dados de Exemplo
                    </h3>
                    <div className="border border-slate-300 rounded-lg p-6 bg-white overflow-auto max-h-[600px]">
                        <div dangerouslySetInnerHTML={{ __html: getPreviewData() }} />
                    </div>
                </div>
            )}
        </div>
    );
};
