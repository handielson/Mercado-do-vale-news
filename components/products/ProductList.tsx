
import React from 'react';
import { Package } from 'lucide-react';
import { Product } from '../../types/product';
import { ProductCard } from './ProductCard';

interface ProductListProps {
    products: Product[];
    isLoading: boolean;
    onEditProduct?: (product: Product) => void;
    onDeleteProduct?: (product: Product) => void;
}

/**
 * ProductList Component
 * Displays a responsive grid of products with loading and empty states
 */
export const ProductList: React.FC<ProductListProps> = ({
    products,
    isLoading,
    onEditProduct,
    onDeleteProduct
}) => {
    // Loading State: Show skeleton cards
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        {/* Skeleton Image */}
                        <div className="aspect-square bg-slate-200 animate-pulse" />

                        {/* Skeleton Content */}
                        <div className="p-4 space-y-3">
                            <div className="space-y-2">
                                <div className="h-5 bg-slate-200 rounded animate-pulse w-3/4" />
                                <div className="h-4 bg-slate-200 rounded animate-pulse w-1/2" />
                            </div>
                            <div className="h-6 bg-slate-200 rounded animate-pulse w-20" />
                            <div className="grid grid-cols-3 gap-2 pt-2">
                                <div className="h-10 bg-slate-200 rounded animate-pulse" />
                                <div className="h-10 bg-slate-200 rounded animate-pulse" />
                                <div className="h-10 bg-slate-200 rounded animate-pulse" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Empty State: No products found
    if (products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <Package className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">
                    Nenhum produto encontrado
                </h3>
                <p className="text-sm text-slate-500 text-center max-w-md">
                    Tente ajustar os filtros ou adicione novos produtos ao catálogo.
                </p>
            </div>
        );
    }

    // Products Grid
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
                <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={onEditProduct}
                    onDelete={onDeleteProduct}
                />
            ))}
        </div>
    );
};
