import { useState } from 'react';
import { Heart, Share2, ShoppingCart } from 'lucide-react';
import type { CatalogProduct } from '@/types/catalog';

interface ProductCardProps {
    product: CatalogProduct;
    onFavorite?: (productId: string) => void;
    onShare?: (product: CatalogProduct) => void;
    onAddToCart?: (product: CatalogProduct) => void;
    isFavorite?: boolean;
    variant?: 'grid' | 'list';
}

export function ProductCard({
    product,
    onFavorite,
    onShare,
    onAddToCart,
    isFavorite = false,
    variant = 'grid'
}: ProductCardProps) {
    const [imageError, setImageError] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Calcular preço com desconto
    const originalPrice = product.price_retail / 100;
    const discountedPrice = product.discount_percentage
        ? originalPrice * (1 - product.discount_percentage / 100)
        : originalPrice;

    const hasDiscount = product.discount_percentage && product.discount_percentage > 0;

    // Imagem com fallback
    const getImageUrl = () => {
        // Se images é um array e tem pelo menos uma imagem
        if (Array.isArray(product.images) && product.images.length > 0) {
            return product.images[0];
        }

        // Se images é uma string
        if (typeof product.images === 'string' && product.images) {
            return product.images;
        }

        // Fallback genérico baseado na marca
        const brandName = product.brand || 'Produto';
        return `https://via.placeholder.com/400x300/3B82F6/FFFFFF?text=${encodeURIComponent(brandName)}`;
    };

    const imageUrl = !imageError ? getImageUrl() : `https://via.placeholder.com/400x300/EF4444/FFFFFF?text=Sem+Imagem`;

    const handleFavorite = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onFavorite?.(product.id);
    };

    const handleShare = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onShare?.(product);
    };

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onAddToCart?.(product);
    };

    if (variant === 'list') {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow p-4">
                <div className="flex gap-4">
                    {/* Imagem */}
                    <div className="relative w-32 h-32 flex-shrink-0">
                        <img
                            src={imageUrl}
                            alt={product.name}
                            onError={() => setImageError(true)}
                            className="w-full h-full object-cover rounded-lg"
                        />
                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                            {product.featured && (
                                <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full font-semibold shadow-sm">
                                    ⭐ Destaque
                                </span>
                            )}
                            {product.is_new && (
                                <span className="text-xs bg-green-400 text-green-900 px-2 py-1 rounded-full font-semibold shadow-sm">
                                    🆕 Novo
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <h3 className="font-semibold text-lg text-slate-900 mb-1">{product.name}</h3>
                            <p className="text-sm text-slate-600 mb-2">{product.brand}</p>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                {hasDiscount && (
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm text-slate-500 line-through">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(originalPrice)}
                                        </span>
                                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                                            -{product.discount_percentage}%
                                        </span>
                                    </div>
                                )}
                                <p className="text-2xl font-bold text-blue-600">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discountedPrice)}
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleFavorite}
                                    className={`p-2 rounded-full transition-colors ${isFavorite
                                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                >
                                    <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                                </button>
                                <button
                                    onClick={handleShare}
                                    className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                    title="Compartilhar"
                                >
                                    <Share2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Grid variant (default)
    return (
        <div
            className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Imagem */}
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <img
                    src={imageUrl}
                    alt={product.name}
                    onError={() => setImageError(true)}
                    className={`w-full h-full object-cover transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'
                        }`}
                />

                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {product.featured && (
                        <span className="text-xs bg-yellow-400 text-yellow-900 px-3 py-1.5 rounded-full font-semibold shadow-md backdrop-blur-sm">
                            ⭐ Destaque
                        </span>
                    )}
                    {product.is_new && (
                        <span className="text-xs bg-green-400 text-green-900 px-3 py-1.5 rounded-full font-semibold shadow-md backdrop-blur-sm">
                            🆕 Novo
                        </span>
                    )}
                </div>

                {/* Desconto */}
                {hasDiscount && (
                    <div className="absolute top-3 right-3">
                        <span className="text-sm bg-red-500 text-white px-3 py-1.5 rounded-full font-bold shadow-md">
                            -{product.discount_percentage}%
                        </span>
                    </div>
                )}

                {/* Ações (aparecem no hover) */}
                <div
                    className={`absolute top-3 right-3 flex flex-col gap-2 transition-all duration-300 ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                        }`}
                >
                    {!hasDiscount && (
                        <>
                            <button
                                onClick={handleFavorite}
                                className={`p-2.5 rounded-full backdrop-blur-md transition-all shadow-lg ${isFavorite
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : 'bg-white/90 text-slate-700 hover:bg-white'
                                    }`}
                                title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                            >
                                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                            </button>
                            <button
                                onClick={handleShare}
                                className="p-2.5 rounded-full bg-white/90 backdrop-blur-md text-slate-700 hover:bg-white transition-all shadow-lg"
                                title="Compartilhar"
                            >
                                <Share2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>

                {/* Overlay de estoque */}
                {product.stock_quantity !== undefined && product.stock_quantity <= 0 && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                        <span className="text-white font-bold text-lg">Esgotado</span>
                    </div>
                )}
            </div>

            {/* Conteúdo */}
            <div className="p-4">
                {/* Título e Marca */}
                <div className="mb-3">
                    <h3 className="font-semibold text-slate-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {product.name}
                    </h3>
                    <p className="text-sm text-slate-600">{product.brand}</p>
                </div>

                {/* Preço */}
                <div className="mb-3">
                    {hasDiscount && (
                        <p className="text-sm text-slate-500 line-through mb-1">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(originalPrice)}
                        </p>
                    )}
                    <p className="text-2xl font-bold text-blue-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discountedPrice)}
                    </p>
                    {hasDiscount && (
                        <p className="text-xs text-green-600 font-semibold mt-1">
                            Economize {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(originalPrice - discountedPrice)}
                        </p>
                    )}
                </div>

                {/* Botão de ação */}
                {onAddToCart && (
                    <button
                        onClick={handleAddToCart}
                        disabled={product.stock_quantity !== undefined && product.stock_quantity <= 0}
                        className={`w-full py-2.5 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${product.stock_quantity !== undefined && product.stock_quantity <= 0
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-95'
                            }`}
                    >
                        <ShoppingCart className="w-4 h-4" />
                        {product.stock_quantity !== undefined && product.stock_quantity <= 0 ? 'Esgotado' : 'Adicionar ao Carrinho'}
                    </button>
                )}
            </div>
        </div>
    );
}
