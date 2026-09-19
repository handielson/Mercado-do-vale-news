'use client';

import { useState } from 'react';
import { Share2, MessageCircle, Copy, Check, FileText, ListFilter, Layers3 } from 'lucide-react';
import {
    generateFullCatalogMessage,
    generateCategoryMessage,
    generateFilteredCatalogMessage,
    type CatalogShareFilters,
} from '@/utils/catalogMessageGenerator';
import toast from 'react-hot-toast';

interface ShareCatalogButtonProps {
    categoryId?: string;
    filteredScope?: CatalogShareFilters;
    filteredCount?: number;
}

type ShareScope = 'filtered' | 'complete';

export function ShareCatalogButton({ categoryId, filteredScope, filteredCount }: ShareCatalogButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [shareScope, setShareScope] = useState<ShareScope>('filtered');

    const hasFilteredScope = Boolean(
        filteredScope && (
            filteredScope.search?.trim()
            || filteredScope.brands?.length
            || filteredScope.priceRange
            || filteredScope.inStockOnly
            || filteredScope.featuredOnly
            || filteredScope.newOnly
            || filteredScope.favoritesOnly
        )
    );
    const effectiveScope: ShareScope = hasFilteredScope ? shareScope : 'complete';
    const completeScopeLabel = categoryId ? 'Categoria completa' : 'Catálogo completo';
    const actionScopeLabel = effectiveScope === 'filtered' ? 'Somente os resultados filtrados' : completeScopeLabel;

    const generateSelectedMessage = async () => {
        if (effectiveScope === 'filtered' && filteredScope) {
            return generateFilteredCatalogMessage(filteredScope, 'retail');
        }
        return categoryId
            ? generateCategoryMessage(categoryId, 'retail')
            : generateFullCatalogMessage('retail');
    };

    const handleShareWhatsApp = async () => {
        setIsLoading(true);
        try {
            const message = await generateSelectedMessage();
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
            const message = await generateSelectedMessage();
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
            const { generateFullCatalogPDF, generateCategoryPDF, generateFilteredCatalogPDF } = await import('@/utils/catalogPDFGenerator');

            if (effectiveScope === 'filtered' && filteredScope) {
                await generateFilteredCatalogPDF(filteredScope, 'retail');
            } else if (categoryId) {
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
                onClick={() => {
                    if (!isOpen && hasFilteredScope) setShareScope('filtered');
                    setIsOpen(!isOpen);
                }}
                className={`flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-medium shadow-sm transition-all duration-300 sm:h-auto sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm ${isOpen
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/10'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
            >
                <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="sm:hidden">Compartilhar</span>
                <span className="hidden sm:inline">
                    {hasFilteredScope ? 'Compartilhar' : (categoryId ? 'Compartilhar Categoria' : 'Compartilhar Catálogo')}
                </span>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40 bg-slate-950/20 sm:bg-transparent"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Menu Minimalista */}
                    <div role="dialog" aria-label="Compartilhar catálogo" className="fixed left-3 right-3 top-1/2 z-50 max-h-[calc(100dvh-1.5rem)] w-auto -translate-y-1/2 overflow-y-auto bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-white/20 transform transition-all animate-in fade-in zoom-in-95 duration-200 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:max-h-none sm:w-72 sm:translate-y-0 sm:overflow-hidden sm:origin-top-right">
                        <div className="p-3 space-y-1.5">
                            {hasFilteredScope && (
                                <div className="mb-2 rounded-2xl bg-slate-50 p-1.5">
                                    <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                        O que deseja compartilhar?
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShareScope('filtered')}
                                        className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${shareScope === 'filtered' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
                                    >
                                        <ListFilter className="h-4 w-4 shrink-0" />
                                        <span className="flex-1 text-xs font-semibold">Resultados filtrados</span>
                                        {typeof filteredCount === 'number' && <span className="text-[10px] text-slate-400">{filteredCount}</span>}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShareScope('complete')}
                                        className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${shareScope === 'complete' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
                                    >
                                        <Layers3 className="h-4 w-4 shrink-0" />
                                        <span className="flex-1 text-xs font-semibold">{completeScopeLabel}</span>
                                    </button>
                                </div>
                            )}
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
                                    <div className="text-[11px] text-slate-400 font-medium">{actionScopeLabel}</div>
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
                                    <div className="text-[11px] text-slate-400 font-medium">{actionScopeLabel}</div>
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
                                    <div className="text-[11px] text-slate-400 font-medium">{actionScopeLabel}</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
