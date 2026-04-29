/**
 * WarrantyTermModal Component
 * Modal for displaying and generating warranty terms after sale.
 * Aceita N termos (1 por aparelho serializado) — imprime 2 vias por termo.
 */

import React, { useState } from 'react';
import { FileText, Printer, Receipt, X, Save } from 'lucide-react';
import { renderWarrantyBothCopies } from '../../utils/warrantyTagReplacement';

interface WarrantyTermModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** HTML renderizado de cada termo (1 por aparelho). */
    warrantyContents: string[];
    onGenerate: (signature: string) => Promise<void>;
    /** Template bruto + tagData de cada termo (para reimprimir as 2 vias). */
    warrantyTemplate?: string;
    warrantyTagDataList?: Record<string, string>[];
    onPrintReceipt?: () => void;
}

export const WarrantyTermModal: React.FC<WarrantyTermModalProps> = ({
    isOpen,
    onClose,
    warrantyContents,
    onGenerate,
    warrantyTemplate,
    warrantyTagDataList,
    onPrintReceipt,
}) => {
    const [isGenerating, setIsGenerating] = useState(false);

    if (!isOpen) return null;
    if (!warrantyContents || warrantyContents.length === 0) return null;

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            await onGenerate('');
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrintWarranty = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Para cada termo, gera as 2 vias (cliente + empresa). Total = 2N páginas.
        const sections: string[] = [];
        warrantyContents.forEach((content, idx) => {
            let copy1 = content;
            let copy2 = content.replace(/Assinatura do Cliente/gi, 'Assinatura da Empresa');
            if (warrantyTemplate && warrantyTagDataList?.[idx]) {
                const copies = renderWarrantyBothCopies(warrantyTemplate, warrantyTagDataList[idx]);
                copy1 = copies.copy1;
                copy2 = copies.copy2;
            }
            sections.push(`<div class="warranty-copy">${copy1}</div>`);
            sections.push(`<div class="warranty-copy">${copy2}</div>`);
        });

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Termos de Garantia (${warrantyContents.length} aparelho(s) × 2 vias)</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
                    .warranty-copy { page-break-after: always; margin-bottom: 40px; }
                    .warranty-copy:last-child { page-break-after: auto; }
                    @media print { body { padding: 10mm; } }
                </style>
            </head>
            <body>
                ${sections.join('\n')}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">

                    {/* Header sticky com todos os botões */}
                    <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10 gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <FileText className="text-blue-600" size={22} />
                            <h2 className="text-lg font-bold">
                                {warrantyContents.length > 1
                                    ? `Termos de Garantia (${warrantyContents.length} aparelhos)`
                                    : 'Termo de Garantia'}
                            </h2>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {onPrintReceipt && (
                                <button
                                    onClick={onPrintReceipt}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
                                >
                                    <Receipt size={16} />
                                    Imprimir Recibo
                                </button>
                            )}
                            <button
                                onClick={handlePrintWarranty}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                                <Printer size={16} />
                                {warrantyContents.length > 1
                                    ? `Imprimir ${warrantyContents.length} Termos (${warrantyContents.length * 2} vias)`
                                    : 'Imprimir Garantia'}
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                            >
                                <Save size={16} />
                                {isGenerating ? 'Salvando...' : 'Salvar Termo'}
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Fechar"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Preview de cada termo */}
                        {warrantyContents.map((content, idx) => (
                            <div key={idx} className="space-y-2">
                                {warrantyContents.length > 1 && (
                                    <div className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1.5 rounded">
                                        Aparelho {idx + 1} de {warrantyContents.length}
                                    </div>
                                )}
                                <div className="border border-slate-200 rounded-lg p-6 bg-white overflow-auto max-h-[500px]">
                                    <div dangerouslySetInnerHTML={{ __html: content }} />
                                </div>
                            </div>
                        ))}

                        {/* Info sobre as vias */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-sm text-amber-800">
                                ℹ️ <strong>Importante:</strong> Cada aparelho será impresso em 2 vias:
                            </p>
                            <ul className="text-sm text-amber-700 mt-2 ml-6 list-disc space-y-1">
                                <li><strong>Via da Empresa:</strong> Cliente assina fisicamente após impressão</li>
                                <li><strong>Via do Cliente:</strong> Empresa assina fisicamente após impressão</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
