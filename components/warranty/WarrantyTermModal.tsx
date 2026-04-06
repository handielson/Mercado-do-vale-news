/**
 * WarrantyTermModal Component
 * Modal for displaying and generating warranty terms after sale
 */

import React, { useState } from 'react';
import { FileText, Printer, Receipt, X, Save } from 'lucide-react';
import { renderWarrantyBothCopies } from '../../utils/warrantyTagReplacement';

interface WarrantyTermModalProps {
    isOpen: boolean;
    onClose: () => void;
    warrantyContent: string;
    onGenerate: (signature: string) => Promise<void>;
    warrantyTemplate?: string;
    warrantyTagData?: Record<string, string>;
    onPrintReceipt?: () => void;
}

export const WarrantyTermModal: React.FC<WarrantyTermModalProps> = ({
    isOpen,
    onClose,
    warrantyContent,
    onGenerate,
    warrantyTemplate,
    warrantyTagData,
    onPrintReceipt,
}) => {
    const [isGenerating, setIsGenerating] = useState(false);

    if (!isOpen) return null;

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

        let copy1 = warrantyContent;
        let copy2 = warrantyContent.replace(/Assinatura do Cliente/gi, 'Assinatura da Empresa');
        if (warrantyTemplate && warrantyTagData) {
            const copies = renderWarrantyBothCopies(warrantyTemplate, warrantyTagData);
            copy1 = copies.copy1;
            copy2 = copies.copy2;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Termo de Garantia - 2 Vias</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
                    .warranty-copy { page-break-after: always; margin-bottom: 40px; }
                    .warranty-copy:last-child { page-break-after: auto; }
                    @media print { body { padding: 10mm; } }
                </style>
            </head>
            <body>
                <div class="warranty-copy">${copy1}</div>
                <div class="warranty-copy">${copy2}</div>
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
                            <h2 className="text-lg font-bold">Termo de Garantia</h2>
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
                                Imprimir Garantia
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
                        {/* Warranty Term Preview */}
                        <div className="border border-slate-200 rounded-lg p-6 bg-white overflow-auto max-h-[500px]">
                            <div dangerouslySetInnerHTML={{ __html: warrantyContent }} />
                        </div>

                        {/* Info sobre as vias */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-sm text-amber-800">
                                ℹ️ <strong>Importante:</strong> O termo será impresso em 2 vias:
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
