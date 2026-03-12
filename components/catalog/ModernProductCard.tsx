import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, Heart, Share2, ChevronLeft, ChevronRight, ShoppingCart, Check, GitCompare, ShoppingBag } from 'lucide-react';

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
import { useCart } from '@/contexts/CartContext';
import { CashbackBadge } from './CashbackBadge';
import { getActivePromoPrice } from '@/utils/promoPrice';

// Utility to determine if a color is dark enough to need white text
const isDarkColor = (colorHex: string) => {
    const hex = colorHex.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq < 128;
};

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
    const navigate = useNavigate();
    // Selected variant state (defaults to first variant)
    const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);

    const [currentColorIndex, setCurrentColorIndex] = useState<number>(() => {
        if (productGroup?.variants && productGroup.variants.length > 0) {
            return productGroup.variants[0].colors.length === 1 ? 0 : -1;
        }
        return -1;
    });

    // We track if the user ever clicked a color manually. 
    // This helps us decide whether to force reset the color if pagination adds more colors.
    const [userInteractedWithColor, setUserInteractedWithColor] = useState(false);

    // Store installment values for each variant
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

    useEffect(() => {
        if (!variants) return;

        if (variants.colors.length === 1) {
            // Se só tem 1 cor disponível, auto-seleciona
            setCurrentColorIndex(0);
        } else if (variants.colors.length > 1 && currentColorIndex === 0 && !userInteractedWithColor) {
            // BUGFIX: Se a quantidade de cores subir de 1 para >1 (paginação inserindo mais cores no mesmo card/grupo)
            // Precisamos RESETAR para -1 para garantir que a mensagem 'Escolha uma cor abaixo' apareça
            setCurrentColorIndex(-1);
        }
    }, [variants?.colors.length, userInteractedWithColor]);

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

    const { customer } = useSupabaseAuth();
    const { items } = useQuoteCart();
    const { addItem: addToCartContext } = useCart();
    const isAdmin = customer?.customer_type === 'ADMIN';
    const [addedToCart, setAddedToCart] = useState(false);

    const handleAddToCart = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Only block if we have a valid product variant group that requires color selection
        if (currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1)) {
            alert('Por favor, selecione uma cor antes de adicionar ao carrinho.');
            return;
        }

        addToCartContext(currentProduct);
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };


    // Check if this product is in cart (by variant, not just product ID)
    const isInCart = useMemo(() => {
        if (!isAdmin || currentColorIndex === -1) return false;

        // Get current product's RAM and Storage
        const currentRam = currentProduct.specs?.ram;
        const currentStorage = currentProduct.specs?.storage;
        const currentColor = currentProduct.specs?.color;

        // Check if any cart item matches this product's variant AND color
        return items.some(item => {
            const ramMatch = item.variant.ram === currentRam;
            const storageMatch = item.variant.storage === currentStorage;
            const modelMatch = item.product.model === currentProduct.model ||
                item.product.name === currentProduct.name;
            const colorMatch = item.product.specs?.color === currentColor;

            return ramMatch && storageMatch && modelMatch && colorMatch;
        });
    }, [items, currentProduct, isAdmin, currentColorIndex]);

    const effectiveCustomerType = useEffectiveCustomerType();

    // Calculate 10x installment based on current product and customer type
    useEffect(() => {
        const productForPrice = currentColorIndex === -1 && selectedVariant && selectedVariant.products.length > 0
            ? selectedVariant.products[0]
            : currentProduct;

        const effectivePrice = getEffectivePrice(productForPrice, customer);
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
    }, [currentProduct, customer, currentColorIndex, selectedVariant]);

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
        const productToUse = currentColorIndex === -1 && selectedVariant && selectedVariant.products.length > 0
            ? selectedVariant.products[0]
            : currentProduct;

        // Handle images as string array (from Product type)
        if (Array.isArray(productToUse.images) && productToUse.images.length > 0) {
            // Ensure it's actually a string, not an object
            const firstImage = productToUse.images[0];
            if (typeof firstImage === 'string' && firstImage.length > 0) {
                return firstImage;
            }
        }

        // Fallback to professional placeholder
        return '/product-placeholder.png';
    };

    const imageUrl = !imageError ? getImageUrl() : '/product-placeholder.png';

    // Build memory badge (RAM/Storage)
    const memoryBadge = variants && variants.rams.length > 0 && variants.storages.length > 0
        ? `${variants.rams[0]}/${variants.storages[0]}`
        : null;

    // Handlers
    const handleCardClick = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (currentColorIndex === -1) {
            alert('Por favor, selecione uma cor antes de adicionar ao orçamento.');
            return;
        }
        setShowQuoteModal(true);
    };

    const handleTitleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Use slug if available, otherwise just use id
        navigate(`/produto/${product.slug || product.id}`);
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
        if (currentColorIndex === -1) {
            // If no color selected, default to first or last
            setCurrentColorIndex(colorImages.length - 1);
            return;
        }
        setCurrentColorIndex((prev) => (prev === 0 ? colorImages.length - 1 : prev - 1));
    };

    const handleNextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentColorIndex === -1) {
            setCurrentColorIndex(0);
            return;
        }
        setCurrentColorIndex((prev) => (prev === colorImages.length - 1 ? 0 : prev + 1));
    };

    const handleColorClick = (index: number) => (e: React.MouseEvent) => {
        e.stopPropagation();
        setUserInteractedWithColor(true);
        setCurrentColorIndex(index);
    };

    // Use default image if no color selected, otherwise use color's image
    const currentImage = currentColorIndex === -1
        ? imageUrl
        : (colorImages[currentColorIndex] || imageUrl);

    const productForDisplay = currentColorIndex === -1 && selectedVariant && selectedVariant.products.length > 0
        ? selectedVariant.products[0]
        : currentProduct;

    const effectivePriceReais = (getEffectivePrice(productForDisplay, customer) || 0) / 100;

    return (
        <>
            <div
                className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col h-full"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={handleTitleClick}
            >
                {/* Image */}
                <div
                    className="relative aspect-[4/3] overflow-hidden bg-slate-100 cursor-pointer"
                    onClick={handleTitleClick}
                >
                    <img
                        src={currentImage}
                        alt={[
                            productForDisplay.name || product.name,
                            currentColorIndex !== -1 ? variants?.colors[currentColorIndex]?.name : '',
                            productForDisplay.brand,
                        ].filter(Boolean).join(' ')}
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
                        {/* Badge de Promoção Ativa */}
                        {getActivePromoPrice(productForDisplay) !== null && (
                            <span className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-full font-semibold shadow-md animate-pulse">
                                🏷️ PROMO
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

                        {/* Gatilho de Escassez: Últimas Unidades */}
                        {product.track_inventory !== false && 
                         product.stock_quantity !== undefined && 
                         product.stock_quantity > 0 && 
                         product.stock_quantity <= 5 && (
                            <span className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1.5 rounded-full font-bold shadow-md animate-pulse">
                                🔥 Últimas Unidades
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
                        <h3
                            onClick={handleTitleClick}
                            className="font-semibold text-slate-900 line-clamp-2 hover:text-blue-600 transition-colors cursor-pointer hover:underline"
                        >
                            {productGroup
                                ? productGroup.model
                                : product.name.replace(/,?\s*\d+GB\/\d+GB/gi, '').trim()}
                        </h3>
                        {productForDisplay.brand && (
                            <p className="text-sm text-slate-600 mt-1">{productForDisplay.brand}</p>
                        )}
                        {(currentProduct.sku || product.sku) && (
                            <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                                SKU: {currentProduct.sku || product.sku}
                            </p>
                        )}
                    </div>





                    {/* Variant Selector (RAM/Storage/Colors) - NOVO */}
                    {productGroup && productGroup.variants && (productGroup.variants.length > 1 || (productGroup.variants[0] && productGroup.variants[0].colors.length > 1)) ? (
                        <div className="space-y-2">
                            <div className="space-y-1.5">
                                {productGroup.variants.map((variant, idx) => {
                                    const installment = variantInstallments.get(idx);

                                    // Check if THIS specific variant (exact RAM + Storage) is in cart
                                    // AND the current color matches the cart item's color.
                                    const variantInCart = isAdmin && items.some(item => {
                                        const ramMatch = item.variant.ram === variant.ram;
                                        const storageMatch = item.variant.storage === variant.storage;
                                        const modelMatch = item.product.model === productForDisplay.model ||
                                            item.product.name === productForDisplay.name;
                                        // If no color selected yet, we can't be sure this exact item is in cart
                                        if (currentColorIndex === -1 && selectedVariantIndex === idx) return false;

                                        // Match color if variant is currently selected
                                        const colorMatch = selectedVariantIndex === idx
                                            ? item.product.specs?.color === variant.colors[currentColorIndex]?.name
                                            : false;

                                        return ramMatch && storageMatch && modelMatch && colorMatch;
                                    });

                                    const isSelectedVariant = selectedVariantIndex === idx;

                                    return (
                                        <div
                                            key={idx}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedVariantIndex(idx);
                                                // DON'T reset color if clicking same variant!
                                                if (selectedVariantIndex !== idx) {
                                                    const newVariant = productGroup.variants[idx];
                                                    // Auto-select if the new variant only has 1 color
                                                    setCurrentColorIndex(newVariant && newVariant.colors.length === 1 ? 0 : -1);
                                                }
                                            }}
                                            className={`w-full p-2.5 rounded-lg border-2 transition-all text-left relative cursor-pointer
                                                ${isSelectedVariant
                                                    ? variantInCart
                                                        ? 'border-green-600 bg-green-50 shadow-sm'
                                                        : 'border-blue-600 bg-blue-50 shadow-sm ring-1 ring-blue-600 ring-offset-1'
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
                                                <div className="flex flex-col">
                                                    <span className={`font-semibold text-sm ${variantInCart ? 'text-green-700' : 'text-slate-800'}`}>
                                                        {variant.ram !== 'no-ram' || variant.storage !== 'no-storage'
                                                            ? `${variant.ram}/${variant.storage}`
                                                            : variant.colors.length > 1
                                                                ? `${variant.colors.length} Cores`
                                                                : variant.colors[0]?.name || 'Padrão'
                                                        }
                                                    </span>
                                                    {/* Mostrar a cor selecionada em texto se for a variante ativa */}
                                                    {isSelectedVariant && variant.colors.length > 0 && (
                                                        <span className={`text-xs font-medium mt-0.5 ${currentColorIndex !== -1 ? 'text-blue-600' : 'text-orange-500 animate-pulse'}`}>
                                                            {currentColorIndex !== -1 ? `Cor: ${variant.colors[currentColorIndex]?.name}` : '⚠️ Escolha uma cor abaixo'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    {/* Preço riscado se houver promo ativa */}
                                                    {variant.products[0] && getActivePromoPrice(variant.products[0]) !== null && (
                                                        <div className="text-xs text-slate-400 line-through">
                                                            {formatPrice(variant.products[0].price_retail)}
                                                        </div>
                                                    )}
                                                    <div className={`text-base font-bold ${variantInCart ? 'text-green-600' : getActivePromoPrice(variant.products[0] ?? product) !== null ? 'text-red-600' : 'text-blue-600'}`}>
                                                        {formatPrice(variant.products[0] ? getEffectivePrice(variant.products[0], customer) : variant.priceRange.min)}
                                                    </div>
                                                    {installment && effectiveCustomerType !== 'wholesale' && (
                                                        <div className="text-xs text-slate-500">
                                                            12x de {installment}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Color indicators & selectors */}
                                            <div className={`flex flex-wrap gap-2 mt-2 pt-2 border-t transition-opacity duration-200 
                                                ${isSelectedVariant ? 'border-blue-200 opacity-100' : 'border-slate-200 opacity-70'}
                                            `}>
                                                {variant.colors.map((color, colorIdx) => {
                                                    const isSelectedColor = isSelectedVariant && currentColorIndex === colorIdx;
                                                    return (
                                                        <div
                                                            key={color.name}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedVariantIndex(idx);
                                                                setUserInteractedWithColor(true);
                                                                setCurrentColorIndex(colorIdx);
                                                            }}
                                                            className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center
                                                                ${isSelectedColor
                                                                    ? 'border-blue-600 scale-110 shadow-md ring-2 ring-blue-200 ring-offset-1 z-10'
                                                                    : 'border-slate-300 hover:scale-110 hover:border-blue-400'}
                                                            `}
                                                            style={{ backgroundColor: color.hex }}
                                                            title={color.name}
                                                        >
                                                            {isSelectedColor && (
                                                                <Check className={`w-3 h-3 ${isDarkColor(color.hex) ? 'text-white' : 'text-slate-800'}`} />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
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
                                    {(product.specs?.ram && product.specs?.ram !== 'no-ram') || (product.specs?.storage && product.specs?.storage !== 'no-storage') ? (
                                        <span className="font-semibold text-sm">
                                            {product.specs?.ram || 'N/A'}/{product.specs?.storage || 'N/A'}
                                        </span>
                                    ) : (
                                        <span className="font-semibold text-sm text-slate-500">
                                            {productGroup && productGroup.variants[0] && productGroup.variants[0].colors.length > 1
                                                ? `${productGroup.variants[0].colors.length} Cores`
                                                : product.specs?.color || ''}
                                        </span>
                                    )}
                                    <div className="text-right">
                                        {/* Preço riscado se promo ativa (fallback individual) */}
                                        {getActivePromoPrice(product) !== null && (
                                            <div className="text-xs text-slate-400 line-through">
                                                {formatPrice(product.price_retail)}
                                            </div>
                                        )}
                                        <div className={`text-base font-bold ${getActivePromoPrice(product) !== null ? 'text-red-600' : 'text-blue-600'}`}>
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
                                {((product.specs?.ram && product.specs?.ram !== 'no-ram') || (product.specs?.storage && product.specs?.storage !== 'no-storage')) && product.specs?.color && (
                                    <div className="flex gap-1.5 mt-1.5 items-center">
                                        <div
                                            className="w-3 h-3 rounded-full border border-slate-300"
                                            style={{ backgroundColor: product.specs.color_hex || '#gray' }}
                                            title={product.specs.color}
                                        />
                                        <span className="text-xs text-slate-600">{product.specs.color}</span>
                                    </div>
                                )}

                                {/* Color indicator for standard items with multiple colors grouped in fallback */}
                                {(!((product.specs?.ram && product.specs?.ram !== 'no-ram') || (product.specs?.storage && product.specs?.storage !== 'no-storage'))) && productGroup && productGroup.variants[0] && productGroup.variants[0].colors.length > 1 && (
                                    <div className="flex gap-1 mt-1.5">
                                        {productGroup.variants[0].colors.slice(0, 4).map((color) => (
                                            <div
                                                key={color.name}
                                                className="w-3 h-3 rounded-full border border-slate-300"
                                                style={{ backgroundColor: color.hex }}
                                                title={color.name}
                                            />
                                        ))}
                                        {productGroup.variants[0].colors.length > 4 && (
                                            <span className="text-xs text-slate-500">+{productGroup.variants[0].colors.length - 4}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CTA Buttons */}
                    <div className="space-y-2">
                        {/* Botão principal: Admin → Orçar | Cliente → Adicionar ao Carrinho */}
                        {isAdmin ? (
                            <button
                                onClick={handleCardClick}
                                disabled={currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1)}
                                className={`w-full py-2.5 px-4 font-semibold rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 
                                    ${(currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1))
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border border-slate-300'
                                        : isInCart
                                            ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 hover:shadow-lg'
                                            : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 hover:shadow-lg'
                                    }`}
                            >
                                {currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1) ? (
                                    <>Escolha uma cor para adicionar</>
                                ) : isInCart ? (
                                    <><Check className="w-4 h-4" />Adicionado</>
                                ) : (
                                    <><ShoppingCart className="w-4 h-4" />Adicionar ao Orçamento</>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={handleAddToCart}
                                disabled={currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1)}
                                className={`w-full py-2.5 px-4 font-semibold rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 
                                    ${(currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1))
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border border-slate-300'
                                        : addedToCart
                                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                                            : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 hover:shadow-lg'
                                    }`}
                            >
                                {currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1) ? (
                                    <>Escolha uma cor para comprar</>
                                ) : addedToCart ? (
                                    <><Check className="w-4 h-4" />Adicionado!</>
                                ) : (
                                    <><ShoppingBag className="w-4 h-4" />Comprar</>
                                )}
                            </button>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                onClick={handleInfoClick}
                                className="flex-1 py-2 px-3 border-2 border-slate-300 text-slate-700 font-medium rounded-lg hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm"
                            >
                                Detalhes
                            </button>
                            <button
                                onClick={handleCompare}
                                className={`flex-1 py-2 px-2 border-2 font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all text-sm ${isInCompare
                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                    : 'border-slate-300 text-slate-700 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50'
                                    }`}
                                title={isInCompare ? 'Remover da comparação' : 'Comparar produto'}
                            >
                                <GitCompare className="w-4 h-4 shrink-0" />
                                <span className="truncate">{isInCompare ? 'Comparando' : 'Comparar'}</span>
                            </button>
                        </div>
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
