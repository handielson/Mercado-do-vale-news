import { useState, useEffect, useRef } from 'react';
import { X, Send, Copy, Check, Plus, Coins, Shield } from 'lucide-react';
import type { CatalogProduct } from '@/types/catalog';
import type { VariantSpecs, ProductVariants } from '@/services/productVariants';
import type { InstallmentPlan } from '@/services/installmentCalculator';
import { VariantSelector } from './VariantSelector';
import { MixedPaymentSimulator, type MixedPaymentState } from './MixedPaymentSimulator';
import { DeliveryOptions, type DeliveryOption } from './DeliveryOptions';
import { calculateInstallments } from '@/services/installmentCalculator';
import { generateQuoteMessage, generateWhatsAppLink } from '@/utils/whatsappMessageGenerator';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getEffectivePrice } from '@/hooks/useEffectiveCustomerType';
import { useQuoteCart } from '@/contexts/QuoteCartContext';
import { useCoupon } from '@/hooks/useCoupon';
import { formatPrice } from '@/services/installmentCalculator';
import { getCoinBalance, getCashbackSettings, coinsToReais, validateCoinRedeem } from '@/services/cashbackService';
import { companySettingsService } from '@/services/companySettingsService';
import type { WarrantyOption } from '@/types/companySettings';

interface QuoteModalProps {
    product: CatalogProduct;
    variants: ProductVariants;
    isOpen: boolean;
    onClose: () => void;
    initialVariant?: VariantSpecs; // Pre-selected variant from card
}

