import { useState, useEffect } from 'react';
import { X, Send, Copy, Check } from 'lucide-react';
import type { CatalogProduct } from '@/types/catalog';
import type { VariantSpecs, ProductVariants } from '@/services/productVariants';
import type { InstallmentPlan } from '@/services/installmentCalculator';
import { VariantSelector } from './VariantSelector';
import { InstallmentSimulator } from './InstallmentSimulator';
import { DeliveryOptions, type DeliveryOption } from './DeliveryOptions';
import { calculateInstallments } from '@/services/installmentCalculator';
import { generateQuoteMessage, generateWhatsAppLink } from '@/utils/whatsappMessageGenerator';

interface QuoteModalProps {
    product: CatalogProduct;
    variants: ProductVariants;
    isOpen: boolean;
    onClose: () => void;
}

export function QuoteModal({ product, variants, isOpen, onClose }: QuoteModalProps) {
    const [selectedVariant, setSelectedVariant] = useState<VariantSpecs>({});
    const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<InstallmentPlan | null>(null);
    const [delivery, setDelivery] = useState<DeliveryOption>({ type: 'pickup' });
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // Load installment plans when price changes
    useEffect(() => {
        if (!product.price_retail) return;

        const loadPlans = async () => {
            const plans = await calculateInstallments(product.price_retail!, 12);
            setInstallmentPlans(plans);
            setSelectedPlan(plans.find(p => p.highlighted) || plans[0]);
        };

        loadPlans();
    }, [product.price_retail]);

    // Generate WhatsApp message
    const handleSendWhatsApp = async () => {
        if (!selectedPlan) return;

        setIsLoading(true);
        try {
            const message = generateQuoteMessage({
                product,
                variant: selectedVariant,
                installmentPlan: selectedPlan,
                delivery
            });

            const link = await generateWhatsAppLink(message);
            window.open(link, '_blank');
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
            delivery
        });

        navigator.clipboard.writeText(message);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
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
                            <h2 className="text-2xl font-bold text-slate-900">Fazer Orçamento</h2>
                            <p className="text-sm text-slate-600 mt-1">{product.name}</p>
                        </div>

                        {/* Variant Selection */}
                        <VariantSelector
                            variants={variants}
                            selected={selectedVariant}
                            onSelect={setSelectedVariant}
                        />

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

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 border-t border-slate-200">
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
