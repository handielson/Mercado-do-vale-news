import { ShoppingCart, X, Trash2, Copy, Check } from 'lucide-react';
import { useQuoteCart } from '@/contexts/QuoteCartContext';
import { formatPrice } from '@/services/installmentCalculator';
import { generateMultiProductWhatsAppLink, generateMultiProductQuoteMessage } from '@/utils/multiProductQuoteGenerator';
import { useEffect, useState } from 'react';
import type { QuoteCartItem } from '@/contexts/QuoteCartContext';
import toast from 'react-hot-toast';

interface QuoteCartSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onSendQuote?: () => void; // Make optional since we'll implement it here
}

export function QuoteCartSidebar({ isOpen, onClose }: QuoteCartSidebarProps) {
    const { items, removeItem, clear } = useQuoteCart();
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [customNumber, setCustomNumber] = useState(''); // User-entered number
    const [isCopied, setIsCopied] = useState(false);

    // Load WhatsApp number from company settings
    useEffect(() => {
        const loadWhatsAppNumber = async () => {
            try {
                const { supabase } = await import('@/services/supabase');
                const { data } = await supabase
                    .from('company_settings')
                    .select('phone')
                    .single();

                if (data?.phone) {
                    setWhatsappNumber(data.phone);
                }
            } catch (error) {
                console.error('Error loading WhatsApp number:', error);
            }
        };

        loadWhatsAppNumber();
    }, []);


    // Open WhatsApp with message ready (user chooses recipient)
    const handleSendQuote = () => {
        if (items.length === 0) {
            toast.error('Adicione produtos ao carrinho primeiro');
            return;
        }

        const whatsappLink = generateMultiProductWhatsAppLink(items); // No number = open without recipient
        window.location.href = whatsappLink; // Use location.href for better mobile compatibility
        toast.success('Abrindo WhatsApp...');
    };


    // Format phone number as user types
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Remove all non-numeric characters
        const numbers = value.replace(/\D/g, '');

        // Limit to 11 digits (DDD + 9 digits)
        const limited = numbers.slice(0, 11);

        // Format: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
        let formatted = limited;
        if (limited.length > 0) {
            if (limited.length <= 2) {
                formatted = `(${limited}`;
            } else if (limited.length <= 7) {
                formatted = `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
            } else {
                formatted = `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
            }
        }

        setCustomNumber(formatted);
    };

    // Send to specific number (user-entered or configured)
    const handleSendToNumber = () => {
        if (items.length === 0) {
            toast.error('Adicione produtos ao carrinho primeiro');
            return;
        }

        const numberToUse = customNumber || whatsappNumber;

        if (!numberToUse) {
            toast.error('Digite o número do WhatsApp');
            return;
        }

        const whatsappLink = generateMultiProductWhatsAppLink(items, numberToUse);
        window.open(whatsappLink, '_blank');
        toast.success(`Enviando para ${numberToUse}...`);
    };

    const handleCopyQuote = async () => {
        if (items.length === 0) {
            toast.error('Adicione produtos ao carrinho primeiro');
            return;
        }

        try {
            const message = generateMultiProductQuoteMessage(items);
            await navigator.clipboard.writeText(message);
            setIsCopied(true);
            toast.success('Mensagem copiada!');

            // Reset copied state after 2 seconds
            setTimeout(() => setIsCopied(false), 2000);
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            toast.error('Erro ao copiar mensagem');
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Sidebar */}
            <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700">
                    <div className="flex items-center gap-2 text-white">
                        <ShoppingCart className="w-5 h-5" />
                        <h2 className="text-lg font-bold">Orçamento ({items.length})</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <ShoppingCart className="w-16 h-16 mb-4" />
                            <p className="text-center">Nenhum item adicionado</p>
                            <p className="text-sm text-center mt-2">
                                Adicione produtos para criar um orçamento
                            </p>
                        </div>
                    ) : (
                        items.map((item) => (
                            <CartItemCard
                                key={item.id}
                                item={item}
                                onRemove={() => removeItem(item.id)}
                            />
                        ))
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="p-4 border-t border-slate-200 space-y-2 bg-slate-50">
                        {/* Main button: Open WhatsApp (user chooses recipient) */}
                        <button
                            onClick={handleSendQuote}
                            className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-md hover:shadow-lg"
                        >
                            📱 Abrir WhatsApp ({items.length} {items.length === 1 ? 'item' : 'itens'})
                        </button>

                        {/* Send to specific number (user can type) */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-600 font-medium">
                                Ou enviar para número específico:
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="tel"
                                    value={customNumber}
                                    onChange={handlePhoneChange}
                                    placeholder={whatsappNumber || "(11) 99999-9999"}
                                    className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-green-500 focus:outline-none text-sm"
                                    maxLength={15}
                                />
                                <button
                                    onClick={handleSendToNumber}
                                    className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-all text-sm whitespace-nowrap"
                                >
                                    Enviar
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleCopyQuote}
                            className="w-full py-2 px-4 bg-white border-2 border-blue-300 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                        >
                            {isCopied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Copiado!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Copiar Mensagem
                                </>
                            )}
                        </button>
                        <button
                            onClick={clear}
                            className="w-full py-2 px-4 border-2 border-red-300 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-all"
                        >
                            Limpar Carrinho
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

interface CartItemCardProps {
    item: QuoteCartItem;
    onRemove: () => void;
}

function CartItemCard({ item, onRemove }: CartItemCardProps) {
    const { product, variant, availableColors, price, installmentPlan } = item;

    // Clean product name (remove RAM/Storage pattern if present)
    const cleanProductName = product.name.replace(/,?\s*\d+GB\/\d+GB\s*$/i, '').trim();

    return (
        <div className="bg-white border-2 border-slate-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
            {/* Product Name */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-sm text-slate-900 line-clamp-2">
                    {cleanProductName}
                </h3>
                <button
                    onClick={onRemove}
                    className="p-1 hover:bg-red-50 rounded text-red-600 transition-colors flex-shrink-0"
                    title="Remover"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Variant */}
            <div className="text-xs text-slate-600 mb-2">
                <span className="font-medium">{variant.ram}/{variant.storage}</span>
            </div>

            {/* Colors */}
            {availableColors.length > 0 && (
                <div className="text-xs text-slate-600 mb-2">
                    <span className="font-medium">Cores:</span> {availableColors.join(', ')}
                </div>
            )}

            {/* Price - conditional based on payment options */}
            <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                    {/* Show cash price if selected OR if paymentOptions doesn't exist (backward compatibility) */}
                    {(item.paymentOptions?.showCash ?? true) && (
                        <div className="text-sm font-bold text-blue-600 flex items-center gap-1">
                            <span>💰</span>
                            <span>{formatPrice(price)}</span>
                        </div>
                    )}
                    {/* Show installment price if selected OR if paymentOptions doesn't exist (backward compatibility) */}
                    {(item.paymentOptions?.showInstallment ?? true) && installmentPlan.installments > 1 && (
                        <div className="text-xs text-slate-600 flex items-center gap-1">
                            <span>💳</span>
                            <span>{installmentPlan.installments}x de {formatPrice(installmentPlan.value)}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
