'use client';

import { useState } from 'react';
import { Share2, MessageCircle, Copy, Check, FileText } from 'lucide-react';
import { generateFullCatalogMessage, generateCategoryMessage } from '@/utils/catalogMessageGenerator';
import { generateFullCatalogPDF, generateCategoryPDF } from '@/utils/catalogPDFGenerator';
import toast from 'react-hot-toast';

interface ShareCatalogButtonProps {
    categoryId?: string;
}

export function ShareCatalogButton({ categoryId }: ShareCatalogButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleShareWhatsApp = async () => {
        setIsLoading(true);
        try {
            const message = categoryId 
                ? await generateCategoryMessage(categoryId, 'retail')
                : await generateFullCatalogMessage('retail');
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
            const message = categoryId 
                ? await generateCategoryMessage(categoryId, 'retail')
                : await generateFullCatalogMessage('retail');
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
            if (categoryId) {
                await generateCategoryPDF(categoryId, 'retail');
            } else {
                await generateFullCatalogPDF('retail'); // Public always uses retail
            }
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
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border text-xs sm:text-sm font-medium transition-all duration-300 shadow-sm whitespace-nowrap ${isOpen
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/10'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
            >
                <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>
                    {categoryId ? 'Compartilhar Categoria' : 'Compartilhar Catálogo'}
                </span>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Menu Minimalista */}
                    <div className="absolute right-0 mt-3 w-64 bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-white/20 z-50 overflow-hidden transform origin-top-right transition-all animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-3 space-y-1.5">
                            {/* Option 1: WhatsApp */}
                            <button
                                onClick={handleShareWhatsApp}
                                disabled={isLoading}
                                className="w-full p-2.5 text-left hover:bg-slate-50 rounded-2xl transition-all duration-200 flex items-center gap-3.5 disabled:opacity-50 group border border-transparent hover:border-slate-100"
                            >
                                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0 group-hover:bg-green-100 transition-colors shadow-sm inner-shadow">
                                    <MessageCircle className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-[13px] font-semibold text-slate-800">Via WhatsApp</div>
                                    <div className="text-[11px] text-slate-400 font-medium">Link inteligente</div>
                                </div>
                            </button>

                            {/* Option 2: PDF */}
                            <button
                                onClick={handleDownloadPDF}
                                disabled={isLoading}
                                className="w-full p-2.5 text-left hover:bg-slate-50 rounded-2xl transition-all duration-200 flex items-center gap-3.5 disabled:opacity-50 group border border-transparent hover:border-slate-100"
                            >
                                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors shadow-sm inner-shadow">
                                    <FileText className="w-5 h-5 text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-[13px] font-semibold text-slate-800">Baixar PDF</div>
                                    <div className="text-[11px] text-slate-400 font-medium">Catálogo offline</div>
                                </div>
                            </button>

                            {/* Option 3: Copy */}
                            <button
                                onClick={handleCopyMessage}
                                disabled={isLoading}
                                className="w-full p-2.5 text-left hover:bg-slate-50 rounded-2xl transition-all duration-200 flex items-center gap-3.5 disabled:opacity-50 group border border-transparent hover:border-slate-100"
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm inner-shadow ${isCopied ? 'bg-green-50 group-hover:bg-green-100' : 'bg-blue-50 group-hover:bg-blue-100'}`}>
                                    {isCopied ? (
                                        <Check className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <Copy className="w-5 h-5 text-blue-600" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="text-[13px] font-semibold text-slate-800">
                                        {isCopied ? 'Copiado!' : 'Copiar Mensagem'}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-medium">Para a área de transferência</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
