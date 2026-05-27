import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Copy, Check, Plus, Coins, Shield, CreditCard, Smartphone, Truck, ChevronDown, ShoppingBag } from 'lucide-react';
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
import { useCart } from '@/contexts/CartContext';
import { useCoupon } from '@/hooks/useCoupon';
import { formatPrice } from '@/services/installmentCalculator';
import { getCoinBalance, getCashbackSettings, coinsToReais, validateCoinRedeem } from '@/services/cashbackService';
import { publicCompanySettingsService } from '@/services/publicCompanySettings';
import { getStoreStatus, type StoreStatus } from '@/utils/storeStatus';
import type { WarrantyOption } from '@/types/companySettings';
import { categoryService } from '@/services/categories';
import { paymentIntegrationService } from '@/services/paymentIntegrationService';
import { createOrder } from '@/services/orderService';
import { vpsApiService } from '@/services/vpsApiService';
import toast from 'react-hot-toast';

interface QuoteModalProps {
    product: CatalogProduct;
    variants: ProductVariants;
    isOpen: boolean;
    onClose: () => void;
    initialVariant?: VariantSpecs;
    inline?: boolean;
    totalOverride?: number;
    // Garantia controlada externamente (usado pelo CartPage)
    selectedWarranty?: WarrantyOption | null;
    onWarrantyChange?: (w: WarrantyOption | null) => void;
    // Entrega controlada externamente (usado pelo CartPage)
    selectedDelivery?: DeliveryOption;
    onDeliveryChange?: (d: DeliveryOption) => void;
    // Cupom e indicação externos (usado pelo CartPage)
    externalCouponCode?: string;
    externalCouponDiscount?: number;   // em centavos
    externalReferralCode?: string;     // código de indicação
    externalReferralName?: string;     // nome do indicador
    externalWarrantyPrice?: number;    // valor exato da garantia calculado na origem
    externalWarrantyProductName?: string; // nome do item elegível para constar no pedido
    externalWarrantyProductId?: string;
    externalWarrantyImageUrl?: string;
    onCoinDiscountChange?: (discountBrl: number, coinsToSpend: number) => void;
}

function getSpecValue(specs: Record<string, any>, names: string[]): string {
    const wanted = new Set(names.map(name => name.toLowerCase()));
    const entry = Object.entries(specs || {}).find(([key]) => wanted.has(key.toLowerCase()));
    return entry?.[1] == null ? '' : String(entry[1]);
}

