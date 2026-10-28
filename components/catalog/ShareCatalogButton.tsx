'use client';

import { useState } from 'react';
import { Share2, MessageCircle, Copy, Check, FileText, ListFilter, Layers3, Send } from 'lucide-react';
import { useVpsAuth } from '@/contexts/VpsAuthContext';
import { n8nBotControlService } from '@/services/n8nBotControlService';
import {
    generateFullCatalogMessage,
    generateCategoryMessage,
    generateFilteredCatalogMessage,
    splitCatalogMessageForWhatsApp,
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
    const { customer } = useVpsAuth();
    const isAdmin = customer?.customer_type === 'ADMIN';
    const [isOpen, setIsOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [shareScope, setShareScope] = useState<ShareScope>('filtered');
    const [pendingParts, setPendingParts] = useState<string[]>([]);
    const [nextPartIndex, setNextPartIndex] = useState(0);
    const [customerPhone, setCustomerPhone] = useState('');
    const [showBotForm, setShowBotForm] = useState(false);
    const [sendProgress, setSendProgress] = useState('');

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

    const getNextSharePart = async () => {
        const parts = pendingParts.length ? pendingParts : splitCatalogMessageForWhatsApp(await generateSelectedMessage());
        if (!pendingParts.length) setPendingParts(parts);
        return { parts, index: nextPartIndex };
    };

    const advanceSharePart = (parts: string[], index: number) => {
        if (index + 1 < parts.length) setNextPartIndex(index + 1);
        else {
            setPendingParts([]);
            setNextPartIndex(0);
            setIsOpen(false);
        }
    };

    const handleShareWhatsApp = async () => {
        setIsLoading(true);
        try {
            const { parts, index } = await getNextSharePart();
            const encodedMessage = encodeURIComponent(parts[index]);
            const whatsappLink = `whatsapp://send?text=${encodedMessage}`;

            window.location.href = whatsappLink;
            toast.success(parts.length > 1 ? `Abrindo parte ${index + 1}/${parts.length}. Envie e volte para a próxima.` : 'Abrindo WhatsApp...');
            advanceSharePart(parts, index);
        } catch (error) {
            console.error('Error sharing catalog:', error);
            toast.error('Erro ao compartilhar catálogo');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendByBot = async () => {
        const digits = customerPhone.replace(/\D/g, '');
        const local = digits.startsWith('55') ? digits.slice(2) : digits;
        if (!/^\d{2}9?\d{8}$/.test(local)) {
            toast.error('Informe o celular do cliente com DDD.');
            return;
        }
        setIsLoading(true);
        let sent = 0;
        try {
            const parts = splitCatalogMessageForWhatsApp(await generateSelectedMessage());
            if (!parts.length || !parts[0].includes('CATÁLOGO')) throw new Error('Catálogo indisponível.');
            for (const part of parts) {
                setSendProgress(`Enviando ${sent + 1} de ${parts.length}...`);
                await n8nBotControlService.sendCatalogSharePart({ phone: `55${local}`, message: part });
                sent += 1;
            }
            toast.success(`${parts.length} mensagem${parts.length > 1 ? 's' : ''} enviada${parts.length > 1 ? 's' : ''} ao cliente.`);
            setSendProgress('');
            setShowBotForm(false);
            setIsOpen(false);
        } catch (error) {
            console.error('Error sending catalog by bot:', error);
            setSendProgress(sent ? `${sent} mensagem${sent > 1 ? 's' : ''} confirmada${sent > 1 ? 's' : ''}. Confira a conversa antes de tentar novamente.` : 'Envio não confirmado. Confira a conversa antes de tentar novamente.');
            toast.error(sent ? `Envio interrompido após ${sent} mensagem${sent > 1 ? 's' : ''}.` : 'Não foi possível confirmar o envio.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyMessage = async () => {
        setIsLoading(true);
        try {
            const { parts, index } = await getNextSharePart();
            await navigator.clipboard.writeText(parts[index]);
            setIsCopied(true);
            toast.success(parts.length > 1 ? `Parte ${index + 1}/${parts.length} copiada. Envie antes da próxima.` : 'Mensagem copiada!');
            advanceSharePart(parts, index);

            setTimeout(() => {
                setIsCopied(false);
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
                            {pendingParts.length > 1 && (
                                <p className="px-2 text-xs text-slate-600">Próxima mensagem: parte {nextPartIndex + 1}/{pendingParts.length}. Envie cada parte na mesma conversa.</p>
                            )}
                            {hasFilteredScope && (
                                <div className="mb-2 rounded-2xl bg-slate-50 p-1.5">
                                    <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                        O que deseja compartilhar?
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => { setShareScope('filtered'); setPendingParts([]); setNextPartIndex(0); }}
                                        className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${shareScope === 'filtered' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
                                    >
                                        <ListFilter className="h-4 w-4 shrink-0" />
                                        <span className="flex-1 text-xs font-semibold">Resultados filtrados</span>
                                        {typeof filteredCount === 'number' && <span className="text-[10px] text-slate-400">{filteredCount}</span>}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShareScope('complete'); setPendingParts([]); setNextPartIndex(0); }}
                                        className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${shareScope === 'complete' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
                                    >
                                        <Layers3 className="h-4 w-4 shrink-0" />
                                        <span className="flex-1 text-xs font-semibold">{completeScopeLabel}</span>
                                    </button>
                                </div>
                            )}
                            {/* Option 1: WhatsApp */}
                            {isAdmin && (
                                <div className="rounded-2xl border border-green-100 bg-green-50/50 p-2">
                                    <button type="button" onClick={() => setShowBotForm(!showBotForm)} className="flex w-full items-center gap-3 rounded-xl p-1 text-left text-sm font-semibold text-green-800">
                                        <Send className="h-5 w-5" /> Enviar ao cliente pelo bot
                                    </button>
                                    {showBotForm && (
                                        <div className="space-y-2 px-1 pb-1 pt-2">
                                            <label htmlFor="catalog-customer-phone" className="block text-xs text-slate-600">Celular do cliente com DDD</label>
                                            <input id="catalog-customer-phone" type="tel" inputMode="tel" autoComplete="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="(87) 99999-9999" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
                                            <p className="text-xs text-slate-600">O bot envia até 3 aparelhos por mensagem, com os preços à vista e no cartão.</p>
                                            {sendProgress && <p role="status" className="text-xs text-slate-700">{sendProgress}</p>}
                                            <button type="button" onClick={handleSendByBot} disabled={isLoading} className="w-full rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{isLoading ? 'Enviando...' : 'Enviar catálogo'}</button>
                                        </div>
                                    )}
                                </div>
                            )}
                            <button
                                onClick={handleShareWhatsApp}
                                disabled={isLoading}
                                className="w-full p-2.5 text-left hover:bg-slate-50 rounded-2xl transition-all duration-200 flex items-center gap-3.5 disabled:opacity-50 group border border-transparent hover:border-slate-100"
                            >
                                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0 group-hover:bg-green-100 transition-colors shadow-sm inner-shadow">
                                    <MessageCircle className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-[13px] font-semibold text-slate-800">{pendingParts.length > 1 ? `Abrir WhatsApp — parte ${nextPartIndex + 1}/${pendingParts.length}` : 'Abrir WhatsApp manualmente'}</div>
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
                                        {isCopied ? 'Copiado!' : (pendingParts.length > 1 ? `Copiar parte ${nextPartIndex + 1}/${pendingParts.length}` : 'Copiar Mensagem')}
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
