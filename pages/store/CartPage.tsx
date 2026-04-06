import { useCart } from '@/contexts/CartContext';
import { QuoteCartProvider } from '@/contexts/QuoteCartContext';
import { Link, useNavigate } from 'react-router-dom';
import {
    Trash2, Plus, Minus, ShoppingBag, ChevronDown, Tag, CreditCard,
    MapPin, Shield, ArrowRight, X, Sparkles, ChevronUp, ArrowLeft,
    ClipboardCopy, Check, MessageCircle
} from 'lucide-react';
import { formatCurrency, calculateCartVolume } from '@/utils/saleCalculations';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { extractVariants } from '@/services/productVariants';
import { QuoteModal } from '@/components/catalog/QuoteModal';
import { DeliveryOptions, type DeliveryOption } from '@/components/catalog/DeliveryOptions';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useCoupon } from '@/hooks/useCoupon';
import { getStoreStatus, type StoreStatus } from '@/utils/storeStatus';
import { companySettingsService } from '@/services/companySettingsService';
import type { WarrantyOption } from '@/types/companySettings';
import { useDeviceType } from '@/hooks/useDeviceType';
import { categoryService } from '@/services/categories';
import { supabase } from '@/services/supabase';
import { generateBudgetText } from '@/utils/cartShareUtils';
import { NewOrderModal } from '@/components/cart/NewOrderModal';
import { getCompanyData } from '@/services/companyService';

export default function CartPage() {
    return (
        <QuoteCartProvider>
            <CartPageContent />
        </QuoteCartProvider>
    );
}

