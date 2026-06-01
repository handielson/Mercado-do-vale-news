import { ShoppingCart, X, Trash2, Copy, Check } from 'lucide-react';
import { useQuoteCart } from '@/contexts/QuoteCartContext';
import { formatPrice } from '@/services/installmentCalculator';
import { generateMultiProductWhatsAppLink, generateMultiProductQuoteMessage } from '@/utils/multiProductQuoteGenerator';
import { publicCompanySettingsService } from '@/services/publicCompanySettings';
import { useEffect, useState } from 'react';
import type { QuoteCartItem } from '@/contexts/QuoteCartContext';
import toast from 'react-hot-toast';
import { useVpsAuth } from '@/contexts/VpsAuthContext';
import { useCoupon } from '@/hooks/useCoupon';
import { MixedPaymentSimulator, type MixedPaymentState } from './MixedPaymentSimulator';
import { getStoreStatus, type StoreStatus } from '@/utils/storeStatus';

interface QuoteCartSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onSendQuote?: () => void; // Make optional since we'll implement it here
}

export function QuoteCartSidebar({ isOpen, onClose }: QuoteCartSidebarProps) {
    const { items, removeItem, clear } = useQuoteCart();
    const { customer } = useVpsAuth();
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [storeAddress, setStoreAddress] = useState('');
    const [customNumber, setCustomNumber] = useState('');
    const [referralInput, setReferralInput] = useState('');
    const [referralError, setReferralError] = useState('');
    const [referralName, setReferralName] = useState('');
    const [isVerifyingReferral, setIsVerifyingReferral] = useState(false);
    const [cashbackSettings, setCashbackSettings] = useState<any>(null);
    const [mixedPaymentState, setMixedPaymentState] = useState<MixedPaymentState | null>(null);
    const [storeStatus, setStoreStatus] = useState<StoreStatus | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const isAdmin = customer?.customer_type === 'ADMIN';

    // Calculate total cart value in R$ (prices are in centavos)
    const totalCart = items.reduce((sum, item) => sum + (item.price / 100) + ((item.warranty?.price || 0) / 100), 0);
    const coupon = useCoupon(totalCart, customer?.customer_type);

    // Load WhatsApp number from company settings
    useEffect(() => {
        const loadWhatsAppNumber = async () => {
            try {
                const data = await publicCompanySettingsService.get();

                if (data?.phone) {
                    setWhatsappNumber(data.phone);
                }
                if (data?.address) {
                    setStoreAddress(data.address);
                }

                const status = await getStoreStatus(data?.business_hours, data?.holiday_overrides, data?.local_holidays);
                setStoreStatus(status);
            } catch (error) {
                console.error('Error loading WhatsApp number:', error);
            }
        };

        loadWhatsAppNumber();
    }, []);


    // Validate Referral Code on input change
    const applyReferral = async () => {
        if (!referralInput.trim()) return;

        setIsVerifyingReferral(true);
        setReferralError('');
        setReferralName('');

        try {
            const { validateReferralCode } = await import('@/services/cashbackService');
            const result = await validateReferralCode(referralInput, customer?.id);
            if (result.valid && result.referrerName) {
                setReferralName(result.referrerName);
            } else {
                setReferralError(result.error || 'Código válido não encontrado');
            }
        } catch (error) {
            setReferralError('Erro ao validar código');
        } finally {
            setIsVerifyingReferral(false);
        }
    };

    const clearReferral = () => {
        setReferralInput('');
        setReferralName('');
        setReferralError('');
    };

    // Open WhatsApp with message ready (user chooses recipient)
    const handleSendQuote = () => {
        if (items.length === 0) {
            toast.error('Adicione produtos ao carrinho primeiro');
            return;
        }

        const whatsappLink = generateMultiProductWhatsAppLink(
            items,
            undefined, // no specific number
            {
                couponCode: coupon.appliedCoupon?.code,
                couponDiscount: coupon.discount > 0 ? coupon.discount : undefined,
                storeAddress,
                mixedPaymentState,
                referrerName: referralName || undefined,
                referralCode: referralName ? referralInput : undefined
            }
        );
        window.location.href = whatsappLink;
        coupon.confirm();
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

        const whatsappLink = generateMultiProductWhatsAppLink(
            items,
            numberToUse,
            {
                couponCode: coupon.appliedCoupon?.code,
                couponDiscount: coupon.discount > 0 ? coupon.discount : undefined,
                storeAddress,
                mixedPaymentState,
                referrerName: referralName || undefined,
                referralCode: referralName ? referralInput : undefined
            }
        );
        window.open(whatsappLink, '_blank');
        coupon.confirm();
        toast.success(`Enviando para ${numberToUse}...`);
    };

    const handleCopyQuote = async () => {
        if (items.length === 0) {
            toast.error('Adicione produtos ao carrinho primeiro');
            return;
        }

        try {
            const message = generateMultiProductQuoteMessage(
                items,
                {
                    couponCode: coupon.appliedCoupon?.code,
                    couponDiscount: coupon.discount > 0 ? coupon.discount : undefined,
                    storeAddress,
                    mixedPaymentState,
                    referrerName: referralName || undefined,
                    referralCode: referralName ? referralInput : undefined
                }
            );
            await navigator.clipboard.writeText(message);
            setIsCopied(true);
            toast.success('Mensagem copiada!');
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

                {/* Scrollable area: items + form fields + secondary actions */}
                <div className="flex-1 overflow-y-auto">
                    {/* Items List */}
                    <div className="p-4 space-y-3">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center min-h-[40vh] text-slate-400">
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

                    {/* Form fields and secondary actions (only if items > 0) */}
                    {items.length > 0 && (
                    <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50">

                        {/* Referral Field */}
                        {!isAdmin && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
                                    🤝 Fui indicado por (Código)
                                </label>
                                {referralName ? (
                                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                                        <span className="text-xs text-emerald-800 font-medium">
                                            ✅ Indicado por: <strong>{referralName}</strong>
                                        </span>
                                        <button onClick={clearReferral} className="text-emerald-600 hover:text-emerald-800 text-xs underline">Remover</button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            value={referralInput}
                                            onChange={e => { setReferralInput(e.target.value.toUpperCase()); setReferralError(''); }}
                                            onKeyDown={e => e.key === 'Enter' && applyReferral()}
                                            placeholder="CÓDIGO DE INDICAÇÃO"
                                            className={`flex-1 px-3 py-2 border-2 rounded-lg focus:outline-none font-mono uppercase text-xs ${referralError ? 'border-red-400 focus:border-red-500 bg-red-50' : 'border-slate-200 focus:border-blue-500 bg-white'}`}
                                        />
                                        <button
                                            onClick={applyReferral}
                                            disabled={isVerifyingReferral || !referralInput}
                                            className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                            {isVerifyingReferral ? '...' : 'Aplicar'}
                                        </button>
                                    </div>
                                )}
                                {referralError && (
                                    <p className="text-xs text-red-500 font-medium leading-tight">
                                        {referralError}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Coupon Field */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">🎟️ Cupom de desconto</label>
                            {coupon.appliedCoupon ? (
                                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                    <span className="text-xs text-green-800 font-medium">
                                        ✅ <strong>{coupon.appliedCoupon.code}</strong> — {formatPrice(coupon.discount * 100)} de desconto
                                    </span>
                                    <button onClick={coupon.clear} className="text-green-600 hover:text-green-800 text-xs underline">Remover</button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        value={coupon.code}
                                        onChange={e => coupon.setCode(e.target.value.toUpperCase())}
                                        onKeyDown={e => e.key === 'Enter' && coupon.apply()}
                                        placeholder="CÓDIGO DO CUPOM"
                                        className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono uppercase text-xs"
                                    />
                                    <button
                                        onClick={coupon.apply}
                                        disabled={coupon.isLoading || !coupon.code}
                                        className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    >
                                        {coupon.isLoading ? '...' : 'Aplicar'}
                                    </button>
                                </div>
                            )}
                            {coupon.error && <p className="text-xs text-red-600">{coupon.error}</p>}
                        </div>

                        {/* Discount summary */}
                        {coupon.discount > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs">
                                <div className="flex justify-between text-slate-600">
                                    <span>Subtotal:</span>
                                    <span>{formatPrice(totalCart * 100)}</span>
                                </div>
                                <div className="flex justify-between text-green-700 font-medium">
                                    <span>Desconto:</span>
                                    <span>- {formatPrice(coupon.discount * 100)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-slate-900 border-t border-green-200 pt-1 mt-1">
                                    <span>Total:</span>
                                    <span>{formatPrice(coupon.finalPrice * 100)}</span>
                                </div>
                            </div>
                        )}

                        {/* Simulador de Pagamento Combinado (Pix + Cartão) */}
                        <MixedPaymentSimulator
                            totalPrice={Math.round(totalCart * 100)}
                            onChange={setMixedPaymentState}
                        />

                        {/* Avisos de Transporte e Expediente */}
                        {storeStatus && storeStatus.status !== 'open' && !isAdmin && (
                            <div className={`p-3 rounded-lg text-sm border ${storeStatus.status === 'closing_soon' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'} mb-2 mt-2`}>
                                <div className="flex items-center gap-2 font-medium mb-1 relative">
                                    <span className={storeStatus.status === 'closing_soon' ? 'text-amber-500' : 'text-slate-500'}>
                                        {storeStatus.status === 'closing_soon' ? '⚠️' : '🕒'}
                                    </span>
                                    {storeStatus.message}
                                </div>
                                <p className="text-xs">{storeStatus.actionMessage}</p>
                            </div>
                        )}

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

                {/* Sticky bottom: primary CTA */}
                {items.length > 0 && (
                    <div className="p-4 border-t border-slate-200 bg-white shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.08)]">
                        <button
                            onClick={handleSendQuote}
                            disabled={!!referralError || isVerifyingReferral}
                            className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            📱 Abrir WhatsApp ({items.length} {items.length === 1 ? 'item' : 'itens'})
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

            {/* Warranty */}
            {item.warranty && (
                <div className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded inline-flex font-medium mb-2">
                    🛡️ Garantia Estendida: +{item.warranty.months}M (+{formatPrice(item.warranty.price)})
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
