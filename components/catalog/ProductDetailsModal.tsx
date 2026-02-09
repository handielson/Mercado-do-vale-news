import { X, Package, Ruler, Weight, Shield } from 'lucide-react';
import type { CatalogProduct } from '@/types/catalog';
import { formatPrice } from '@/services/installmentCalculator';

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

                        {/* Specifications */}
                        {product.specs && Object.keys(product.specs).length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <Package className="w-5 h-5" />
                                    Especificações Técnicas
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {Object.entries(product.specs).map(([key, value]) => (
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
                        )}

                        {/* Dimensions & Weight */}
                        {(product.weight || product.dimensions) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {product.dimensions && (
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Ruler className="w-5 h-5 text-blue-600" />
                                            <h4 className="font-semibold text-blue-900">Dimensões</h4>
                                        </div>
                                        <p className="text-sm text-blue-700">
                                            {product.dimensions.width_cm} x {product.dimensions.height_cm} x {product.dimensions.depth_cm} cm
                                        </p>
                                    </div>
                                )}
                                {product.weight && (
                                    <div className="p-4 bg-green-50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Weight className="w-5 h-5 text-green-600" />
                                            <h4 className="font-semibold text-green-900">Peso</h4>
                                        </div>
                                        <p className="text-sm text-green-700">{product.weight}g</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Warranty */}
                        {product.warranty_period && (
                            <div className="p-4 bg-purple-50 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Shield className="w-5 h-5 text-purple-600" />
                                    <h4 className="font-semibold text-purple-900">Garantia</h4>
                                </div>
                                <p className="text-sm text-purple-700">
                                    {product.warranty_period} meses de garantia
                                </p>
                            </div>
                        )}

                        {/* Pricing */}
                        <div className="border-t border-slate-200 pt-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-3">Preços</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {product.price_retail && (
                                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                                        <p className="text-xs text-slate-600 mb-1">Varejo</p>
                                        <p className="text-2xl font-bold text-blue-700">
                                            {formatPrice(product.price_retail)}
                                        </p>
                                    </div>
                                )}
                                {product.price_wholesale && (
                                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                                        <p className="text-xs text-slate-600 mb-1">Atacado</p>
                                        <p className="text-2xl font-bold text-green-700">
                                            {formatPrice(product.price_wholesale)}
                                        </p>
                                    </div>
                                )}
                                {product.price_reseller && (
                                    <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                                        <p className="text-xs text-slate-600 mb-1">Revenda</p>
                                        <p className="text-2xl font-bold text-purple-700">
                                            {formatPrice(product.price_reseller)}
                                        </p>
                                    </div>
                                )}
                            </div>
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
