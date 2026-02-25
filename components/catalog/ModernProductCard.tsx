import { useState, useEffect, useMemo } from 'react';
import { Info, Heart, Share2, ChevronLeft, ChevronRight, ShoppingCart, Check, GitCompare } from 'lucide-react';
import type { CatalogProduct, ProductGroup } from '@/types/catalog';
import type { ProductVariants } from '@/services/productVariants';
import { extractVariants } from '@/services/productVariants';
import { calculateInstallments, formatPrice } from '@/services/installmentCalculator';
import { getBadgesForCategory, getAllBadges, shouldShowBadge } from '@/config/category-badges';
import { ProductDetailsModal } from './ProductDetailsModal';
import { QuoteModal } from './QuoteModal';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getEffectivePrice, useEffectiveCustomerType } from '@/hooks/useEffectiveCustomerType';
import { useQuoteCart } from '@/contexts/QuoteCartContext';
import { useCompare } from '@/contexts/CompareContext';
import { CashbackBadge } from './CashbackBadge';

interface ModernProductCardProps {
    product: CatalogProduct;
    productGroup?: ProductGroup; // Optional: grouped products by variant
    relatedProducts?: CatalogProduct[]; // Products with same model_id
    onFavorite?: (productId: string) => void;
    onShare?: (product: CatalogProduct) => void;
    isFavorite?: boolean;
    onCompareToast?: (msg: string) => void; // callback for error toasts
}

