import { useState, useEffect, useMemo } from 'react';
import { Info, Heart, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CatalogProduct, ProductGroup } from '@/types/catalog';
import type { ProductVariants } from '@/services/productVariants';
import { extractVariants } from '@/services/productVariants';
import { calculateInstallments, formatPrice } from '@/services/installmentCalculator';
import { getBadgesForCategory, shouldShowBadge } from '@/config/category-badges';
import { ProductDetailsModal } from './ProductDetailsModal';
import { QuoteModal } from './QuoteModal';

interface ModernProductCardProps {
    product: CatalogProduct;
    productGroup?: ProductGroup; // Optional: grouped products by variant
    relatedProducts?: CatalogProduct[]; // Products with same model_id
    onFavorite?: (productId: string) => void;
    onShare?: (product: CatalogProduct) => void;
    isFavorite?: boolean;
}

export function ModernProductCard({
    product,
    productGroup,
    relatedProducts = [],
    onFavorite,
    onShare,
    isFavorite = false
}: ModernProductCardProps) {
    const [imageError, setImageError] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [installment10x, setInstallment10x] = useState<string>('');
    const [currentColorIndex, setCurrentColorIndex] = useState(0);

    // Extract variants from productGroup or related products (using useMemo to prevent infinite loop)
    const variants = useMemo<ProductVariants | null>(() => {
        if (productGroup) {
            // Use pre-computed variants from group
            return {
                rams: [productGroup.ram],
                storages: [productGroup.storage],
                colors: productGroup.colors,
                priceRange: productGroup.priceRange
            };
        } else {
            // Fallback to extracting from related products
            const allProducts = [product, ...relatedProducts];
            return extractVariants(allProducts);
        }
    }, [product, productGroup, relatedProducts]);

    // Calculate 10x installment
    useEffect(() => {
        if (!product.price_retail) return;

        const loadInstallment = async () => {
            const plans = await calculateInstallments(product.price_retail!, 12);
            const plan10x = plans.find(p => p.installments === 10);
            if (plan10x) {
                setInstallment10x(formatPrice(plan10x.value));
            }
        };

        loadInstallment();
    }, [product.price_retail]);

    // Get primary image
    const getImageUrl = () => {
        // Handle images as string array (from Product type)
        if (Array.isArray(product.images) && product.images.length > 0) {
            return product.images[0]; // First image is primary
        }

        // Fallback to placeholder with brand name
        const brandName = product.brand || 'Produto';
        return `https://via.placeholder.com/400x300/3B82F6/FFFFFF?text=${encodeURIComponent(brandName)}`;
    };

    const imageUrl = !imageError ? getImageUrl() :
        `https://via.placeholder.com/400x300/EF4444/FFFFFF?text=Sem+Imagem`;

    // Build memory badge (RAM/Storage)
    const memoryBadge = variants && variants.rams.length > 0 && variants.storages.length > 0
        ? `${variants.rams[0]}/${variants.storages[0]}`
        : null;

    // Handlers
    const handleCardClick = () => {
        setShowQuoteModal(true);
    };

    const handleInfoClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDetailsModal(true);
    };

    const handleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        onFavorite?.(product.id);
    };

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        onShare?.(product);
    };

    // Carousel: Get images for each color
    const colorImages = useMemo(() => {
        if (!productGroup || !variants) return [imageUrl];

        return variants.colors.map(color => {
            // Find product with this color
            const colorProduct = productGroup.products.find(p => p.specs?.color === color.name);
            if (colorProduct && Array.isArray(colorProduct.images) && colorProduct.images.length > 0) {
                return colorProduct.images[0];
            }
            return imageUrl; // Fallback to default image
        });
    }, [productGroup, variants, imageUrl]);

    const handlePrevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentColorIndex((prev) => (prev === 0 ? colorImages.length - 1 : prev - 1));
    };

    const handleNextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentColorIndex((prev) => (prev === colorImages.length - 1 ? 0 : prev + 1));
    };

    const handleColorClick = (index: number) => (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentColorIndex(index);
    };

    const currentImage = colorImages[currentColorIndex] || imageUrl;

    return (
        <>
            <div
                className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={handleCardClick}
            >
                {/* Image */}
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    <img
                        src={currentImage}
                        alt={product.name}
                        onError={() => setImageError(true)}
                        className={`w-full h-full object-contain transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'
                            }`}
                    />

                    {/* Carousel Navigation Arrows (only show if multiple colors) */}
                    {colorImages.length > 1 && (
                        <>
                            <button
                                onClick={handlePrevImage}
                                className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all ${isHovered ? 'opacity-100' : 'opacity-0'
                                    }`}
                                title="Cor anterior"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleNextImage}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all ${isHovered ? 'opacity-100' : 'opacity-0'
                                    }`}
                                title="Próxima cor"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </>
                    )}

                    {/* Badges (top left) */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                        {product.featured && (
                            <span className="text-xs bg-yellow-400 text-yellow-900 px-3 py-1.5 rounded-full font-semibold shadow-md">
                                ⭐ Destaque
                            </span>
                        )}
                        {product.is_new && (
                            <span className="text-xs bg-green-400 text-green-900 px-3 py-1.5 rounded-full font-semibold shadow-md">
                                🆕 Novo
                            </span>
                        )}

                        {/* Dynamic Spec Badges */}
                        {product.specs?.nfc === 'Sim' && (
                            <span className="text-xs bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1.5 rounded-full font-semibold shadow-md">
                                📡 NFC
                            </span>
                        )}
                        {product.specs?.['5g'] === 'Sim' && (
                            <span className="text-xs bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1.5 rounded-full font-semibold shadow-md">
                                📶 5G
                            </span>
                        )}
                        {product.specs?.dual_sim === 'Sim' && (
                            <span className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1.5 rounded-full font-semibold shadow-md">
                                📱 Dual SIM
                            </span>
                        )}
                    </div>

                    {/* Action Buttons (bottom right on hover) */}
                    <div
                        className={`absolute bottom-3 right-3 flex gap-2 transition-all duration-300 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                            }`}
                    >
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
                    </div>

                    {/* Out of Stock Overlay */}
                    {product.stock_quantity !== undefined && product.stock_quantity <= 0 && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                            <span className="text-white font-bold text-lg">Esgotado</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                    {/* Title & Brand */}
                    <div>
                        <h3 className="font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {product.model || product.name}
                        </h3>
                        {product.brand && (
                            <p className="text-sm text-slate-600 mt-1">{product.brand}</p>
                        )}
                    </div>

                    {/* Colors */}
                    {variants && variants.colors.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600">Cores:</span>
                            <div className="flex gap-1.5">
                                {variants.colors.slice(0, 5).map((color) => (
                                    <div
                                        key={color.name}
                                        className="w-5 h-5 rounded-full border-2 border-slate-300 shadow-sm"
                                        style={{ backgroundColor: color.hex || '#9CA3AF' }}
                                        title={color.name}
                                    />
                                ))}
                                {variants.colors.length > 5 && (
                                    <span className="text-xs text-slate-500">+{variants.colors.length - 5}</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Pricing */}
                    <div>
                        <p className="text-2xl font-bold text-blue-600">
                            {formatPrice(product.price_retail || 0)}
                        </p>
                        {installment10x && (
                            <p className="text-sm text-slate-600 mt-1">
                                ou <span className="font-semibold">10x de {installment10x}</span>
                            </p>
                        )}
                    </div>

                    {/* CTA Buttons */}
                    <div className="space-y-2">
                        <button
                            onClick={handleCardClick}
                            className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                            Comprar
                        </button>
                        <button
                            onClick={handleInfoClick}
                            className="w-full py-2 px-4 border-2 border-slate-300 text-slate-700 font-medium rounded-lg hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                            Ver Descrição
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {variants && (
                <>
                    <ProductDetailsModal
                        product={product}
                        isOpen={showDetailsModal}
                        onClose={() => setShowDetailsModal(false)}
                        onQuote={() => setShowQuoteModal(true)}
                    />
                    <QuoteModal
                        product={product}
                        variants={variants}
                        isOpen={showQuoteModal}
                        onClose={() => setShowQuoteModal(false)}
                    />
                </>
            )}
        </>
    );
}
