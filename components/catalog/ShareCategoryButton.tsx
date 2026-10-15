'use client';

import { useState } from 'react';
import { Share2, MessageCircle, Copy, Check } from 'lucide-react';
import { generateCategoryMessage, splitCatalogMessageForWhatsApp } from '@/utils/catalogMessageGenerator';
import toast from 'react-hot-toast';

interface ShareCategoryButtonProps {
    categoryId: string;
    categoryName: string;
}

export function ShareCategoryButton({ categoryId, categoryName }: ShareCategoryButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingParts, setPendingParts] = useState<string[]>([]);
    const [nextPartIndex, setNextPartIndex] = useState(0);

    const getNextSharePart = async () => {
        const parts = pendingParts.length ? pendingParts : splitCatalogMessageForWhatsApp(await generateCategoryMessage(categoryId, 'retail'));
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
            console.error('Error sharing category:', error);
            toast.error('Erro ao compartilhar categoria');
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

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                title={`Compartilhar ${categoryName}`}
            >
                <Share2 className="w-4 h-4" />
                <span>Compartilhar</span>
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
                        <div className="p-2 border-b border-slate-100">
                            <div className="text-xs font-semibold text-slate-500 uppercase">
                                {categoryName}
                            </div>
                            {pendingParts.length > 1 && <div className="mt-1 text-xs text-slate-600">Próxima: parte {nextPartIndex + 1}/{pendingParts.length}. Envie na mesma conversa.</div>}
                        </div>
                        <div className="py-1">
                            <button
                                onClick={handleShareWhatsApp}
                                disabled={isLoading}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 disabled:opacity-50"
                            >
                                <MessageCircle className="w-5 h-5 text-green-600" />
                                <div>
                                    <div className="font-medium text-slate-900">{pendingParts.length > 1 ? `Via WhatsApp — parte ${nextPartIndex + 1}/${pendingParts.length}` : 'Via WhatsApp'}</div>
                                    <div className="text-xs text-slate-500">Compartilhar mensagem</div>
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
                                        {isCopied ? 'Copiado!' : (pendingParts.length > 1 ? `Copiar parte ${nextPartIndex + 1}/${pendingParts.length}` : 'Copiar Mensagem')}
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
