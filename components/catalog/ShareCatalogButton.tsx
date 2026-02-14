'use client';

import { useState } from 'react';
import { Share2, MessageCircle, Copy, Check, FileText } from 'lucide-react';
import { generateFullCatalogMessage } from '@/utils/catalogMessageGenerator';
import { generateFullCatalogPDF } from '@/utils/catalogPDFGenerator';
import toast from 'react-hot-toast';

export function ShareCatalogButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleShareWhatsApp = async () => {
        setIsLoading(true);
        try {
            const message = await generateFullCatalogMessage('retail'); // Public always uses retail
            const encodedMessage = encodeURIComponent(message);
            const whatsappLink = `whatsapp://send?text=${encodedMessage}`;

            window.location.href = whatsappLink;
            toast.success('Abrindo WhatsApp...');
            setIsOpen(false);
        } catch (error) {
            console.error('Error sharing catalog:', error);
            toast.error('Erro ao compartilhar catálogo');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyMessage = async () => {
        setIsLoading(true);
        try {
            const message = await generateFullCatalogMessage('retail');
            await navigator.clipboard.writeText(message);
            setIsCopied(true);
            toast.success('Mensagem copiada!');

            setTimeout(() => {
                setIsCopied(false);
                setIsOpen(false);
            }, 2000);
        } catch (error) {
            console.error('Error copying message:', error);
            toast.error('Erro ao copiar mensagem');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        setIsLoading(true);
        try {
            await generateFullCatalogPDF('retail'); // Public always uses retail
            toast.success('PDF baixado com sucesso!');
            setIsOpen(false);
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Erro ao gerar PDF');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
                <Share2 className="w-4 h-4" />
                <span className="font-medium">Compartilhar Catálogo</span>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-20">
                        <div className="py-1">
                            <button
                                onClick={handleShareWhatsApp}
                                disabled={isLoading}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 disabled:opacity-50"
                            >
                                <MessageCircle className="w-5 h-5 text-green-600" />
                                <div>
                                    <div className="font-medium text-slate-900">Via WhatsApp</div>
                                    <div className="text-xs text-slate-500">Compartilhar mensagem</div>
                                </div>
                            </button>

                            <button
                                onClick={handleDownloadPDF}
                                disabled={isLoading}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 disabled:opacity-50"
                            >
                                <FileText className="w-5 h-5 text-red-600" />
                                <div>
                                    <div className="font-medium text-slate-900">Baixar PDF</div>
                                    <div className="text-xs text-slate-500">Catálogo profissional</div>
                                </div>
                            </button>

                            <button
                                onClick={handleCopyMessage}
                                disabled={isLoading}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 disabled:opacity-50"
                            >
                                {isCopied ? (
                                    <Check className="w-5 h-5 text-green-600" />
                                ) : (
                                    <Copy className="w-5 h-5 text-blue-600" />
                                )}
                                <div>
                                    <div className="font-medium text-slate-900">
                                        {isCopied ? 'Copiado!' : 'Copiar Mensagem'}
                                    </div>
                                    <div className="text-xs text-slate-500">Copiar para área de transferência</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
