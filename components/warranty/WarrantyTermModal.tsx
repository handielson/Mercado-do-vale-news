/**
 * WarrantyTermModal Component
 * Modal for displaying and generating warranty terms after sale
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Shows warranty term with tags already replaced
 * - Allows delivery type selection
 * - Captures customer signature
 * - Prints or saves warranty document
 */

import React, { useState } from 'react';
import { FileText, Printer, X } from 'lucide-react';
import { DeliveryTypeWarranty } from '../../types/warrantyDocument';
import { renderWarrantyBothCopies } from '../../utils/warrantyTagReplacement';

interface WarrantyTermModalProps {
    isOpen: boolean;
    onClose: () => void;
    warrantyContent: string; // Already with tags replaced
    deliveryType: DeliveryTypeWarranty;
    onDeliveryTypeChange: (type: DeliveryTypeWarranty) => void;
    onGenerate: (signature: string) => Promise<void>;
    // Optional: provide template + tagData for proper two-copy rendering
    warrantyTemplate?: string;
    warrantyTagData?: Record<string, string>;
}

export const WarrantyTermModal: React.FC<WarrantyTermModalProps> = ({
    isOpen,
    onClose,
    warrantyContent,
    deliveryType,
    onDeliveryTypeChange,
    onGenerate,
    warrantyTemplate,
    warrantyTagData
}) => {
    const [isGenerating, setIsGenerating] = useState(false);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            await onGenerate(''); // No signature needed
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Gerar as duas cópias diferenciadas
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
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                        line-height: 1.6;
                    }
                    .warranty-copy {
                        page-break-after: always;
                        margin-bottom: 40px;
                    }
                    .warranty-copy:last-child {
                        page-break-after: auto;
                    }
                    @media print {
                        body {
                            padding: 10mm;
                        }
                    }
                </style>
            </head>
            <body>
                <!-- VIA 1: EMPRESA - Cliente assina -->
                <div class="warranty-copy">
                    ${copy1}
                </div>

                <!-- VIA 2: CLIENTE - Empresa assina -->
                <div class="warranty-copy">
                    ${copy2}
                </div>
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
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                            <FileText className="text-blue-600" size={24} />
                            <h2 className="text-xl font-bold">Termo de Garantia</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Delivery Type Selection */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Tipo de Entrega
                            </label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={deliveryType === 'store_pickup'}
                                        onChange={() => onDeliveryTypeChange('store_pickup')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm">Retirada na Loja</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={deliveryType === 'delivery'}
                                        onChange={() => onDeliveryTypeChange('delivery')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm">Entrega</span>
                                </label>
                            </div>
                            <p className="text-xs text-blue-700 mt-2">
                                {deliveryType === 'store_pickup'
                                    ? '📦 Retirada na loja: Cliente retira pessoalmente'
                                    : '🚚 Entrega: Produto será entregue ao cliente'}
                            </p>
                        </div>

                        {/* Warranty Term Preview */}
                        <div className="border border-slate-200 rounded-lg p-6 bg-white overflow-auto max-h-[500px]">
                            <div dangerouslySetInnerHTML={{ __html: warrantyContent }} />
                        </div>

                        {/* Info about signatures */}
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

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2 p-6 border-t bg-slate-50">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Printer size={18} />
                            Imprimir 2 Vias
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isGenerating ? 'Salvando...' : 'Salvar Termo'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