function CartPageContent() {
    const { items, removeItem, updateQuantity, subtotal, totalItems, clear } = useCart();
    const cartVolume = useMemo(() => calculateCartVolume(items), [items]);
    const orderCost = useMemo(() => items.reduce((acc, item) => acc + (item.product.price_cost || 0) * item.quantity, 0), [items]);
    const { customer } = useSupabaseAuth();
    const device = useDeviceType();
    const navigate = useNavigate();
    const [couponOpen, setCouponOpen] = useState(false);
    const [warrantyOpen, setWarrantyOpen] = useState(false);
    const [paySheetOpen, setPaySheetOpen] = useState(false);
    const [presencialOpen, setPresencialOpen] = useState(() => sessionStorage.getItem('mv_cart_presencialOpen') === 'true');
    // Share / Order
    const [budgetCopied, setBudgetCopied] = useState(false);
    const [generatingBudget, setGeneratingBudget] = useState(false);
    const [showNewOrderModal, setShowNewOrderModal] = useState(false);
    const [companyPhone, setCompanyPhone] = useState('');
    const coupon = useCoupon(subtotal / 100, customer?.customer_type);
    const [storeStatus, setStoreStatus] = useState<StoreStatus | null>(null);
    const [warrantyOptions, setWarrantyOptions] = useState<WarrantyOption[]>([]);
    const [selectedWarranty, setSelectedWarranty] = useState<WarrantyOption | null>(() => {
        const saved = sessionStorage.getItem('mv_cart_warranty');
        return saved ? JSON.parse(saved) : null;
    });
    const [hasWarrantyEligibleItem, setHasWarrantyEligibleItem] = useState(false);
    const [referralOpen, setReferralOpen] = useState(false);
    const [referralInput, setReferralInput] = useState(() => sessionStorage.getItem('mv_cart_referralInput') || '');
    const [referralName, setReferralName] = useState(() => sessionStorage.getItem('mv_cart_referralName') || '');
    const [referralError, setReferralError] = useState('');
    const [isVerifyingReferral, setIsVerifyingReferral] = useState(false);
    const [delivery, setDelivery] = useState<DeliveryOption>(() => {
        const saved = sessionStorage.getItem('mv_cart_delivery');
        return saved ? JSON.parse(saved) : { type: 'pickup' };
    });


    const [deliveryOpen, setDeliveryOpen] = useState(false);

    // Soma e Nomes dos itens elegíveis a garantia
    const [eligibleTotal, setEligibleTotal] = useState(0);
    const [eligibleItemNames, setEligibleItemNames] = useState<string>('');
    const [eligibleProductId, setEligibleProductId] = useState<string>('');
    const [eligibleImageUrl, setEligibleImageUrl] = useState<string>('');
    const [eligibleBaseWarrantyDays, setEligibleBaseWarrantyDays] = useState<number>(90);

    // Moedas do Vale (desconto aplicado)
    const [cartCoinDiscount, setCartCoinDiscount] = useState(0);

    const handleCoinDiscountChange = useCallback((discountBrl: number) => {
        setCartCoinDiscount(Math.round(discountBrl * 100));
    }, []);

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
                setReferralError(result.error || 'Código não encontrado');
            }
        } catch {
            setReferralError('Erro ao validar código');
        } finally {
            setIsVerifyingReferral(false);
        }
    };

    useEffect(() => {
        getStoreStatus().then(setStoreStatus).catch(() => { });
        companySettingsService.get().then(s => {
            if (s?.extended_warranty_options) {
                setWarrantyOptions(s.extended_warranty_options.filter(o => o.active));
            }
        }).catch(() => { });
        getCompanyData().then(c => setCompanyPhone(c.phone || '')).catch(() => { });
    }, []);

    useEffect(() => {
        const categoryIds = [...new Set(
            items.map(i => (i.product as any).category_id).filter(Boolean)
        )];
        if (categoryIds.length === 0) {
            setHasWarrantyEligibleItem(false);
            setSelectedWarranty(null);
            return;
        }
        Promise.all(categoryIds.map(id => categoryService.getById(id)))
            .then(categories => {
                const eligibleCategoryIds = categories.filter(cat => cat?.extended_warranty_enabled).map(cat => cat?.id);
                const eligible = eligibleCategoryIds.length > 0;
                setHasWarrantyEligibleItem(eligible);
                if (!eligible) {
                    setSelectedWarranty(null);
                    setEligibleTotal(0);
                    setEligibleItemNames('');
                    setEligibleProductId('');
                    setEligibleImageUrl('');
                } else {
                    let sum = 0;

                    // Separa os itens elegíveis para descobrir o mais caro (o principal)
                    const eligibleItems = items.filter(item => {
                        const catId = (item.product as any).category_id;
                        return eligibleCategoryIds.includes(catId);
                    });

                    console.log('🛡️ [Garantia DEBUG] eligibleCategoryIds (from API):', eligibleCategoryIds);
                    console.log('🛡️ [Garantia DEBUG] eligibleItems (filtered):', eligibleItems.map(i => ({ name: i.product.name, catId: (i.product as any).category_id, price: i.unit_price })));

                    eligibleItems.forEach(item => {
                        sum += item.unit_price * item.quantity;
                    });

                    // O plano principal para a garantia é atrelar ela sempre ao item ELEGÍVEL mais caro (ex: Celular, e não Capa)
                    eligibleItems.sort((a, b) => b.unit_price - a.unit_price);
                    const mainEligible = eligibleItems[0];

                    console.log('🛡️ [Garantia DEBUG] mainEligible (most expensive):', mainEligible?.product.name);

                    setEligibleTotal(sum);
                    setEligibleItemNames(mainEligible?.product.name || '');
                    setEligibleProductId(mainEligible?.product.id || '');
                    setEligibleImageUrl(mainEligible?.product.images?.[0] || '');

                    // Fetch exact warranty days for this product
                    const p = mainEligible?.product as any;
                    if (p) {
                        const wType = p.warranty_type;
                        if (wType === 'brand' && p.brand) {
                            supabase.from('brands').select('warranty_days').eq('name', p.brand).maybeSingle().then(r => setEligibleBaseWarrantyDays(r.data?.warranty_days || 90));
                        } else if (wType === 'category') {
                            const cat = categories.find(c => c?.id === p.category_id);
                            setEligibleBaseWarrantyDays(cat?.warranty_days || 90);
                        } else if (wType === 'custom' && p.warranty_template_id) {
                            supabase.from('warranty_templates').select('duration_days').eq('id', p.warranty_template_id).maybeSingle().then(r => setEligibleBaseWarrantyDays(r.data?.duration_days || 90));
                        } else {
                            setEligibleBaseWarrantyDays(90);
                        }
                    }
                }
            })
            .catch(() => setHasWarrantyEligibleItem(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items.map(i => i.id).join(',')]);


    const firstItem = items[0];
    const variants = useMemo(() => {
        if (!firstItem) return null;
        return extractVariants([firstItem.product]);
    }, [firstItem?.product?.id]);

    const firstItemVariant = useMemo(() => {
        if (!firstItem) return {};
        const specs: Record<string, any> = firstItem.product.specs ?? {};
        const color = specs.color || specs.Cor;
        const ramKey = Object.keys(specs).find(k => k.toLowerCase().includes('ram'));
        const storKey = Object.keys(specs).find(k => {
            const l = k.toLowerCase();
            return l.includes('armaz') || l.includes('storage') || (l.includes('mem') && l.includes('int'));
        });
        return {
            ram: ramKey ? specs[ramKey] : undefined,
            storage: storKey ? specs[storKey] : undefined,
            color: color || undefined,
        };
    }, [firstItem?.product?.id]);

    const warrantyPrice = selectedWarranty ? Math.round(eligibleTotal * selectedWarranty.percentage / 100) : 0;
    const couponDiscount = Math.round(coupon.discount * 100);
    const shippingCost = delivery.type === 'delivery' ? Math.round((delivery.shippingOption?.price ?? 0) * 100) : 0;
    const grandTotal = subtotal + warrantyPrice + shippingCost - couponDiscount - cartCoinDiscount;
    const hasModifiers = warrantyPrice > 0 || couponDiscount > 0 || cartCoinDiscount > 0 || shippingCost > 0;

    useEffect(() => {
        sessionStorage.setItem('mv_cart_presencialOpen', String(presencialOpen));
        sessionStorage.setItem('mv_cart_referralInput', referralInput);
        sessionStorage.setItem('mv_cart_referralName', referralName);
        sessionStorage.setItem('mv_cart_delivery', JSON.stringify(delivery));
        if (selectedWarranty) {
            sessionStorage.setItem('mv_cart_warranty', JSON.stringify(selectedWarranty));
            sessionStorage.setItem('mv_cart_warrantyPrice', String(warrantyPrice || 0));
            sessionStorage.setItem('mv_cart_warrantyProductId', eligibleProductId || '');
            sessionStorage.setItem('mv_cart_warrantyProductName', `${eligibleItemNames} (Ref: ${eligibleBaseWarrantyDays}d)`);
            sessionStorage.setItem('mv_cart_warrantyImageUrl', eligibleImageUrl || '');
        } else {
            sessionStorage.removeItem('mv_cart_warranty');
            sessionStorage.removeItem('mv_cart_warrantyPrice');
            sessionStorage.removeItem('mv_cart_warrantyProductId');
            sessionStorage.removeItem('mv_cart_warrantyProductName');
            sessionStorage.removeItem('mv_cart_warrantyImageUrl');
        }
    }, [paySheetOpen, presencialOpen, referralInput, referralName, delivery, selectedWarranty, warrantyPrice, eligibleProductId, eligibleItemNames, eligibleImageUrl]);

    // ─── Carrinho vazio ───────────────────────────────────────────────────────
    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-6">
                <div className="w-24 h-24 bg-white rounded-3xl shadow-lg flex items-center justify-center mb-6">
                    <ShoppingBag className="w-12 h-12 text-blue-300" />
                </div>
                <h1 className="text-xl font-bold text-gray-800 mb-2 text-center">Carrinho vazio</h1>
                <p className="text-gray-500 mb-8 text-center text-sm">Adicione produtos para continuar.</p>
                <Link
                    to="/"
                    className="w-full max-w-xs bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-bold text-center shadow-lg active:scale-95 transition-transform"
                >
                    Ver produtos
                </Link>
            </div>
        );
    }

    // ─── Bloco de itens (compartilhado) ──────────────────────────────────────
    const itemsList = (
        <div className="space-y-2.5">
            {items.map(item => (
                <div key={item.id} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                        {item.product.images?.[0] ? (
                            <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <ShoppingBag className="w-6 h-6 text-gray-300" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{item.product.name}</p>
                        <p className="text-blue-600 font-bold text-sm mt-1">{formatCurrency(item.unit_price)}</p>
                        {(() => {
                            const specs: Record<string, any> = item.product.specs ?? {};
                            const color = specs.color || specs.Cor;
                            const ramKey = Object.keys(specs).find(k => k.toLowerCase().includes('ram'));
                            const storKey = Object.keys(specs).find(k => {
                                const l = k.toLowerCase();
                                return l.includes('armaz') || l.includes('storage') || (l.includes('mem') && l.includes('int'));
                            });
                            const ram = ramKey ? specs[ramKey] : null;
                            const storage = storKey ? specs[storKey] : null;
                            const sku = item.product.sku;
                            return (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {color && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                            🎨 {color}
                                        </span>
                                    )}
                                    {ram && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                            🧠 {ram}
                                        </span>
                                    )}
                                    {storage && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                            💾 {storage}
                                        </span>
                                    )}
                                    {sku && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full font-mono">
                                            {sku}
                                        </span>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <p className="font-bold text-gray-900 text-sm">{formatCurrency(item.unit_price * item.quantity)}</p>
                        <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm active:scale-90 transition-transform">
                                <Minus className="w-3.5 h-3.5 text-gray-600" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm active:scale-90 transition-transform">
                                <Plus className="w-3.5 h-3.5 text-gray-600" />
                            </button>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="p-1.5 text-red-300 hover:text-red-500 active:scale-90 transition-all rounded-lg">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );

    const continueShoppingBtn = (
        <Link
            to="/"
            className="flex items-center justify-center gap-2 w-full py-3.5 mt-2 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all group"
        >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Continuar comprando
        </Link>
    );

    // ─── Garantia + Cupom (compartilhado) ────────────────────────────────────
    const optionsPanel = (
        <div className="space-y-3">
            {warrantyOptions.length > 0 && hasWarrantyEligibleItem && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                        onClick={() => setWarrantyOpen(o => !o)}
                        className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50 transition-colors"
                    >
                        <span className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Shield className="w-4 h-4 text-blue-600" />
                            </div>
                            {selectedWarranty
                                ? <span className="text-sm font-semibold text-blue-700">✅ Garantia +{selectedWarranty.months}m</span>
                                : <span className="text-sm font-medium text-gray-700">Garantia Estendida</span>
                            }
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${warrantyOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {warrantyOpen && (
                        <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/50">
                            <select
                                value={selectedWarranty?.months || ''}
                                onChange={e => {
                                    const opt = warrantyOptions.find(o => o.months === Number(e.target.value));
                                    setSelectedWarranty(opt || null);
                                }}
                                style={{ fontSize: '16px' }}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                                <option value="">Sem garantia estendida</option>
                                {warrantyOptions.sort((a, b) => a.months - b.months).map(opt => {
                                    const cost = Math.round((eligibleTotal * opt.percentage) / 100);
                                    return <option key={opt.months} value={opt.months}>+{opt.months} Meses (+ {formatCurrency(cost)})</option>;
                                })}
                            </select>
                        </div>
                    )}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                    onClick={() => setCouponOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50 transition-colors"
                >
                    <span className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                            <Tag className="w-4 h-4 text-orange-500" />
                        </div>
                        {coupon.appliedCoupon
                            ? <span className="text-sm font-semibold text-green-700">✅ {coupon.appliedCoupon.code} aplicado</span>
                            : <span className="text-sm font-medium text-gray-700">Tenho um cupom de desconto</span>
                        }
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${couponOpen ? 'rotate-180' : ''}`} />
                </button>
                {couponOpen && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/50">
                        {coupon.appliedCoupon ? (
                            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                                <span className="text-sm text-green-800 font-medium">✅ <strong>{coupon.appliedCoupon.code}</strong></span>
                                <button onClick={coupon.clear} className="text-sm text-green-600 font-semibold underline">Remover</button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <input
                                    value={coupon.code}
                                    onChange={e => coupon.setCode(e.target.value.toUpperCase())}
                                    onKeyDown={e => e.key === 'Enter' && coupon.apply()}
                                    placeholder="CÓDIGO DO CUPOM"
                                    autoFocus
                                    style={{ fontSize: '16px' }}
                                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none font-mono uppercase bg-white"
                                />
                                <button
                                    onClick={coupon.apply}
                                    disabled={coupon.isLoading || !coupon.code}
                                    className="px-5 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                                >
                                    {coupon.isLoading ? '...' : 'OK'}
                                </button>
                            </div>
                        )}
                        {coupon.error && <p className="text-xs text-red-500 mt-2">{coupon.error}</p>}
                    </div>
                )}
            </div>

            {/* ── Indicação ── */}
            {(!customer || customer.customer_type !== 'ADMIN') && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                        onClick={() => setReferralOpen(o => !o)}
                        className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50 transition-colors"
                    >
                        <span className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                                <span className="text-base leading-none">🤝</span>
                            </div>
                            {referralName
                                ? <span className="text-sm font-semibold text-emerald-700">✅ Indicado por: <strong>{referralName}</strong></span>
                                : <span className="text-sm font-medium text-gray-700">Fui indicado por um amigo (Código)</span>
                            }
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${referralOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {referralOpen && (
                        <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/50 space-y-2">
                            {/* Gate de login: indicação e moedas requerem conta */}
                            {!customer ? (
                                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                                    <span className="text-lg leading-none mt-0.5">🔒</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-amber-800">Login necessário</p>
                                        <p className="text-xs text-amber-700 mt-0.5">Para garantir sua indicação e ganhar Moedas do Vale, você precisa estar logado.</p>
                                        <a href="/cliente/login?next=/carrinho" className="inline-block mt-2 text-xs font-bold text-amber-800 underline">Fazer login →</a>
                                    </div>
                                </div>
                            ) : referralName ? (
                                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                                    <span className="text-sm text-emerald-800 font-medium">✅ Indicado por: <strong>{referralName}</strong></span>
                                    <button onClick={() => { setReferralInput(''); setReferralName(''); setReferralError(''); }} className="text-sm text-emerald-600 font-semibold underline">Remover</button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        value={referralInput}
                                        onChange={e => { setReferralInput(e.target.value.toUpperCase()); setReferralError(''); }}
                                        onKeyDown={e => e.key === 'Enter' && applyReferral()}
                                        placeholder="CÓDIGO DE INDICAÇÃO"
                                        style={{ fontSize: '16px' }}
                                        className={`flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none font-mono uppercase bg-white ${referralError ? 'border-red-400' : 'border-gray-200 focus:border-emerald-500'}`}
                                    />
                                    <button
                                        onClick={applyReferral}
                                        disabled={isVerifyingReferral || !referralInput}
                                        className="px-5 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                                    >
                                        {isVerifyingReferral ? '...' : 'OK'}
                                    </button>
                                </div>
                            )}
                            {referralError && <p className="text-xs text-red-500">{referralError}</p>}
                            {customer && !referralName && !referralError && !isVerifyingReferral && (
                                <p className="text-xs text-gray-400">Mande o código de quem te indicou para que ele ganhe Moedas do Vale!</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Opção de Entrega ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                    onClick={() => setDeliveryOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50 transition-colors"
                >
                    <span className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-blue-500" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                            Opções de Entrega
                        </span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${deliveryOpen ? 'rotate-180' : ''}`} />
                </button>
                {deliveryOpen && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/50">
                        <DeliveryOptions
                            selected={delivery}
                            onSelect={setDelivery}
                            storeStatus={storeStatus}
                            subtotal={subtotal}
                            cartVolume={cartVolume}
                            orderCost={orderCost}
                        />
                    </div>
                )}
            </div>
        </div>
    );

    // ─── Painel de resumo + pagamento (compartilhado) ─────────────────────────
    const summaryPanel = (
        <div className="space-y-3">
            {/* Resumo */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg px-5 py-4 text-white">
                {hasModifiers && (
                    <div className="space-y-1.5 mb-3 pb-3 border-b border-white/20">
                        <div className="flex justify-between text-sm text-blue-100">
                            <span>Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'itens'})</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {shippingCost > 0 && (
                            <div className="flex justify-between text-sm text-blue-100">
                                <span>Frete ({delivery.shippingOption?.name})</span>
                                <span className="text-white">+ {formatCurrency(shippingCost)}</span>
                            </div>
                        )}
                        {warrantyPrice > 0 && (
                            <div className="flex justify-between text-sm text-blue-100">
                                <span>Garantia (+{selectedWarranty?.months}m)</span>
                                <span className="text-white">+ {formatCurrency(warrantyPrice)}</span>
                            </div>
                        )}
                        {couponDiscount > 0 && (
                            <div className="flex justify-between text-sm text-blue-100">
                                <span>Cupom ({coupon.appliedCoupon?.code})</span>
                                <span className="text-green-300">- {formatCurrency(couponDiscount)}</span>
                            </div>
                        )}
                        {cartCoinDiscount > 0 && (
                            <div className="flex justify-between text-sm text-blue-100">
                                <span>Moedas do Vale</span>
                                <span className="text-amber-300">- {formatCurrency(cartCoinDiscount)}</span>
                            </div>
                        )}
                    </div>
                )}
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">Total do pedido</p>
                        <p className="text-3xl font-extrabold mt-0.5">{formatCurrency(grandTotal)}</p>
                    </div>
                    <Sparkles className="w-8 h-8 text-white/20" />
                </div>
            </div>

            {/* Opções de pagamento */}
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">Como deseja pagar?</p>

            <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <button
                    onClick={() => setPresencialOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-sm">
                            <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-sm text-gray-900">Pague na entrega</p>
                            <p className="text-xs text-gray-400 mt-0.5">Petrolina-PE e Juazeiro-BA</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Popular</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${presencialOpen ? 'rotate-180' : ''}`} />
                    </div>
                </button>
                {presencialOpen && firstItem && variants && (
                    <div className="border-t border-gray-100 px-4 pb-5 pt-4 bg-gray-50/40">
                        <QuoteModal
                            product={firstItem.product}
                            variants={variants}
                            isOpen={true}
                            onClose={() => { }}
                            inline
                            initialVariant={firstItemVariant}
                            totalOverride={grandTotal}
                            selectedWarranty={selectedWarranty}
                            onWarrantyChange={setSelectedWarranty}
                            selectedDelivery={delivery}
                            onDeliveryChange={setDelivery}
                            externalCouponCode={coupon.appliedCoupon?.code}
                            externalCouponDiscount={couponDiscount}
                            externalReferralCode={referralInput}
                            externalReferralName={referralName}
                            externalWarrantyPrice={warrantyPrice}
                            externalWarrantyProductName={`${eligibleItemNames} (Ref: ${eligibleBaseWarrantyDays}d)`}
                            externalWarrantyProductId={eligibleProductId}
                            externalWarrantyImageUrl={eligibleImageUrl}
                            onCoinDiscountChange={handleCoinDiscountChange}
                        />
                    </div>
                )}
            </div>

            <button
                onClick={() => {
                    if (!customer) {
                        navigate('/cliente/login?next=/checkout');
                    } else {
                        navigate('/checkout');
                    }
                }}
                className="w-full flex items-center justify-between px-4 py-4 border border-gray-200 rounded-2xl bg-white shadow-sm active:bg-gray-50 hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                        <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="font-bold text-sm text-gray-900">Mercado Pago</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {customer ? 'Pague online com segurança' : 'Faça login para continuar'}
                        </p>
                    </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>

            <div className="flex gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3">
                <span className="text-xl leading-none mt-0.5 flex-shrink-0">⚠️</span>
                <div>
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Atenção</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                        Taxas de parcelamento online são <strong>maiores</strong> que no pagamento presencial na loja.
                    </p>
                </div>
            </div>

            {/* ── Botão ADMIN: Copiar Orçamento ── */}
            {customer?.customer_type === 'ADMIN' && (
                <button
                    onClick={async () => {
                        setGeneratingBudget(true);
                        try {
                            const text = await generateBudgetText(items.map(i => ({ product: i.product, unit_price: i.unit_price, quantity: i.quantity })));
                            await navigator.clipboard.writeText(text);
                            setBudgetCopied(true);
                            setTimeout(() => setBudgetCopied(false), 2500);
                        } catch (e) {
                            console.error(e);
                        } finally {
                            setGeneratingBudget(false);
                        }
                    }}
                    disabled={generatingBudget}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-blue-300 text-blue-700 font-medium text-sm bg-blue-50/60 hover:bg-blue-100 active:scale-95 transition-all disabled:opacity-60"
                >
                    {budgetCopied ? <Check className="w-4 h-4 text-green-600" /> : <ClipboardCopy className="w-4 h-4" />}
                    {generatingBudget ? 'Gerando...' : budgetCopied ? 'Copiado!' : '📋 Copiar Orçamento'}
                </button>
            )}

            {/* ── Botão Novo Pedido (cliente) ── */}
            {customer?.customer_type !== 'ADMIN' && (
                <button
                    onClick={() => setShowNewOrderModal(true)}
                    className="w-full flex items-center justify-between px-4 py-4 border border-green-200 rounded-2xl text-left hover:border-green-400 hover:bg-green-50/30 active:bg-green-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                            <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-sm text-gray-900">Novo Pedido</p>
                            <p className="text-xs text-gray-400">Enviar pedido via WhatsApp</p>
                        </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                </button>
            )}
        </div>
    );

    // ─── Store status banner ──────────────────────────────────────────────────
    const statusBanner = storeStatus && storeStatus.status !== 'open' && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-2xl text-sm ${storeStatus.status === 'closing_soon'
            ? 'bg-amber-50 text-amber-800 border border-amber-200'
            : 'bg-gray-100 text-gray-700'
            }`}>
            <span className="text-lg">{storeStatus.status === 'closing_soon' ? '⚠️' : '🕒'}</span>
            <div>
                <p className="font-semibold text-sm">{storeStatus.message}</p>
                <p className="text-xs opacity-75 mt-0.5">{storeStatus.actionMessage}</p>
            </div>
        </div>
    );

    // ─── HEADER ───────────────────────────────────────────────────────────────
    const header = (
        <div className="bg-white border-b sticky top-0 z-20">
            <div className="flex items-center justify-between px-4 py-3.5 max-w-7xl mx-auto">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-gray-900 leading-none">Meu Carrinho</h1>
                        <p className="text-[11px] text-gray-400 mt-0.5">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</p>
                    </div>
                </div>
                <button onClick={clear} className="text-xs text-red-400 font-medium px-3 py-2 rounded-xl active:bg-red-50 hover:bg-red-50 transition-colors">
                    Limpar tudo
                </button>
            </div>
        </div>
    );

    // ═══════════════════════════════════════════════════════════
    // 📱 MOBILE — barra fixa + bottom sheet
    // ═══════════════════════════════════════════════════════════
    if (device === 'mobile') {
        return (
            <div className="min-h-screen bg-gray-50">
                {header}
                <div className="px-4 pt-4 pb-44 space-y-3">
                    {statusBanner}
                    {itemsList}

                    {/* ── Botão ADMIN: Copiar Orçamento ── */}
                    {customer?.customer_type === 'ADMIN' && (
                        <button
                            onClick={async () => {
                                setGeneratingBudget(true);
                                try {
                                    const text = await generateBudgetText(items.map(i => ({ product: i.product, unit_price: i.unit_price, quantity: i.quantity })));
                                    await navigator.clipboard.writeText(text);
                                    setBudgetCopied(true);
                                    setTimeout(() => setBudgetCopied(false), 2500);
                                } catch (e) {
                                    console.error(e);
                                } finally {
                                    setGeneratingBudget(false);
                                }
                            }}
                            disabled={generatingBudget}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-blue-300 text-blue-700 font-medium text-sm bg-blue-50/60 hover:bg-blue-100 active:scale-95 transition-all disabled:opacity-60"
                        >
                            {budgetCopied ? <Check className="w-4 h-4 text-green-600" /> : <ClipboardCopy className="w-4 h-4" />}
                            {generatingBudget ? 'Gerando...' : budgetCopied ? 'Copiado!' : '📋 Copiar Orçamento'}
                        </button>
                    )}

                    {continueShoppingBtn}
                    {optionsPanel}
                    {hasModifiers && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 space-y-1.5">
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
                            </div>
                            {warrantyPrice > 0 && <div className="flex justify-between text-sm text-blue-600"><span>Garantia</span><span>+ {formatCurrency(warrantyPrice)}</span></div>}
                            {couponDiscount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Cupom</span><span>- {formatCurrency(couponDiscount)}</span></div>}
                        </div>
                    )}
                </div>

                {/* Bottom Sheet de pagamento */}
                {paySheetOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30" onClick={() => setPaySheetOpen(false)} />
                        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]">
                            {/* Handle bar */}
                            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
                            {/* Header fixo */}
                            <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b flex-shrink-0">
                                <h2 className="font-bold text-gray-900 text-base">Como deseja pagar?</h2>
                                <button onClick={() => setPaySheetOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                    <X className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                            {/* Conteúdo rolável */}
                            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3 pb-10">
                                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                                    <button onClick={() => setPresencialOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
                                                <MapPin className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="text-left">
                                                <p className="font-bold text-sm text-gray-900">Pague na entrega</p>
                                                <p className="text-xs text-gray-400">Petrolina-PE e Juazeiro-BA</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Popular</span>
                                            <ChevronUp className={`w-4 h-4 text-gray-400 transition-transform ${presencialOpen ? '' : 'rotate-180'}`} />
                                        </div>
                                    </button>
                                    {presencialOpen && firstItem && variants && (
                                        <div className="border-t border-gray-100 px-4 pb-5 pt-4 bg-gray-50/50">
                                            <QuoteModal
                                                product={firstItem.product}
                                                variants={variants}
                                                isOpen={true}
                                                onClose={() => { }}
                                                inline
                                                initialVariant={firstItemVariant}
                                                totalOverride={grandTotal}
                                                selectedWarranty={selectedWarranty}
                                                onWarrantyChange={setSelectedWarranty}
                                                selectedDelivery={delivery}
                                                onDeliveryChange={setDelivery}
                                                externalCouponCode={coupon.appliedCoupon?.code}
                                                externalCouponDiscount={couponDiscount}
                                                externalReferralCode={referralInput}
                                                externalReferralName={referralName}
                                                externalWarrantyPrice={warrantyPrice}
                                                externalWarrantyProductName={eligibleItemNames}
                                                externalWarrantyProductId={eligibleProductId}
                                                externalWarrantyImageUrl={eligibleImageUrl}
                                                onCoinDiscountChange={handleCoinDiscountChange}
                                            />
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => navigate('/checkout', {
                                        state: {
                                            selectedWarranty,
                                            warrantyPrice,
                                            warrantyProductName: eligibleItemNames,
                                            warrantyProductId: eligibleProductId,
                                            warrantyImageUrl: eligibleImageUrl,
                                            referralCode: referralInput,
                                            referralName: referralName,
                                            delivery,
                                        }
                                    })}
                                    className="w-full flex items-center justify-between px-4 py-4 border border-gray-200 rounded-2xl active:bg-gray-50 text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                            <CreditCard className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-900">Mercado Pago</p>
                                            <p className="text-xs text-gray-400">Pague online com segurança</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-gray-400" />
                                </button>

                                {/* Botão Novo Pedido via WhatsApp (cliente) */}
                                {customer?.customer_type !== 'ADMIN' && (
                                    <button
                                        onClick={() => setShowNewOrderModal(true)}
                                        className="w-full flex items-center justify-between px-4 py-4 border border-green-200 rounded-2xl active:bg-green-50 text-left hover:border-green-400 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                                <MessageCircle className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">Novo Pedido</p>
                                                <p className="text-xs text-gray-400">Enviar pedido via WhatsApp</p>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Barra fixa */}
                <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-2xl px-4 py-3">
                    {hasModifiers && (
                        <p className="text-xs text-gray-400 text-center mb-1.5">
                            {formatCurrency(subtotal)}{warrantyPrice > 0 ? ` + garantia` : ''}{couponDiscount > 0 ? ` - cupom` : ''}{cartCoinDiscount > 0 ? ` - moedas` : ''}
                        </p>
                    )}
                    <button
                        onClick={() => setPaySheetOpen(true)}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl py-4 flex items-center justify-between px-5 active:scale-[0.98] transition-transform shadow-lg"
                    >
                        <div className="text-left">
                            <p className="text-xs text-blue-200 font-medium">Total do pedido</p>
                            <p className="text-xl font-extrabold">{formatCurrency(grandTotal)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">Pagar</span>
                            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                                <Sparkles className="w-4 h-4" />
                            </div>
                        </div>
                    </button>
                </div>

                {/* Modal Novo Pedido */}
                {showNewOrderModal && (
                    <NewOrderModal
                        items={items}
                        delivery={delivery}
                        paymentLabel={
                            delivery.type === 'delivery'
                                ? (delivery.shippingOption?.name ?? 'Entrega')
                                : 'Retirada na loja'
                        }
                        grandTotal={grandTotal}
                        whatsappNumber={companyPhone}
                        onClose={() => setShowNewOrderModal(false)}
                    />
                )}
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // 📟 TABLET — coluna única com resumo em card inline
    // ═══════════════════════════════════════════════════════════
    if (device === 'tablet') {
        return (
            <div className="min-h-screen bg-gray-50">
                {header}
                <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
                    {statusBanner}
                    {itemsList}
                    {continueShoppingBtn}
                    {optionsPanel}
                    {summaryPanel}
                </div>
                {showNewOrderModal && (
                    <NewOrderModal
                        items={items}
                        delivery={delivery}
                        paymentLabel={delivery.type === 'delivery' ? (delivery.shippingOption?.name ?? 'Entrega') : 'Retirada na loja'}
                        grandTotal={grandTotal}
                        whatsappNumber={companyPhone}
                        onClose={() => setShowNewOrderModal(false)}
                    />
                )}
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // 🖥️ DESKTOP — duas colunas
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen bg-gray-50">
            {header}
            <div className="max-w-6xl mx-auto px-8 py-8">
                <div className="grid grid-cols-[1fr_380px] gap-8 items-start">

                    {/* Coluna esquerda — itens + opções */}
                    <div className="space-y-4">
                        {statusBanner}
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">Seus itens</h2>
                        {itemsList}
                        {continueShoppingBtn}
                        {optionsPanel}
                    </div>

                    {/* Coluna direita — resumo + pagamento sticky */}
                    <div className="sticky top-24 space-y-3">
                        {summaryPanel}
                    </div>
                </div>
            </div>
            {showNewOrderModal && (
                <NewOrderModal
                    items={items}
                    delivery={delivery}
                    paymentLabel={delivery.type === 'delivery' ? (delivery.shippingOption?.name ?? 'Entrega') : 'Retirada na loja'}
                    grandTotal={grandTotal}
                    whatsappNumber={companyPhone}
                    onClose={() => setShowNewOrderModal(false)}
                />
            )}
        </div>
    );
}
