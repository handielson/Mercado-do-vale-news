import { useState, useEffect } from 'react';
import { X, Package, Ruler, Weight, Shield } from 'lucide-react';
import type { CatalogProduct } from '@/types/catalog';
import { formatPrice } from '@/services/installmentCalculator';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getEffectivePrice } from '@/hooks/useEffectiveCustomerType';
import { supabase } from '@/services/supabase';

interface ProductDetailsModalProps {
    product: CatalogProduct;
    isOpen: boolean;
    onClose: () => void;
    onQuote: () => void;
}

export function ProductDetailsModal({
    product,
    isOpen,
    onClose,
    onQuote
}: ProductDetailsModalProps) {
    // Get customer context for pricing
    const { customer } = useSupabaseAuth();
    const effectivePrice = getEffectivePrice(product, customer);

    // State for model template values
    const [templateValues, setTemplateValues] = useState<Record<string, any> | null>(null);
    const [loadingTemplate, setLoadingTemplate] = useState(false);

    // Fetch model template_values when modal opens
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        console.log('[ProductDetailsModal] Product:', {
            id: product.id,
            name: product.name,
            model_id: product.model_id
        });

        if (!product.model_id) {
            console.warn('[ProductDetailsModal] No model_id found for product');
            setTemplateValues(null);
            setLoadingTemplate(false);
            return;
        }

        let cancelled = false;

        const fetchModelTemplate = async () => {
            try {
                setLoadingTemplate(true);
                console.log('[ProductDetailsModal] Fetching template for model_id:', product.model_id);

                const { data, error } = await supabase
                    .from('models')
                    .select('template_values')
                    .eq('id', product.model_id)
                    .single();

                if (cancelled) return;

                if (error) {
                    console.error('[ProductDetailsModal] Error fetching model template:', error);
                    setTemplateValues(null);
                } else {
                    console.log('[ProductDetailsModal] Template values:', data?.template_values);
                    setTemplateValues(data?.template_values || null);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('[ProductDetailsModal] Exception fetching model template:', error);
                    setTemplateValues(null);
                }
            } finally {
                if (!cancelled) {
                    setLoadingTemplate(false);
                }
            }
        };

        fetchModelTemplate();

        return () => {
            cancelled = true;
        };
    }, [isOpen, product.model_id]);

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
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                            <h2 className="text-2xl font-bold text-slate-900">{product.name}</h2>
                            {product.brand && (
                                <p className="text-sm text-slate-600 mt-1">{product.brand}</p>
                            )}
                        </div>

                        {/* Image Gallery */}
                        {product.images && product.images.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {product.images.map((imageUrl, index) => (
                                    <img
                                        key={index}
                                        src={imageUrl}
                                        alt={`${product.name} - ${index + 1}`}
                                        className="w-full h-48 object-contain rounded-lg border border-slate-200 bg-slate-50"
                                    />
                                ))}
                            </div>
                        )}

                        {/* Description */}
                        {product.description && (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-2">Descrição</h3>
                                <div
                                    className="text-slate-700 prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: product.description }}
                                />
                            </div>
                        )}

                        {/* Specifications from Model Template */}
                        {loadingTemplate ? (
                            <div className="text-center py-8">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <p className="text-sm text-slate-600 mt-2">Carregando especificações...</p>
                            </div>
                        ) : templateValues && Object.keys(templateValues).length > 0 ? (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <Package className="w-5 h-5" />
                                    Especificações Técnicas
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {Object.entries(templateValues)
                                        .filter(([key]) => !['imei1', 'imei2', 'serial', 'id', 'created_at', 'updated_at'].includes(key.toLowerCase()))
                                        .map(([key, value]) => (
                                            <div key={key} className="flex justify-between p-3 bg-slate-50 rounded-lg">
                                                <span className="text-sm font-medium text-slate-600 capitalize">
                                                    {key.replace(/_/g, ' ')}:
                                                </span>
                                                <span className="text-sm text-slate-900 font-semibold">
                                                    {String(value)}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-slate-50 rounded-lg">
                                <Package className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                                <p className="text-sm text-slate-600">Especificações técnicas não disponíveis</p>
                            </div>
                        )}

                        {/* Pricing */}
                        <div className="border-t border-slate-200 pt-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-3">Preço</h3>
                            {effectivePrice && (
                                <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                                    <p className="text-sm text-slate-600 mb-2">Preço à Vista</p>
                                    <p className="text-3xl font-bold text-blue-700">
                                        {formatPrice(effectivePrice)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Action Button */}
                        <button
                            onClick={() => {
                                onClose();
                                onQuote();
                            }}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl"
                        >
                            Fazer Orçamento
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
