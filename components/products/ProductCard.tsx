
import React from 'react';
import { Edit, Package } from 'lucide-react';
import { Product } from '../../types/product';
import { ProductStatus } from '../../utils/field-standards';
import { cn } from '../../utils/cn';

interface ProductCardProps {
    product: Product;
    onEdit?: (product: Product) => void;
}

/**
 * ProductCard Component
 * Displays product information in a card format with image, prices, and status
 */
export const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit }) => {
    // Format price from centavos to BRL
    const formatPrice = (centavos: number): string => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(centavos / 100);
    };

    // Status badge colors
    const getStatusColor = (status: ProductStatus): string => {
        switch (status) {
            case ProductStatus.ACTIVE:
                return 'bg-green-100 text-green-800 border-green-200';
            case ProductStatus.INACTIVE:
                return 'bg-red-100 text-red-800 border-red-200';
            case ProductStatus.OUT_OF_STOCK:
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case ProductStatus.DISCONTINUED:
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusLabel = (status: ProductStatus): string => {
        switch (status) {
            case ProductStatus.ACTIVE:
                return 'Ativo';
            case ProductStatus.INACTIVE:
                return 'Inativo';
            case ProductStatus.OUT_OF_STOCK:
                return 'Sem Estoque';
            case ProductStatus.DISCONTINUED:
                return 'Descontinuado';
            default:
                return status;
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow duration-200">
            {/* Image */}
            <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden relative">
                {product.images && product.images.length > 0 ? (
                    <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <Package className="w-16 h-16 text-slate-300" />
                )}

                {/* Stock Badge */}
                {product.track_inventory && (
                    <div className={cn(
                        'absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold shadow-md',
                        product.stock_quantity === 0
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : (product.stock_quantity ?? 0) < 5
                                ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                : 'bg-green-100 text-green-700 border border-green-300'
                    )}>
                        {product.stock_quantity === 0
                            ? 'Sem Estoque'
                            : `${product.stock_quantity} un.`}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{product.name}</h3>
                        <p className="font-mono text-xs text-slate-500 mt-0.5">{product.sku}</p>
                    </div>
                    <button
                        onClick={() => onEdit?.(product)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Editar produto"
                    >
                        <Edit className="w-4 h-4 text-slate-600" />
                    </button>
                </div>

                {/* Status Badge */}
                <div>
                    <span className={cn(
                        'inline-block px-2 py-1 text-xs font-medium rounded-md border',
                        getStatusColor(product.status)
                    )}>
                        {getStatusLabel(product.status)}
                    </span>
                </div>

                {/* Prices */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Varejo</p>
                        <p className="text-sm font-bold text-blue-600">{formatPrice(product.price_retail)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Revenda</p>
                        <p className="text-sm font-semibold text-slate-700">{formatPrice(product.price_reseller)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Atacado</p>
                        <p className="text-sm font-semibold text-slate-700">{formatPrice(product.price_wholesale)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