export function QuoteModal({ product, variants, isOpen, onClose, initialVariant, inline, totalOverride, selectedWarranty: externalWarranty, onWarrantyChange, selectedDelivery: externalDelivery, onDeliveryChange, externalCouponCode, externalCouponDiscount, externalReferralCode, externalReferralName, externalWarrantyPrice, externalWarrantyProductName, externalWarrantyProductId, externalWarrantyImageUrl, onCoinDiscountChange }: QuoteModalProps) {
    const [selectedVariant, setSelectedVariant] = useState<VariantSpecs>(initialVariant || {});
    const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<InstallmentPlan | null>(null);
    const [internalDelivery, setInternalDelivery] = useState<DeliveryOption>({ type: 'pickup' });
    // Usa entrega externa (CartPage) se fornecida, senão interna
    const delivery = externalDelivery !== undefined ? externalDelivery : internalDelivery;
    const setDelivery = onDeliveryChange ?? setInternalDelivery;
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
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
    const [coinError, setCoinError] = useState('');
    const [cashbackSettings, setCashbackSettings] = useState<any>(null);

    // Indicação
    const [referralInput, setReferralInput] = useState('');
    const [referralError, setReferralError] = useState('');
    const [referralName, setReferralName] = useState('');
    const [isVerifyingReferral, setIsVerifyingReferral] = useState(false);
    const [referralOpen, setReferralOpen] = useState(false);

    // Garantia Estendida e Configs de Loja
    const [warrantyOptions, setWarrantyOptions] = useState<WarrantyOption[]>([]);
    const [categoryWarrantyEnabled, setCategoryWarrantyEnabled] = useState(false);
    const [internalWarranty, setInternalWarranty] = useState<WarrantyOption | null>(null);
    // Usa garantia externa (CartPage) se fornecida, senão interna
    const selectedWarranty = externalWarranty !== undefined ? externalWarranty : internalWarranty;
    const setSelectedWarranty = onWarrantyChange ?? setInternalWarranty;
    const [storeAddress, setStoreAddress] = useState('');
    const [storeStatus, setStoreStatus] = useState<StoreStatus | null>(null);

    // Pagamento Online
    const [onlinePayMethod, setOnlinePayMethod] = useState<'pix' | 'card' | 'on_delivery'>('on_delivery');
    const [hasOnlineGateway, setHasOnlineGateway] = useState(false);

    // Criar pedido online (pague na entrega)
    const handleCreateDeliveryOrder = async () => {
        if (!customer) {
            navigate('/cliente/login?next=/carrinho');
            return;
        }

        // Validação estrita de pagamento misto/simulador
        if (mixedPaymentState && mixedPaymentState.cardCents > 0 && mixedPaymentState.selectedInstallment === null) {
            alert('Por favor, informe como deseja pagar o pedido: clique em "À VISTA (PIX)" ou escolha em quantas vezes no cartão.');
            return;
        }

        setIsSubmittingOrder(true);
        try {
            const productItems = cartItems.map(i => ({
                product_id: i.product.id,
                product_name: i.product.name,
                product_sku: i.product.sku || undefined,
                product_image_url: i.product.images?.[0] || undefined,
                product_color: i.product.specs?.color || i.product.specs?.Cor || undefined,
                quantity: i.quantity,
                unit_price: i.unit_price,
                subtotal: i.unit_price * i.quantity,
            }));

            // Inclui garantia estendida como item separado se selecionada
            const warrantyPrice = externalWarrantyPrice !== undefined
                ? externalWarrantyPrice
                : (selectedWarranty ? Math.round((totalOverride || effectivePrice) * (selectedWarranty.percentage / 100)) : 0);

            // Utilizamos estritamente o item elegível mapeado pelo CartPage ou o current product
            const wProductName = externalWarrantyProductName || product.name;
            const wProductId = externalWarrantyProductId || product.id || '';
            const wProductImageUrl = externalWarrantyImageUrl || product.images?.[0] || undefined;
            const warrantyItem = selectedWarranty && warrantyPrice > 0 ? [{
                product_id: wProductId,
                product_name: `Garantia Estendida +${selectedWarranty.months}m — ${wProductName}`,
                product_image_url: wProductImageUrl,
                quantity: 1,
                unit_price: warrantyPrice,
                subtotal: warrantyPrice,
            }] : [];

            // Endereço de entrega (se delivery)
            const shippingAddress = delivery.type === 'delivery' && delivery.address ? {
                cep: delivery.address.cep || '',
                street: delivery.address.street || '',
                number: (delivery.address as any).number || '',
                complement: (delivery.address as any).complement || '',
                neighborhood: delivery.address.neighborhood || '',
                city: delivery.address.city || '',
                state: delivery.address.state || '',
            } : undefined;

            const order = await createOrder({
                customer_name: customer.name || 'Cliente',
                customer_phone: customer.phone || '',
                customer_email: customer.email || undefined,
                customer_id: customer.id || undefined,
                items: [...productItems, ...warrantyItem],
                payment_method: 'on_delivery',
                delivery_type: delivery.type === 'delivery' ? 'delivery' : 'pickup',
                shipping_address: shippingAddress,
                shipping_cost: Math.round((delivery.shippingOption?.price ?? 0) * 100),
                coupon_code: externalCouponCode || undefined,
                coupon_discount: externalCouponDiscount || 0,
                coins_spent: useCoins ? coinsToSpend : 0,
                coins_discount: useCoins ? Math.round(coinDiscount * 100) : 0,
                notes: JSON.stringify({
                    referral_code: externalReferralCode || undefined,
                    referral_name: externalReferralName || undefined,
                    mixed_payment: mixedPaymentState ?? undefined,
                    delivery_notes: delivery.notes || undefined,
                }),
            } as any);
            clearCart();
            // Redirect to customer history instead of confirmation page
            navigate('/perfil', { state: { tab: 'history' } });
        } catch (e: any) {
            console.error('Erro ao criar pedido:', e);
            toast.error(e.message || 'Erro inesperado ao gerar pedido. Verifique os dados e tente novamente.');
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, []);

    // Carregar gateways de pagamento ativos
    useEffect(() => {
        paymentIntegrationService.getIntegrations()
            .then(integrations => {
                const active = integrations.filter(i => i.is_active);
                setHasOnlineGateway(active.length > 0);
            })
            .catch(() => setHasOnlineGateway(false));

        // Check if category supports extended warranty
        const categoryId = (product as any).category_id;
        if (categoryId) {
            categoryService.getById(categoryId)
                .then(cat => setCategoryWarrantyEnabled(cat?.extended_warranty_enabled ?? false))
                .catch(() => setCategoryWarrantyEnabled(false));
        }
    }, []);

    // Get customer context for pricing
    const { customer } = useSupabaseAuth();
    const { addItem } = useQuoteCart();
    const { addItem: addToCart, items: cartItems, clear: clearCart } = useCart();
    const navigate = useNavigate();
    const isAdmin = customer?.customer_type === 'ADMIN';

    // Effective price + coupon
    const effectivePrice = getEffectivePrice(product, customer) ?? 0;
    const effectivePriceReais = effectivePrice / 100;
    const coupon = useCoupon(effectivePriceReais, customer?.customer_type);

    // Carregar saldo de moedas do cliente e configs globais da empresa
    useEffect(() => {
        publicCompanySettingsService.get().then(settings => {
            if (settings?.extended_warranty_options) {
                setWarrantyOptions(settings.extended_warranty_options.filter(o => o.active));
            }
            if (settings?.address) {
                setStoreAddress(settings.address);
            }
            getStoreStatus(settings?.business_hours, settings?.holiday_overrides, settings?.local_holidays)
                .then(setStoreStatus)
                .catch(console.error);
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
            setCoinError('');
            if (coinDiscount !== 0) {
                setCoinDiscount(0);
                setCoinsToSpend(0);
                onCoinDiscountChange?.(0, 0);
            }
            return;
        }
        const baseReais = coupon.finalPrice > 0 ? coupon.finalPrice : effectivePriceReais - coupon.discount;
        validateCoinRedeem(customer.id, coinBalance, baseReais)
            .then(v => {
                let discount = 0;
                let coins = 0;

                if (v.valid) {
                    setCoinError('');
                    discount = v.discount_brl;
                    coins = v.coins_to_use;
                } else {
                    setCoinError(v.error || 'Não é possível resgatar moedas');
                }

                if (discount !== coinDiscount) {
                    setCoinDiscount(discount);
                    setCoinsToSpend(coins);
                    onCoinDiscountChange?.(discount, coins);
                }
            })
            .catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                const data = await vpsApiService.getProducts({
                    ...(product.model_id ? { model_id: product.model_id } : { search: product.model || product.name }),
                    status: 'active',
                    limit: 100,
                    compact: true,
                    noCache: true,
                });

                const matchingProducts = (data || []).filter((row: any) => {
                    const specs = row.specs || {};
                    const stock = row.stock_quantity ?? row.stock ?? row.available_stock;
                    const ram = getSpecValue(specs, ['ram']);
                    const storage = getSpecValue(specs, ['storage', 'armazenamento', 'memoria', 'memory']);

                    return Number(stock || 0) > 0
                        && ram === selectedVariant.ram
                        && storage === selectedVariant.storage;
                });

                console.log('🔍 Color Query Debug:', {
                    searchingFor: {
                        ram: selectedVariant.ram,
                        storage: selectedVariant.storage,
                        model_id: product.model_id,
                        model: product.model,
                        name: product.name
                    },
                    productsFound: matchingProducts.length,
                    products: matchingProducts.map((p: any) => ({
                        ram: p.specs?.ram,
                        storage: p.specs?.storage,
                        color: p.specs?.color
                    }))
                });

                const colors = matchingProducts
                    .map((p: any) => p.specs?.color || p.specs?.Cor)
                    .filter((color: unknown): color is string => Boolean(color));

                console.log('🎨 Colors loaded:', {
                    variant: `${selectedVariant.ram}/${selectedVariant.storage}`,
                    productsFound: matchingProducts.length,
                    colorsFound: colors,
                    uniqueColors: [...new Set(colors)]
                });

                setAvailableColors([...new Set(colors)]);
            } catch (error) {
                console.error('Error loading available colors:', error);
                setAvailableColors([]);
            }
        };

        loadAvailableColors();
    }, [product.model_id, product.model, product.name, selectedVariant.ram, selectedVariant.storage, customer]);

    // Calculate total price including warranty
    const warrantyPrice = externalWarrantyPrice !== undefined
        ? externalWarrantyPrice
        : (selectedWarranty ? Math.round((effectivePrice * selectedWarranty.percentage) / 100) : 0);
    const effectivePriceWithWarranty = effectivePrice + warrantyPrice;

    // Convert to final cents considering coupon and coins
    const finalTotalCents = effectivePriceWithWarranty - Math.round(coupon.discount * 100) - Math.round(coinDiscount * 100);
    const finalTotalReais = finalTotalCents / 100;

    // Load installment plans when price changes
    useEffect(() => {
        // No inline mode (CartPage), usa o totalOverride (total real do carrinho)
        const basePrice = (inline && totalOverride !== undefined && totalOverride > 0)
            ? totalOverride
            : finalTotalCents;
        if (!basePrice) return;

        const loadPlans = async () => {
            const plans = await calculateInstallments(basePrice, 12);
            setInstallmentPlans(plans);
            setSelectedPlan(plans.find(p => p.highlighted) || plans[0]);
        };

        loadPlans();
    }, [inline, totalOverride, finalTotalCents, customer]);

    // Generate WhatsApp message
    const handleSendWhatsApp = async () => {
        if (!selectedPlan) return;

        // Validação estrita de pagamento misto/simulador
        if (mixedPaymentState && mixedPaymentState.cardCents > 0 && mixedPaymentState.selectedInstallment === null) {
            alert('Por favor, informe como deseja pagar o pedido: clique em "À VISTA (PIX)" ou escolha em quantas vezes no cartão.');
            return;
        }

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
                referrerName: externalReferralName || referralName || undefined,
                referralCode: externalReferralCode || (referralName ? referralInput : undefined),
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

    // Buy online: add product to cart and go to checkout
    // In inline mode (cart page), product is already in cart — just navigate
    const handleBuyOnline = () => {
        if (!inline) addToCart(product);
        onClose();
        navigate('/checkout', { state: { paymentMethod: onlinePayMethod } });
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

    // ── Inline mode: render content directly (no popup/backdrop) ────────────────
    if (inline) {
        return (
            <div className="space-y-6">

                {/* Variant Selection — oculto no carrinho (cor já aparece nos itens) */}
                {!inline && (
                    <VariantSelector
                        variants={{
                            ...variants,
                            // Hide color selection for admin users (colors will be auto-included)
                            colors: customer?.customer_type === 'ADMIN' ? [] : variants.colors
                        }}
                        selected={selectedVariant}
                        onSelect={setSelectedVariant}
                    />
                )}

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

                {/* Garantia Estendida — só aparece aqui se NÃO vier do CartPage */}
                {!onWarrantyChange && warrantyOptions.length > 0 && categoryWarrantyEnabled && (
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
                                className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                            />
                        </label>
                        {coinError && useCoins && (
                            <p className="text-xs text-red-500 px-1 mt-1 font-medium">
                                ❌ {coinError}
                            </p>
                        )}
                        {useCoins && coinDiscount > 0 && (
                            <p className="text-xs text-amber-700 px-1 mt-1">
                                🪙 -{coinsToSpend} moedas = <strong>-R$ {coinDiscount.toFixed(2).replace('.', ',')}</strong> de desconto no total
                            </p>
                        )}
                    </div>
                )}

                {/* Simulador de Pagamento Combinado (Pix + Cartão) */}
                {installmentPlans.length > 0 && (
                    <MixedPaymentSimulator
                        totalPrice={totalOverride !== undefined ? totalOverride : (effectivePriceWithWarranty - Math.round(coinDiscount * 100) - Math.round(coupon.discount * 100))}
                        onChange={setMixedPaymentState}
                    />
                )}

                {/* Delivery Options — oculto no inline (renderizado no CartPage) */}
                {!onDeliveryChange && (
                    <DeliveryOptions
                        selected={delivery}
                        onSelect={setDelivery}
                        storeStatus={storeStatus}
                    />
                )}


                {/* Atalho: Pagamento Online — oculto no inline (CartPage já tem botão Mercado Pago) */}
                {!isAdmin && !inline && hasOnlineGateway && (
                    <div className="space-y-1.5">
                        <button
                            onClick={handleBuyOnline}
                            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                            <CreditCard className="w-5 h-5" />
                            Pague online via Mercado Pago
                        </button>
                        <div className="flex items-start gap-2 bg-orange-500 text-white rounded-xl px-3 py-2.5">
                            <span className="text-lg leading-none mt-0.5">⚠️</span>
                            <p className="text-xs font-medium leading-relaxed">
                                <span className="text-yellow-200 font-bold uppercase tracking-wide">Atenção: </span>
                                valores parcelados online têm juros maiores devido às taxas do Mercado Pago.
                            </p>
                        </div>
                    </div>
                )}

                {/* Campo de Indicação (Referral) — recolhível */}
                {!isAdmin && !inline && (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
                        <button
                            onClick={() => setReferralOpen(o => !o)}
                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <span>🤝</span>
                                {referralName
                                    ? <><span className="text-emerald-700 font-semibold">✅ Indicado por:</span><span className="text-emerald-600 ml-1 font-bold">{referralName}</span></>
                                    : 'Fui indicado por um amigo (Código)'
                                }
                            </span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${referralOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {referralOpen && (
                            <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-2">
                                {referralName ? (
                                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                                        <span className="text-sm text-emerald-800 font-medium">✅ Indicado por: <strong>{referralName}</strong></span>
                                        <button onClick={clearReferral} className="text-emerald-600 hover:text-emerald-800 text-xs underline">Remover</button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            value={referralInput}
                                            onChange={e => { setReferralInput(e.target.value.toUpperCase()); setReferralError(''); }}
                                            onKeyDown={e => e.key === 'Enter' && applyReferral()}
                                            placeholder="CÓDIGO DE INDICAÇÃO"
                                            autoFocus
                                            className={`flex-1 px-3 py-2 border-2 rounded-xl focus:outline-none font-mono uppercase text-sm ${referralError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-blue-500'
                                                }`}
                                        />
                                        <button
                                            onClick={applyReferral}
                                            disabled={isVerifyingReferral || !referralInput}
                                            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                            {isVerifyingReferral ? '...' : 'Aplicar'}
                                        </button>
                                    </div>
                                )}
                                {referralError && <p className="text-xs text-red-500">{referralError}</p>}
                                {!referralName && !referralError && !isVerifyingReferral && (
                                    <p className="text-xs text-slate-500">Mande o código de quem te indicou para que ele ganhe Moedas do Vale!</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Coupon Field — oculto no modo inline (fica no CartPage acima) */}
                {!isAdmin && !inline && (
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



                {/* Resumo de descontos — oculto no inline (CartPage já exibe o total) */}
                {!inline && (coupon.discount > 0 || coinDiscount > 0 || warrantyPrice > 0) && (
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


                {/* Ações principais */}
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                    {isAdmin ? (
                        <button
                            onClick={handleAddToCart}
                            disabled={!selectedPlan || (variants.rams.length > 0 && (!selectedVariant.ram || !selectedVariant.storage))}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Adicionar ao Orçamento
                        </button>
                    ) : (
                        <>
                            {isAdmin && !inline && (
                                <button
                                    onClick={handleCopyMessage}
                                    className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isCopied ? (
                                        <><Check className="w-5 h-5" />Copiado!</>
                                    ) : (
                                        <><Copy className="w-5 h-5" />Copiar Texto</>
                                    )}
                                </button>
                            )}
                            {/* Botão: Fazer Pedido (inline/cart mode) */}
                            {inline && (
                                <button
                                    onClick={handleCreateDeliveryOrder}
                                    disabled={isSubmittingOrder}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <ShoppingBag className="w-5 h-5" />
                                    {isSubmittingOrder ? 'Gerando pedido...' : customer ? 'Fazer Pedido' : 'Fazer Pedido (Login)'}
                                </button>
                            )}
                            {!inline && (
                                <button
                                    onClick={handleSendWhatsApp}
                                    disabled={isLoading || !selectedPlan || !!referralError || isVerifyingReferral}
                                    className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Send className="w-5 h-5" />
                                    {isLoading ? 'Gerando...' : 'Enviar WhatsApp'}
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Pagamento Online */}

            </div>
        );
    }

    // ── Modal mode (popup with backdrop) ───────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Close Button */}
                    <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors">
                        <X className="w-5 h-5 text-slate-600" />
                    </button>

                    {/* Reutiliza o mesmo conteúdo do inline */}
                    <div className="p-6">
                        <QuoteModal
                            product={product}
                            variants={variants}
                            isOpen={isOpen}
                            onClose={onClose}
                            initialVariant={initialVariant}
                            inline
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