export function QuoteModal({ product, variants, isOpen, onClose, initialVariant }: QuoteModalProps) {
    const [selectedVariant, setSelectedVariant] = useState<VariantSpecs>(initialVariant || {});
    const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<InstallmentPlan | null>(null);
    const [delivery, setDelivery] = useState<DeliveryOption>({ type: 'pickup' });
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [availableColors, setAvailableColors] = useState<string[]>([]);
    const [paymentOptions, setPaymentOptions] = useState({
        showCash: true,
        showInstallment: true
    });
    const [mixedPaymentState, setMixedPaymentState] = useState<MixedPaymentState | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Moedas do Vale
    const [coinBalance, setCoinBalance] = useState(0);
    const [coinRate, setCoinRate] = useState(100);
    const [useCoins, setUseCoins] = useState(false);
    const [coinDiscount, setCoinDiscount] = useState(0);
    const [coinsToSpend, setCoinsToSpend] = useState(0);
    const [cashbackSettings, setCashbackSettings] = useState<any>(null);

    // Indicação
    const [referralInput, setReferralInput] = useState('');
    const [referralError, setReferralError] = useState('');
    const [referralName, setReferralName] = useState('');
    const [isVerifyingReferral, setIsVerifyingReferral] = useState(false);

    // Garantia Estendida e Configs de Loja
    const [warrantyOptions, setWarrantyOptions] = useState<WarrantyOption[]>([]);
    const [selectedWarranty, setSelectedWarranty] = useState<WarrantyOption | null>(null);
    const [storeAddress, setStoreAddress] = useState('');

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, []);

    // Get customer context for pricing
    const { customer } = useSupabaseAuth();
    const { addItem } = useQuoteCart();
    const isAdmin = customer?.customer_type === 'ADMIN';

    // Effective price + coupon
    const effectivePrice = getEffectivePrice(product, customer) ?? 0;
    const effectivePriceReais = effectivePrice / 100;
    const coupon = useCoupon(effectivePriceReais, customer?.customer_type);

    // Carregar saldo de moedas do cliente e configs globais da empresa
    useEffect(() => {
        companySettingsService.get().then(settings => {
            if (settings?.extended_warranty_options) {
                setWarrantyOptions(settings.extended_warranty_options.filter(o => o.active));
            }
            if (settings?.address) {
                setStoreAddress(settings.address);
            }
        }).catch(() => { });

        if (!customer || isAdmin) return;
        Promise.all([getCoinBalance(customer.id), getCashbackSettings()])
            .then(([bal, settings]) => {
                setCoinBalance(bal?.balance ?? 0);
                setCoinRate(settings.coins_to_brl_rate);
                setCashbackSettings(settings);
            })
            .catch(() => { });
    }, [customer, isAdmin]);

    // Validate Referral Code on input change (Debounced)
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

    // Recalcular desconto de moedas quando ativado
    useEffect(() => {
        if (!useCoins || !customer || coinBalance <= 0) {
            setCoinDiscount(0);
            setCoinsToSpend(0);
            return;
        }
        const baseReais = coupon.finalPrice > 0 ? coupon.finalPrice : effectivePriceReais - coupon.discount;
        validateCoinRedeem(customer.id, coinBalance, baseReais)
            .then(v => {
                if (v.valid) {
                    setCoinDiscount(v.discount_brl);
                    setCoinsToSpend(v.coins_to_use);
                } else {
                    setCoinDiscount(0);
                    setCoinsToSpend(0);
                }
            })
            .catch(() => { });
    }, [useCoins, coinBalance, coupon.finalPrice, effectivePriceReais, coupon.discount, customer]);

    // Update selected variant when initialVariant changes (when modal opens with pre-selected variant)
    useEffect(() => {
        if (initialVariant && (initialVariant.ram || initialVariant.storage || initialVariant.color)) {
            setSelectedVariant(initialVariant);
        }
    }, [initialVariant]);

    // Debug: Log admin status when modal opens
    useEffect(() => {
        if (isOpen) {
            console.log('🔐 QuoteModal opened:', {
                isAdmin,
                customerType: customer?.customer_type,
                hasCustomer: !!customer,
                customerData: customer
            });
        }
    }, [isOpen, isAdmin, customer]);

    // Load available colors in stock for admin users
    useEffect(() => {
        const loadAvailableColors = async () => {
            // Only load for admin users
            if (customer?.customer_type !== 'ADMIN') {
                setAvailableColors([]);
                return;
            }

            // Only load if we have a selected variant with RAM and Storage
            if (!selectedVariant.ram || !selectedVariant.storage) {
                setAvailableColors([]);
                return;
            }

            try {
                const { supabase } = await import('@/services/supabase');

                // Query products with same model, RAM, Storage and stock > 0
                // Use model_id if available, otherwise use model name
                let query = supabase
                    .from('products')
                    .select('specs')
                    .eq('specs->>ram', selectedVariant.ram)
                    .eq('specs->>storage', selectedVariant.storage)
                    .gt('stock_quantity', 0);

                // Add model filter
                if (product.model_id) {
                    query = query.eq('model_id', product.model_id);
                } else if (product.model) {
                    query = query.eq('model', product.model);
                } else {
                    // Fallback to product name
                    query = query.eq('name', product.name);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('Error loading available colors:', error);
                    setAvailableColors([]);
                    return;
                }

                console.log('🔍 Color Query Debug:', {
                    searchingFor: {
                        ram: selectedVariant.ram,
                        storage: selectedVariant.storage,
                        model_id: product.model_id,
                        model: product.model,
                        name: product.name
                    },
                    productsFound: data?.length || 0,
                    products: data?.map(p => ({
                        ram: p.specs?.ram,
                        storage: p.specs?.storage,
                        color: p.specs?.color
                    }))
                });

                if (data) {
                    // Extract unique colors
                    const colors = data
                        .map(p => p.specs?.color)
                        .filter((color): color is string => Boolean(color));

                    console.log('🎨 Colors loaded:', {
                        variant: `${selectedVariant.ram}/${selectedVariant.storage}`,
                        productsFound: data.length,
                        colorsFound: colors,
                        uniqueColors: [...new Set(colors)]
                    });

                    setAvailableColors([...new Set(colors)]);
                }
            } catch (error) {
                console.error('Error loading available colors:', error);
                setAvailableColors([]);
            }
        };

        loadAvailableColors();
    }, [product.model_id, selectedVariant.ram, selectedVariant.storage, customer]);

    // Calculate total price including warranty
    const warrantyPrice = selectedWarranty ? Math.round((effectivePrice * selectedWarranty.percentage) / 100) : 0;
    const effectivePriceWithWarranty = effectivePrice + warrantyPrice;

    // Convert to final cents considering coupon and coins
    const finalTotalCents = effectivePriceWithWarranty - Math.round(coupon.discount * 100) - Math.round(coinDiscount * 100);
    const finalTotalReais = finalTotalCents / 100;

    // Load installment plans when price changes
    useEffect(() => {
        if (!finalTotalCents) return;

        const loadPlans = async () => {
            const plans = await calculateInstallments(finalTotalCents, 12);
            setInstallmentPlans(plans);
            setSelectedPlan(plans.find(p => p.highlighted) || plans[0]);
        };

        loadPlans();
    }, [finalTotalCents, customer]);

    // Generate WhatsApp message
    const handleSendWhatsApp = async () => {
        if (!selectedPlan) return;

        setIsLoading(true);
        try {
            const message = generateQuoteMessage({
                product,
                variant: selectedVariant,
                installmentPlan: selectedPlan,
                delivery,
                userType: customer?.customer_type,
                availableColors,
                couponCode: coupon.appliedCoupon?.code,
                couponDiscount: coupon.discount > 0 ? coupon.discount : undefined,
                referrerName: customer?.name,
                referralCode: customer?.referral_code,
                storeAddress,
                selectedWarranty: selectedWarranty ? {
                    months: selectedWarranty.months,
                    price: warrantyPrice
                } : undefined,
                paymentOptions,
                mixedPaymentState,
                cashPrice: finalTotalCents
            });

            const link = await generateWhatsAppLink(message);
            window.location.href = link;
            // Confirm coupon usage after sending
            await coupon.confirm();
        } catch (error) {
            console.error('Error generating WhatsApp link:', error);
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            alert(`Erro ao gerar link do WhatsApp: ${errorMessage}\n\nPor favor, tente novamente ou entre em contato conosco.`);
        } finally {
            setIsLoading(false);
        }
    };

    // Copy message to clipboard
    const handleCopyMessage = () => {
        if (!selectedPlan) return;

        const message = generateQuoteMessage({
            product,
            variant: selectedVariant,
            installmentPlan: selectedPlan,
            delivery,
            userType: customer?.customer_type,
            availableColors: availableColors,
            referrerName: customer?.name,
            referralCode: customer?.referral_code,
            selectedWarranty: selectedWarranty ? {
                months: selectedWarranty.months,
                price: warrantyPrice
            } : undefined,
            paymentOptions,
            mixedPaymentState,
            cashPrice: finalTotalCents
        });

        navigator.clipboard.writeText(message);
        setIsCopied(true);

        // Clear previous timeout to prevent accumulation
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setIsCopied(false);
            timeoutRef.current = null;
        }, 2000);
    };

    // Add to cart (admin only)
    const handleAddToCart = () => {
        if (!selectedPlan) return;

        // Only require variant if product has RAM/Storage options
        if (variants.rams.length > 0 && (!selectedVariant.ram || !selectedVariant.storage)) {
            alert('Por favor, selecione a memória');
            return;
        }

        const effectivePrice = getEffectivePrice(product, customer);
        if (!effectivePrice) return;

        addItem({
            product,
            variant: {
                ram: selectedVariant.ram,
                storage: selectedVariant.storage,
                color: selectedVariant.color
            },
            availableColors,
            price: effectivePrice,
            installmentPlan: selectedPlan,
            paymentOptions,
            ...(selectedWarranty ? {
                warranty: {
                    months: selectedWarranty.months,
                    price: warrantyPrice
                }
            } : {})
        });

        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-600" />
                    </button>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Header */}
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Fazer Pedido</h2>
                            <p className="text-sm text-slate-600 mt-1">{product.name}</p>
                        </div>

                        {/* Variant Selection */}
                        <VariantSelector
                            variants={{
                                ...variants,
                                // Hide color selection for admin users (colors will be auto-included)
                                colors: customer?.customer_type === 'ADMIN' ? [] : variants.colors
                            }}
                            selected={selectedVariant}
                            onSelect={setSelectedVariant}
                        />

                        {/* Show available colors info for admin */}
                        {customer?.customer_type === 'ADMIN' && availableColors.length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm font-medium text-blue-900 mb-2">
                                    📋 Cores disponíveis em estoque:
                                </p>
                                <p className="text-sm text-blue-700">
                                    {availableColors.join(', ')}
                                </p>
                                <p className="text-xs text-blue-600 mt-2">
                                    Todas as cores serão incluídas automaticamente no orçamento
                                </p>
                            </div>
                        )}

                        {/* Garantia Estendida */}
                        {warrantyOptions.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-blue-600" />
                                    Garantia Estendida
                                </label>
                                <select
                                    value={selectedWarranty?.months || ''}
                                    onChange={(e) => {
                                        const opt = warrantyOptions.find(o => o.months === Number(e.target.value));
                                        setSelectedWarranty(opt || null);
                                    }}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                    <option value="">Sem garantia estendida</option>
                                    {warrantyOptions.sort((a, b) => a.months - b.months).map(opt => {
                                        const cost = Math.round((effectivePrice * opt.percentage) / 100);
                                        return (
                                            <option key={opt.months} value={opt.months}>
                                                +{opt.months} Meses (+ {formatPrice(cost)})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        )}

                        {/* Simulador de Pagamento Combinado (Pix + Cartão) */}
                        {installmentPlans.length > 0 && (
                            <MixedPaymentSimulator
                                totalPrice={effectivePriceWithWarranty}
                                onChange={setMixedPaymentState}
                            />
                        )}

                        {/* Delivery Options */}
                        <DeliveryOptions
                            selected={delivery}
                            onSelect={setDelivery}
                        />

                        {/* Payment Options (Admin Only) */}
                        {isAdmin && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                                <p className="text-sm font-medium text-blue-900 mb-2">
                                    📋 Incluir no orçamento:
                                </p>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 p-1.5 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={paymentOptions.showCash}
                                            onChange={(e) => {
                                                // Only prevent unchecking if it's the last option checked
                                                if (!e.target.checked && !paymentOptions.showInstallment) {
                                                    return; // Can't uncheck if installment is also unchecked
                                                }
                                                setPaymentOptions(prev => ({
                                                    ...prev,
                                                    showCash: e.target.checked
                                                }));
                                            }}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-blue-800 font-medium">
                                            💰 Preço à vista
                                        </span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 p-1.5 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={paymentOptions.showInstallment}
                                            onChange={(e) => {
                                                // Only prevent unchecking if it's the last option checked
                                                if (!e.target.checked && !paymentOptions.showCash) {
                                                    return; // Can't uncheck if cash is also unchecked
                                                }
                                                setPaymentOptions(prev => ({
                                                    ...prev,
                                                    showInstallment: e.target.checked
                                                }));
                                            }}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-blue-800 font-medium">
                                            💳 Preço parcelado
                                        </span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Campo de Indicação (Referral) */}
                        {!isAdmin && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    🤝 Fui indicado por um amigo (Código)
                                </label>
                                {referralName ? (
                                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                                        <span className="text-sm text-emerald-800 font-medium">
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
                                            className={`flex-1 px-3 py-2 border-2 rounded-lg focus:outline-none font-mono uppercase text-sm ${referralError ? 'border-red-400 focus:border-red-500 bg-red-50' : 'border-slate-200 focus:border-blue-500 bg-white'}`}
                                        />
                                        <button
                                            onClick={applyReferral}
                                            disabled={isVerifyingReferral || !referralInput}
                                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                            {isVerifyingReferral ? '...' : 'Aplicar'}
                                        </button>
                                    </div>
                                )}
                                {referralError && (
                                    <p className="text-xs text-red-500 font-medium">
                                        {referralError}
                                    </p>
                                )}
                                {!referralName && !referralError && !isVerifyingReferral && (
                                    <p className="text-xs text-slate-500">
                                        Mande o código de quem te indicou para que ele ganhe Moedas do Vale!
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Coupon Field */}
                        {!isAdmin && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">🎟️ Cupom de desconto</label>
                                {coupon.appliedCoupon ? (
                                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                        <span className="text-sm text-green-800 font-medium">
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
                                            className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono uppercase text-sm"
                                        />
                                        <button
                                            onClick={coupon.apply}
                                            disabled={coupon.isLoading || !coupon.code}
                                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                            {coupon.isLoading ? '...' : 'Aplicar'}
                                        </button>
                                    </div>
                                )}
                                {coupon.error && <p className="text-xs text-red-600">Cupom não encontrado</p>}
                            </div>
                        )}

                        {/* Moedas do Vale */}
                        {!isAdmin && customer && coinBalance > 0 && (
                            <div className="space-y-2">
                                <label className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-amber-100 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <Coins className="w-4 h-4 text-amber-600" />
                                        <span className="text-sm font-medium text-amber-800">
                                            Usar Moedas do Vale
                                        </span>
                                        <span className="text-xs text-amber-600">
                                            ({coinBalance} moedas ≈ R$ {coinsToReais(coinBalance, coinRate).toFixed(2).replace('.', ',')})
                                        </span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={useCoins}
                                        onChange={e => setUseCoins(e.target.checked)}
                                        className="w-4 h-4 text-amber-500 rounded"
                                    />
                                </label>
                                {useCoins && coinDiscount > 0 && (
                                    <p className="text-xs text-amber-700 px-1">
                                        🪙 -{coinsToSpend} moedas = <strong>-R$ {coinDiscount.toFixed(2).replace('.', ',')}</strong> de desconto
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Resumo de descontos */}
                        {(coupon.discount > 0 || coinDiscount > 0 || warrantyPrice > 0) && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-1">
                                <div className="flex justify-between text-slate-600">
                                    <span>Produto:</span>
                                    <span>{formatPrice(effectivePrice)}</span>
                                </div>
                                {warrantyPrice > 0 && (
                                    <div className="flex justify-between text-blue-700">
                                        <span>Garantia (+{selectedWarranty?.months}m):</span>
                                        <span>+ {formatPrice(warrantyPrice)}</span>
                                    </div>
                                )}
                                {coupon.discount > 0 && (
                                    <div className="flex justify-between text-green-700">
                                        <span>Cupom ({coupon.appliedCoupon?.code}):</span>
                                        <span>- {formatPrice(coupon.discount * 100)}</span>
                                    </div>
                                )}
                                {coinDiscount > 0 && (
                                    <div className="flex justify-between text-amber-700">
                                        <span>Moedas ({coinsToSpend} 🪙):</span>
                                        <span>- R$ {coinDiscount.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1 mt-1">
                                    <span>Total:</span>
                                    <span>{formatPrice(finalTotalCents)}</span>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 border-t border-slate-200">
                            {isAdmin ? (
                                // Admin: Add to cart button
                                <button
                                    onClick={handleAddToCart}
                                    disabled={!selectedPlan || (variants.rams.length > 0 && (!selectedVariant.ram || !selectedVariant.storage))}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Adicionar ao Orçamento
                                </button>
                            ) : (
                                // Customer: Copy and Send buttons
                                <>
                                    <button
                                        onClick={handleCopyMessage}
                                        className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isCopied ? (
                                            <>
                                                <Check className="w-5 h-5" />
                                                Copiado!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-5 h-5" />
                                                Copiar Texto
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={handleSendWhatsApp}
                                        disabled={isLoading || !selectedPlan || !!referralError || isVerifyingReferral}
                                        className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <Send className="w-5 h-5" />
                                        {isLoading ? 'Gerando...' : 'Enviar WhatsApp'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
