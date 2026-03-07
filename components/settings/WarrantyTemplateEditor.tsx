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

import React, { useState } from 'react';
import { Eye, FileText } from 'lucide-react';

interface WarrantyTemplateEditorProps {
    title: string;
    template: string;
    onTemplateChange: (template: string) => void;
    logoUrl?: string;
    getPreviewHTML: (template: string, logoUrl?: string) => string;
}

export const WarrantyTemplateEditor: React.FC<WarrantyTemplateEditorProps> = ({
    title,
    template,
    onTemplateChange,
    logoUrl,
    getPreviewHTML
}) => {
    const getPreviewData = () => {
        return getPreviewHTML(template, logoUrl);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm flex flex-col h-full">

                {/* Header Navbar interno */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <FileText size={18} className="text-blue-600" />
                        {title}
                    </h3>
                </div>

                <div className="p-4 bg-slate-50/50 flex-1 flex flex-col">
                    <div className="bg-blue-50 border border-blue-100 rounded-md p-3 mb-4 flex items-start gap-3">
                        <FileText className="text-blue-500 mt-0.5" size={18} />
                        <p className="text-sm text-blue-800 leading-relaxed">
                            Insira o <strong>HTML do seu contrato</strong> aqui. Para inserir dados do cliente ou venda que mudam a cada pedido, vá na aba lateral "Dicionário de Tags" para ver os códigos suportados.
                        </p>
                    </div>
                    <textarea
                        value={template}
                        onChange={(e) => onTemplateChange(e.target.value)}
                        className="flex-1 w-full min-h-[400px] p-4 border border-slate-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="<html><body><h1>Garantia</h1></body></html>..."
                    />
                </div>
            </div>

            {/* View: Preview */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Eye size={18} className="text-blue-600" />
                        Preview (Para Impressão)
                    </h3>
                </div>
                <div className="p-4 bg-slate-100 shadow-inner flex-1 overflow-auto flex justify-center">
                    <div className="w-full max-w-[800px] h-fit bg-white border border-slate-300 shadow-sm p-8" dangerouslySetInnerHTML={{ __html: getPreviewData() }} />
                </div>
            </div>
        </div>
    );
};
