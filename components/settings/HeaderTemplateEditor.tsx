import React from 'react';
import { Copy, Eye, LayoutTemplate, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface HeaderTemplateEditorProps {
    templateA4: string;
    templateThermal: string;
    onTemplateA4Change: (template: string) => void;
    onTemplateThermalChange: (template: string) => void;
    logoUrl: string;
    showLogo: boolean;
    showCompanyName: boolean;
    showCnpj: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showAddress: boolean;
    onToggle: (field: string, value: boolean) => void;
}

export const HeaderTemplateEditor: React.FC<HeaderTemplateEditorProps> = ({
    templateA4,
    templateThermal,
    onTemplateA4Change,
    onTemplateThermalChange,
    logoUrl,
    showLogo,
    showCompanyName,
    showCnpj,
    showPhone,
    showEmail,
    showAddress,
    onToggle
}) => {
    const getPreviewData = (template: string) => {
        const logoPlaceholder = logoUrl ? `<img src="${logoUrl}" style="max-height:80px;object-fit:contain;" alt="Logo" />` : ('<div style="background:#e2e8f0; width:150px; height:80px; display:flex; align-items:center; justify-content:center; color:#64748b;">Logo</div>');

        return template
            .replace(/{{logo}}/g, logoPlaceholder)
            .replace(/{{nome_loja}}/g, 'Mercado do Vale')
            .replace(/{{endereco}}/g, 'Rua Exemplo, 123 - Centro - Cidade/UF')
            .replace(/{{telefone}}/g, '(11) 98765-4321')
            .replace(/{{email}}/g, 'contato@mercadodovale.com.br')
            .replace(/{{cnpj}}/g, '12.345.678/0001-90')
            .replace(/{{nome_documento}}/g, 'NOME DO DOCUMENTO');
    };

    return (
        <div className="space-y-6">
            {/* Display Options Global */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-blue-600" />
                    Opções Globais de Exibição
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                    Ative ou desative informações para ocultá-las de <strong>TODOS os cabeçalhos</strong> impressos pela loja.
                </p>
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

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                <p className="text-sm text-yellow-700">
                    <strong>Atenção:</strong> Estes blocos definem o layout do <strong>TOPO</strong> dos documentos.
                    As tags como <code>{"{{logo}}"}</code> serão ocultadas automaticamente caso você desmarque as caixas acima.
                </p>
            </div>

            {/* Template Editor A4 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <LayoutTemplate size={20} className="text-blue-600" />
                            Cabeçalho de Página Inteira (A4)
                        </h3>
                    </div>

                    <textarea
                        value={templateA4}
                        onChange={(e) => onTemplateA4Change(e.target.value)}
                        className="flex-1 w-full min-h-[300px] p-4 border border-slate-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Digite o HTML base para o cabeçalho A4..."
                    />
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col h-full">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Eye size={20} className="text-blue-600" />
                        Preview do Cabeçalho A4
                    </h3>
                    <div className="flex-1 w-full border border-slate-300 rounded-lg p-6 bg-white overflow-auto">
                        <div dangerouslySetInnerHTML={{ __html: getPreviewData(templateA4) }} />
                    </div>
                </div>
            </div>

            {/* Template Editor Thermal */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <LayoutTemplate size={20} className="text-blue-600" />
                            Cabeçalho de Bobina (Térmica)
                        </h3>
                    </div>

                    <textarea
                        value={templateThermal}
                        onChange={(e) => onTemplateThermalChange(e.target.value)}
                        className="flex-1 w-full min-h-[300px] p-4 border border-slate-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Digite o HTML base para o cabeçalho da Térmica..."
                    />
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col h-full">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Eye size={20} className="text-blue-600" />
                        Preview do Cabeçalho Térmico
                    </h3>
                    <div className="flex-1 w-full border border-slate-300 rounded-lg p-6 bg-white overflow-auto flex items-center justify-center">
                        <div className="max-w-[80mm] w-full border border-dashed border-slate-300 bg-slate-50 p-2 overflow-hidden break-words">
                            <div dangerouslySetInnerHTML={{ __html: getPreviewData(templateThermal) }} />
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};