export function ModernProductCard({
    product,
    productGroup,
    relatedProducts = [],
    onFavorite,
    onShare,
    isFavorite = false,
    onCompareToast,
}: ModernProductCardProps) {
    const [imageError, setImageError] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [installment10x, setInstallment10x] = useState<string>('');
    const [installment12x, setInstallment12x] = useState<string>('');
    const [currentColorIndex, setCurrentColorIndex] = useState(0);

    // NEW: Selected variant state (defaults to first variant)
    const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);

    // NEW: Store installment values for each variant
    const [variantInstallments, setVariantInstallments] = useState<Map<number, string>>(new Map());

    // Extract variants from productGroup or related products (using useMemo to prevent infinite loop)
    const variants = useMemo<ProductVariants | null>(() => {
        if (productGroup && productGroup.variants && productGroup.variants.length > 0) {
            // Use the selected variant from the group
            const selectedVariant = productGroup.variants[selectedVariantIndex] || productGroup.variants[0];
            return {
                rams: [selectedVariant.ram],
                storages: [selectedVariant.storage],
                colors: selectedVariant.colors,
                priceRange: selectedVariant.priceRange
            };
        } else {
            // Fallback to extracting from related products
            const allProducts = [product, ...relatedProducts];
            return extractVariants(allProducts);
        }
    }, [product, productGroup, relatedProducts, selectedVariantIndex]);

    // Get the currently selected variant
    const selectedVariant = productGroup?.variants?.[selectedVariantIndex];

    // Get the current product based on selected variant and color
    const currentProduct = useMemo(() => {
        if (selectedVariant && selectedVariant.products.length > 0) {
            // Try to find product with current color
            const colorName = selectedVariant.colors[currentColorIndex]?.name;
            if (colorName) {
                const productWithColor = selectedVariant.products.find(
                    p => p.specs?.color === colorName
                );
                if (productWithColor) return productWithColor;
            }
            // Fallback to first product in variant
            return selectedVariant.products[0];
        }
        return product;
    }, [selectedVariant, currentColorIndex, product]);

    // Get customer context for pricing
    const { customer } = useSupabaseAuth();
    const { items } = useQuoteCart();
    const isAdmin = customer?.customer_type === 'ADMIN';

    // Check if this product is in cart (by variant, not just product ID)
    const isInCart = useMemo(() => {
        if (!isAdmin) return false;

        // Get current product's RAM and Storage
        const currentRam = currentProduct.specs?.ram;
        const currentStorage = currentProduct.specs?.storage;

        // Check if any cart item matches this product's variant
        return items.some(item => {
            const ramMatch = item.variant.ram === currentRam;
            const storageMatch = item.variant.storage === currentStorage;
            const modelMatch = item.product.model === currentProduct.model ||
                item.product.name === currentProduct.name;

            return ramMatch && storageMatch && modelMatch;
        });
    }, [items, currentProduct, isAdmin]);

    const effectiveCustomerType = useEffectiveCustomerType();

    // Calculate 10x installment based on current product and customer type
    useEffect(() => {
        const effectivePrice = getEffectivePrice(currentProduct, customer);
        if (!effectivePrice) return;

        // Atacado só aceita PIX/Dinheiro à vista - sem parcelamento
        if (effectiveCustomerType === 'wholesale') {
            setInstallment10x('');
            return;
        }

        const loadInstallment = async () => {
            const plans = await calculateInstallments(effectivePrice, 12);
            const plan10x = plans.find(p => p.installments === 10);
            const plan12x = plans.find(p => p.installments === 12);
            if (plan10x) setInstallment10x(formatPrice(plan10x.value));
            if (plan12x) setInstallment12x(formatPrice(plan12x.value));
        };

        loadInstallment();
    }, [currentProduct, customer]);

    // Calculate installments for all variants
    useEffect(() => {
        if (!productGroup?.variants) return;

        // Atacado só aceita PIX/Dinheiro à vista - sem parcelamento
        if (effectiveCustomerType === 'wholesale') {
            setVariantInstallments(new Map());
            return;
        }

        const loadVariantInstallments = async () => {
            const newInstallments = new Map<number, string>();

            for (let i = 0; i < productGroup.variants.length; i++) {
                const variant = productGroup.variants[i];
                // Use first product in variant to get effective price
                const firstProduct = variant.products[0];
                const price = firstProduct ? getEffectivePrice(firstProduct, customer) : variant.priceRange.min;

                if (price > 0) {
                    const plans = await calculateInstallments(price, 12);
                    const plan12x = plans.find(p => p.installments === 12);
                    if (plan12x) {
                        newInstallments.set(i, formatPrice(plan12x.value));
                    }
                }
            }

            setVariantInstallments(newInstallments);
        };

        loadVariantInstallments();
    }, [productGroup]);

    // Get primary image — uses currentProduct (selected variant/color) not the representative product
    const getImageUrl = () => {
        // Handle images as string array (from Product type)
        if (Array.isArray(currentProduct.images) && currentProduct.images.length > 0) {
            // Ensure it's actually a string, not an object
            const firstImage = currentProduct.images[0];
            if (typeof firstImage === 'string' && firstImage.length > 0) {
                return firstImage;
            }
        }

        // Fallback to placeholder with brand name
        const brandName = currentProduct.brand || product.brand || 'Produto';
        return `data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%233B82F6'/><text x='200' y='155' font-family='Arial' font-size='18' fill='white' text-anchor='middle'>${encodeURIComponent(brandName)}</text></svg>`;
    };

    const imageUrl = !imageError ? getImageUrl() :
        `data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%23EF4444'/><text x='200' y='155' font-family='Arial' font-size='18' fill='white' text-anchor='middle'>Sem Imagem</text></svg>`;

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

    const { add: addToCompare, remove: removeFromCompare, isSelected: isComparing } = useCompare();
    const isInCompare = isComparing(product.id);

    const handleCompare = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isInCompare) {
            removeFromCompare(product.id);
        } else {
            const error = addToCompare(product);
            if (error) onCompareToast?.(error);
        }
    };

    // Carousel: Get images for each color
    const colorImages = useMemo(() => {
        if (!selectedVariant || !variants) return [imageUrl];

        return variants.colors.map(color => {
            // Find product with this color in the selected variant
            const colorProduct = selectedVariant.products.find(p => p.specs?.color === color.name);
            if (colorProduct && Array.isArray(colorProduct.images) && colorProduct.images.length > 0) {
                return colorProduct.images[0];
            }
            return imageUrl; // Fallback to default image
        });
    }, [selectedVariant, variants, imageUrl]);

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

    const effectivePriceReais = (getEffectivePrice(currentProduct, customer) || 0) / 100;

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

                    {/* Cashback Badge (top right) */}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-10 pointer-events-none">
                        <CashbackBadge paidAmountBrl={effectivePriceReais} variant="minimal" />
                    </div>

                    {/* Badges (top left) */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                        {/* Cart Badge (Admin only) */}
                        {isAdmin && isInCart && (
                            <span className="text-xs bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1.5 rounded-full font-semibold shadow-lg flex items-center gap-1 animate-pulse">
                                <ShoppingCart className="w-3 h-3" />
                                No Orçamento
                            </span>
                        )}

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

                        {/* Dynamic Spec Badges - based on category config */}
                        {(product.category_slug
                            ? getBadgesForCategory(product.category_slug)
                            : getAllBadges()
                        )
                            .filter(badge => shouldShowBadge(product, badge))
                            .map(badge => (
                                <span
                                    key={badge.spec}
                                    className={`text-xs bg-gradient-to-r ${badge.color} text-white px-3 py-1.5 rounded-full font-semibold shadow-md`}
                                >
                                    {badge.icon} {badge.label}
                                </span>
                            ))
                        }
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
                        <button
                            onClick={handleCompare}
                            className={`p-2.5 rounded-full backdrop-blur-md transition-all shadow-lg ${isInCompare
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-white/90 text-slate-700 hover:bg-white'
                                }`}
                            title={isInCompare ? 'Remover da comparação' : 'Comparar produto'}
                        >
                            <GitCompare className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Out of Stock Overlay */}
                    {product.track_inventory !== false && product.stock_quantity !== undefined && product.stock_quantity <= 0 && (
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
                            {productGroup
                                ? productGroup.model
                                : product.name.replace(/,?\s*\d+GB\/\d+GB/gi, '').trim()}
                        </h3>
                        {currentProduct.brand && (
                            <p className="text-sm text-slate-600 mt-1">{currentProduct.brand}</p>
                        )}
                    </div>





                    {/* Variant Selector (RAM/Storage) - NOVO */}
                    {productGroup && productGroup.variants && productGroup.variants.length > 1 ? (
                        <div className="space-y-2">
                            <div className="space-y-1.5">
                                {productGroup.variants.map((variant, idx) => {
                                    const installment = variantInstallments.get(idx);

                                    // Check if THIS specific variant (exact RAM + Storage) is in cart
                                    const variantInCart = isAdmin && items.some(item => {
                                        // Must match BOTH RAM and Storage exactly
                                        const ramMatch = item.variant.ram === variant.ram;
                                        const storageMatch = item.variant.storage === variant.storage;
                                        const modelMatch = item.product.model === currentProduct.model ||
                                            item.product.name === currentProduct.name;

                                        return ramMatch && storageMatch && modelMatch;
                                    });

                                    return (
                                        <button
                                            key={idx}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedVariantIndex(idx);
                                                setCurrentColorIndex(0); // Reset color selection
                                            }}
                                            className={`w-full p-2.5 rounded-lg border-2 transition-all text-left relative ${selectedVariantIndex === idx
                                                ? variantInCart
                                                    ? 'border-green-600 bg-green-50'
                                                    : 'border-blue-600 bg-blue-50'
                                                : variantInCart
                                                    ? 'border-green-300 bg-green-50/50 hover:border-green-400'
                                                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            {/* Cart indicator badge */}
                                            {variantInCart && (
                                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center shadow-md">
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                            )}

                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`font-semibold text-sm ${variantInCart ? 'text-green-700' : ''}`}>
                                                    {variant.ram}/{variant.storage}
                                                </span>
                                                <div className="text-right">
                                                    <div className={`text-base font-bold ${variantInCart ? 'text-green-600' : 'text-blue-600'}`}>
                                                        {formatPrice(variant.products[0] ? getEffectivePrice(variant.products[0], customer) : variant.priceRange.min)}
                                                    </div>
                                                    {installment && effectiveCustomerType !== 'wholesale' && (
                                                        <div className="text-xs text-slate-500">
                                                            12x de {installment}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Mini color indicators */}
                                            <div className="flex gap-1 mt-1.5">
                                                {variant.colors.slice(0, 4).map((color) => (
                                                    <div
                                                        key={color.name}
                                                        className="w-3 h-3 rounded-full border border-slate-300"
                                                        style={{ backgroundColor: color.hex }}
                                                        title={color.name}
                                                    />
                                                ))}
                                                {variant.colors.length > 4 && (
                                                    <span className="text-xs text-slate-500">+{variant.colors.length - 4}</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        // Fallback: Show individual product specs when no productGroup
                        <div className="space-y-2">
                            <div className="p-2.5 rounded-lg border-2 border-blue-600 bg-blue-50">
                                <div className="flex justify-between items-start mb-1">
                                    {/* Only show RAM/Storage if at least one exists */}
                                    {(product.specs?.ram || product.specs?.storage) ? (
                                        <span className="font-semibold text-sm">
                                            {product.specs?.ram || 'N/A'}/{product.specs?.storage || 'N/A'}
                                        </span>
                                    ) : (
                                        <span className="font-semibold text-sm text-slate-500">
                                            {product.specs?.color || 'Padrão'}
                                        </span>
                                    )}
                                    <div className="text-right">
                                        <div className="text-base font-bold text-blue-600">
                                            {formatPrice(getEffectivePrice(product, customer))}
                                        </div>
                                        {installment12x && effectiveCustomerType !== 'wholesale' && (
                                            <div className="text-xs text-slate-500">
                                                12x de {installment12x}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Color indicator — only show if we already showed RAM/Storage above */}
                                {(product.specs?.ram || product.specs?.storage) && product.specs?.color && (
                                    <div className="flex gap-1.5 mt-1.5 items-center">
                                        <div
                                            className="w-3 h-3 rounded-full border border-slate-300"
                                            style={{ backgroundColor: product.specs.color_hex || '#gray' }}
                                            title={product.specs.color}
                                        />
                                        <span className="text-xs text-slate-600">{product.specs.color}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}





                    {/* CTA Buttons */}
                    <div className="space-y-2">
                        <button
                            onClick={handleCardClick}
                            className={`w-full py-2.5 px-4 font-semibold rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2 ${isInCart
                                ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800'
                                : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                                }`}
                        >
                            {isInCart ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Adicionado
                                </>
                            ) : (
                                'Comprar'
                            )}
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
                        product={currentProduct}
                        isOpen={showDetailsModal}
                        onClose={() => setShowDetailsModal(false)}
                        onQuote={() => setShowQuoteModal(true)}
                    />
                    <QuoteModal
                        product={currentProduct}
                        variants={variants}
                        isOpen={showQuoteModal}
                        onClose={() => setShowQuoteModal(false)}
                        initialVariant={
                            selectedVariant
                                ? { ram: selectedVariant.ram, storage: selectedVariant.storage }
                                : {
                                    ram: currentProduct.specs?.ram,
                                    storage: currentProduct.specs?.storage,
                                    color: currentProduct.specs?.color
                                }
                        }
                    />
                </>
            )}
        </>
    );
}
