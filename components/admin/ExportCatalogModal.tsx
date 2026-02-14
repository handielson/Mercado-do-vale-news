'use client';

import { useState } from 'react';
import { X, MessageCircle, Copy, Check, FileText } from 'lucide-react';
import { generateFullCatalogMessage, type CustomerType } from '@/utils/catalogMessageGenerator';
import { generateFullCatalogPDF, generateCategoryPDF } from '@/utils/catalogPDFGenerator';
import toast from 'react-hot-toast';

interface ExportCatalogModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryId?: string;
    categoryName?: string;
}

export function ExportCatalogModal({ isOpen, onClose, categoryId, categoryName }: ExportCatalogModalProps) {
    const [customerType, setCustomerType] = useState<CustomerType>('retail');
    const [exportFormat, setExportFormat] = useState<'whatsapp' | 'copy' | 'pdf'>('pdf');
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsLoading(true);
        try {
            if (exportFormat === 'pdf') {
                // Generate PDF
                if (categoryId) {
                    await generateCategoryPDF(categoryId, customerType);
                } else {
                    await generateFullCatalogPDF(customerType);
                }
                toast.success('PDF gerado com sucesso!');
                onClose();
            } else {
                // Generate text message
                let message: string;

                if (categoryId) {
                    const { generateCategoryMessage } = await import('@/utils/catalogMessageGenerator');
                    message = await generateCategoryMessage(categoryId, customerType);
                } else {
                    message = await generateFullCatalogMessage(customerType);
                }

                if (exportFormat === 'whatsapp') {
                    const encodedMessage = encodeURIComponent(message);
                    const whatsappLink = `whatsapp://send?text=${encodedMessage}`;
                    window.location.href = whatsappLink;
                    toast.success('Abrindo WhatsApp...');
                    onClose();
                } else {
                    await navigator.clipboard.writeText(message);
                    setIsCopied(true);
                    toast.success('Mensagem copiada!');
                    setTimeout(() => {
                        setIsCopied(false);
                        onClose();
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Error exporting catalog:', error);
            toast.error('Erro ao exportar catálogo');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200">
                        <h2 className="text-lg font-bold text-slate-900">
                            {categoryName ? `Exportar ${categoryName}` : 'Exportar Catálogo'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-slate-100 rounded transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-6">
                        {/* Customer Type Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                Tipo de Cliente:
                            </label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                                    <input
                                        type="radio"
                                        name="customerType"
                                        value="retail"
                                        checked={customerType === 'retail'}
                                        onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <div>
                                        <div className="font-medium text-slate-900">Varejo</div>
                                        <div className="text-xs text-slate-500">Preço cheio para consumidor final</div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                                    <input
                                        type="radio"
                                        name="customerType"
                                        value="wholesale"
                                        checked={customerType === 'wholesale'}
                                        onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <div>
                                        <div className="font-medium text-slate-900">Atacado</div>
                                        <div className="text-xs text-slate-500">Preço com desconto para compra em quantidade</div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                                    <input
                                        type="radio"
                                        name="customerType"
                                        value="resale"
                                        checked={customerType === 'resale'}
                                        onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <div>
                                        <div className="font-medium text-slate-900">Revenda</div>
                                        <div className="text-xs text-slate-500">Maior desconto para revendedores</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Export Format Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                Formato:
                            </label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-green-300 transition-colors">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="whatsapp"
                                        checked={exportFormat === 'whatsapp'}
                                        onChange={(e) => setExportFormat(e.target.value as 'whatsapp' | 'copy')}
                                        className="w-4 h-4 text-green-600"
                                    />
                                    <MessageCircle className="w-5 h-5 text-green-600" />
                                    <div>
                                        <div className="font-medium text-slate-900">Mensagem WhatsApp</div>
                                        <div className="text-xs text-slate-500">Abrir WhatsApp com mensagem pronta</div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-red-300 transition-colors">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="pdf"
                                        checked={exportFormat === 'pdf'}
                                        onChange={(e) => setExportFormat(e.target.value as 'whatsapp' | 'copy' | 'pdf')}
                                        className="w-4 h-4 text-red-600"
                                    />
                                    <FileText className="w-5 h-5 text-red-600" />
                                    <div>
                                        <div className="font-medium text-slate-900">Catálogo PDF</div>
                                        <div className="text-xs text-slate-500">Download profissional com dados da empresa</div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="copy"
                                        checked={exportFormat === 'copy'}
                                        onChange={(e) => setExportFormat(e.target.value as 'whatsapp' | 'copy')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    {isCopied ? (
                                        <Check className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <Copy className="w-5 h-5 text-blue-600" />
                                    )}
                                    <div>
                                        <div className="font-medium text-slate-900">
                                            {isCopied ? 'Copiado!' : 'Copiar Texto'}
                                        </div>
                                        <div className="text-xs text-slate-500">Copiar para área de transferência</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 p-4 border-t border-slate-200 bg-slate-50">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isLoading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Gerando...' : 'Gerar Catálogo'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
