import { useState, useEffect, useRef } from 'react';
import { X, Send, Copy, Check, Plus } from 'lucide-react';
import type { CatalogProduct } from '@/types/catalog';
import type { VariantSpecs, ProductVariants } from '@/services/productVariants';
import type { InstallmentPlan } from '@/services/installmentCalculator';
import { VariantSelector } from './VariantSelector';
import { InstallmentSimulator } from './InstallmentSimulator';
import { DeliveryOptions, type DeliveryOption } from './DeliveryOptions';
import { calculateInstallments } from '@/services/installmentCalculator';
import { generateQuoteMessage, generateWhatsAppLink } from '@/utils/whatsappMessageGenerator';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getEffectivePrice } from '@/hooks/useEffectiveCustomerType';
import { useQuoteCart } from '@/contexts/QuoteCartContext';

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
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // More robust admin detection
    const isAdmin = customer?.customer_type === 'ADMIN';

    // Update selected variant when initialVariant changes (when modal opens with pre-selected variant)
    useEffect(() => {
        if (initialVariant && (initialVariant.ram || initialVariant.storage)) {
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

    // Load installment plans when price changes
    useEffect(() => {
        const effectivePrice = getEffectivePrice(product, customer);
        if (!effectivePrice) return;

        const loadPlans = async () => {
            const plans = await calculateInstallments(effectivePrice, 12);
            setInstallmentPlans(plans);
            setSelectedPlan(plans.find(p => p.highlighted) || plans[0]);
        };

        loadPlans();
    }, [product, customer]);

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
                availableColors: availableColors
            });

            const link = await generateWhatsAppLink(message);
            // Use window.location.href for better mobile compatibility
            window.location.href = link;
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
            availableColors: availableColors
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
        if (!selectedPlan || !selectedVariant.ram || !selectedVariant.storage) {
            alert('Por favor, selecione a memória');
            return;
        }

        const effectivePrice = getEffectivePrice(product, customer);
        if (!effectivePrice) return;

        // Debug: Log available colors
        console.log('Adding to cart:', {
            product: product.name,
            variant: `${selectedVariant.ram}/${selectedVariant.storage}`,
            availableColors,
            colorsCount: availableColors.length
        });

        // Warning if no colors found
        if (availableColors.length === 0) {
            console.warn('⚠️ No colors found for this variant. This might indicate no stock or missing color data.');
        }

        addItem({
            product,
            variant: {
                ram: selectedVariant.ram,
                storage: selectedVariant.storage
            },
            availableColors,
            price: effectivePrice,
            installmentPlan: selectedPlan,
            paymentOptions // Add payment options
        });

        // Close modal after adding
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

                        {/* Installment Simulator */}
                        {installmentPlans.length > 0 && selectedPlan && (
                            <InstallmentSimulator
                                plans={installmentPlans}
                                selected={selectedPlan}
                                onSelect={setSelectedPlan}
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

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 border-t border-slate-200">
                            {isAdmin ? (
                                // Admin: Add to cart button
                                <button
                                    onClick={handleAddToCart}
                                    disabled={!selectedPlan || !selectedVariant.ram || !selectedVariant.storage}
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
                                        disabled={isLoading || !selectedPlan}
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
