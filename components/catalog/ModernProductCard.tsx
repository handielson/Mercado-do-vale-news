import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, Heart, Share2, ChevronLeft, ChevronRight, ShoppingCart, Check, GitCompare, ShoppingBag, Pencil } from 'lucide-react';

import type { CatalogProduct, ProductGroup } from '@/types/catalog';
import type { ProductVariants } from '@/services/productVariants';
import { extractVariants } from '@/services/productVariants';
import { calculateInstallments, formatPrice } from '@/services/installmentCalculator';
import { getBadgesForCategory, getAllBadges, shouldShowBadge } from '@/config/category-badges';
import { ProductDetailsModal } from './ProductDetailsModal';
import { QuoteModal } from './QuoteModal';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getEffectivePrice, useEffectiveCustomerType } from '@/hooks/useEffectiveCustomerType';
import { useCompare } from '@/contexts/CompareContext';
import { useCart } from '@/contexts/CartContext';
import toast from 'react-hot-toast';
import { CashbackBadge } from './CashbackBadge';
import { getActivePromoPrice } from '@/utils/promoPrice';
import { ProductRatingBadge } from './ProductRatingBadge';
import { toTitleCase } from '@/utils/stringFormatters';
import { getCacheBustedUrl } from '@/utils/cache-buster';

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
    productGroup?: ProductGroup;
    relatedProducts?: CatalogProduct[];
    onFavorite?: (productId: string) => void;
    onShare?: (product: CatalogProduct) => void;
    isFavorite?: boolean;
    onCompareToast?: (msg: string) => void;
    listMode?: boolean; // layout horizontal compacto
}

export function ModernProductCard({
    product,
    productGroup,
    relatedProducts = [],
    onFavorite,
    onShare,
    isFavorite = false,
    onCompareToast,
    listMode = false,
}: ModernProductCardProps) {
    const [imageError, setImageError] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [installment10x, setInstallment10x] = useState<string>('');
    const [installment12x, setInstallment12x] = useState<string>('');
    const [selectedKitQty, setSelectedKitQty] = useState<number>(1);
    const [variantsExpanded, setVariantsExpanded] = useState(false);
    const [colorsExpandedVariants, setColorsExpandedVariants] = useState<Set<number>>(new Set());
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
    const [displayImageUrl, setDisplayImageUrl] = useState<string>('');

    const hasMedia = (p: CatalogProduct) => {
        if (Array.isArray(p.images) && p.images.some(img => typeof img === 'string' && img.trim().length > 0)) {
            return true;
        }
        return typeof (p as any).image_url === 'string' && (p as any).image_url.trim().length > 0;
    };

    // Calculate total stock across all variants/colors
    const totalGroupStock = useMemo(() => {
        if (productGroup?.variants) {
            let sum = 0;
            let hasTrackedInventory = false;
            productGroup.variants.forEach(v => {
                v.products.forEach(p => {
                    if (p.track_inventory !== false && typeof p.stock_quantity === 'number') {
                        sum += p.stock_quantity;
                        hasTrackedInventory = true;
                    }
                });
            });
            return hasTrackedInventory ? sum : undefined;
        }
        return (product.track_inventory !== false) ? product.stock_quantity : undefined;
    }, [productGroup, product]);

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
    const { items: cartItems, addItem: addToCartContext } = useCart();
    const isAdmin = customer?.customer_type === 'ADMIN';
    const [addedToCart, setAddedToCart] = useState(false);

    const handleAddToCart = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Only block if we have a valid product variant group that requires color selection
        if (currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1)) {
            alert('Por favor, selecione uma cor antes de adicionar ao carrinho.');
            return;
        }

        addToCartContext(currentProduct, selectedKitQty);
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };


    // Check if this product is in cart (by variant, not just product ID)
    const isInCart = useMemo(() => {
        if (!isAdmin) return false;

        // If it requires a color but none is selected, it's not the specific variant they intend to add yet
        if (currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1)) {
            return false;
        }

        // Check if the current product variant is in the retail cart
        return cartItems.some(item => item.product.id === currentProduct.id);
    }, [cartItems, currentProduct, isAdmin, currentColorIndex, productGroup]);

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
            ? (selectedVariant.products.find(hasMedia) || selectedVariant.products[0])
            : currentProduct;

        // Handle images as string array (from Product type)
        if (Array.isArray(productToUse.images) && productToUse.images.length > 0) {
            // Ensure it's actually a string, not an object
            const firstImage = productToUse.images[0];
            if (typeof firstImage === 'string' && firstImage.length > 0) {
                return firstImage;
            }
        }

        if (typeof (productToUse as any).image_url === 'string' && (productToUse as any).image_url) {
            return (productToUse as any).image_url;
        }

        // Fallback to professional placeholder
        return '/product-placeholder.png';
    };

    const rawImageUrl = !imageError ? getImageUrl() : '/product-placeholder.png';
    const imageUrl = getCacheBustedUrl(rawImageUrl, product.updated || product.created);

    // Build memory badge (RAM/Storage)
    const memoryBadge = variants && variants.rams.length > 0 && variants.storages.length > 0
        ? `${variants.rams[0]}/${variants.storages[0]}`
        : null;

    // Handlers
    const handleCardClick = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1)) {
            alert('Por favor, selecione uma cor antes de adicionar ao orçamento.');
            return;
        }

        // Add proper item to retail cart
        addToCartContext(currentProduct);
        
        // Visual feedback
        toast.success('Adicionado ao carrinho!');
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };

    const handleTitleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const targetProduct = currentProduct || product;
        navigate(`/produto/${targetProduct.slug || targetProduct.id}`);
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
                const imgUrl = typeof colorProduct.images[0] === 'string' ? colorProduct.images[0] : imageUrl;
                return getCacheBustedUrl(imgUrl, colorProduct.updated || colorProduct.created);
            }
            if (colorProduct && typeof (colorProduct as any).image_url === 'string' && (colorProduct as any).image_url) {
                return getCacheBustedUrl((colorProduct as any).image_url, colorProduct.updated || colorProduct.created);
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

    useEffect(() => {
        let objectUrl: string | null = null;
        let cancelled = false;

        const applyImage = async () => {
            if (!currentImage) {
                setDisplayImageUrl('/product-placeholder.png');
                return;
            }

            if (typeof currentImage === 'string' && currentImage.startsWith('data:image')) {
                try {
                    const response = await fetch(currentImage);
                    const blob = await response.blob();
                    objectUrl = URL.createObjectURL(blob);
                    if (!cancelled) setDisplayImageUrl(objectUrl);
                    return;
                } catch {
                    if (!cancelled) setDisplayImageUrl(currentImage);
                    return;
                }
            }

            setDisplayImageUrl(currentImage);
        };

        applyImage();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [currentImage]);

    const productForDisplay = currentColorIndex === -1 && selectedVariant && selectedVariant.products.length > 0
        ? selectedVariant.products[0]
        : currentProduct;

    // --- LOGICA DOS KITS ---
    const originalPriceCents = getEffectivePrice(productForDisplay, customer) || product.price_retail;
    const baseDiscountedPriceCents = productForDisplay.discount_percentage
        ? originalPriceCents * (1 - productForDisplay.discount_percentage / 100)
        : originalPriceCents;


    const hasKits = Array.isArray(productForDisplay.kits) && productForDisplay.kits.length > 0;
    const sortedKits = hasKits
        ? [...(productForDisplay.kits as import('@/types/catalog').ProductKit[])].sort((a, b) => a.quantity - b.quantity)
        : [];
        
    const selectedKit = hasKits && selectedKitQty > 1
        ? sortedKits.find(k => k.quantity === selectedKitQty) ?? null
        : null;
        
    const discountedPriceCents = selectedKit
        ? selectedKit.price
        : baseDiscountedPriceCents;
        
    const kitSavingsCents = selectedKit
        ? (baseDiscountedPriceCents * selectedKit.quantity) - selectedKit.price
        : 0;

    const deriveSingularUnit = useCallback((name?: string): string => {
        if (!name) return 'un';
        const m = name.trim().match(/^\d+\s+(\w+)/i);
        if (!m) return 'un';
        const unit = m[1].toLowerCase();
        const singular: Record<string, string> = {
            meses: 'mês', mês: 'mês', semanas: 'semana', dias: 'dia',
            anos: 'ano', unidades: 'un', un: 'un',
        };
        return singular[unit] ?? unit;
    }, []);

    const kitUnitLabel = hasKits && sortedKits[0]?.name
        ? deriveSingularUnit(sortedKits[0].name)
        : 'un';

    // Label do botão de carrinho
    const cartBtnLabel = (() => {
        if (!hasKits) return isAdmin ? 'Orçar' : 'Comprar';
        if (!selectedKit) return isAdmin ? 'Orçar 1 ' + kitUnitLabel : 'Adicionar 1 ' + kitUnitLabel;
        const kitLabel = selectedKit.name || `${selectedKit.quantity} ${kitUnitLabel === 'un' ? 'un' : `${kitUnitLabel}es`}`;
        return isAdmin ? `Orçar ${kitLabel}` : `Adicionar ${kitLabel}`;
    })();

    const effectivePriceReais = discountedPriceCents / 100;

    return (
        <>
            {/* ---- MODO LISTA: card horizontal compacto ---- */}
            {listMode && (
                <div
                    className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl shadow-sm px-3 py-2.5 hover:shadow-md transition-all cursor-pointer"
                    onClick={handleTitleClick}
                >
                    {/* Imagem */}
                    <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                        <img
                            src={displayImageUrl || currentImage}
                            alt={productForDisplay.name}
                            onError={() => setImageError(true)}
                            className="w-full h-full object-contain"
                        />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-slate-900 line-clamp-2 leading-tight">
                            {toTitleCase(productForDisplay.name.replace(/,?\s*\d+GB\/\d+GB/gi, '').trim())}
                        </p>
                        {productForDisplay.brand && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{productForDisplay.brand}</p>
                        )}
                        <p className={`text-xs font-bold mt-1 ${getActivePromoPrice(product) !== null || selectedKit ? 'text-red-500' : 'text-slate-800'}`}>
                            {formatPrice(discountedPriceCents)}
                        </p>
                    </div>
                    {/* Botão Admin Editar */}
                    {isAdmin && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/products/${product.id}`);
                            }}
                            className="shrink-0 p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                            title="Editar Produto"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                    )}
                    {/* Botão Comprar/Orçar */}
                    <button
                        onClick={(e) => { e.stopPropagation(); handleAddToCart(e); }}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-900 text-white hover:bg-slate-700 active:scale-95 transition-all"
                    >
                        {addedToCart ? '✓' : isAdmin ? 'Orçar' : 'Comprar'}
                    </button>
                </div>
            )}

            {/* ---- MODO GRADE: card vertical completo ---- */}
            {!listMode && (
            <div
                className="group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col h-full"
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
                        src={displayImageUrl || currentImage}
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
                    <div className="absolute top-2 left-2 flex flex-col gap-1.5 items-start">
                        {/* Cart Badge (Admin only) */}
                        {isAdmin && isInCart && (
                            <span className="text-[10px] sm:text-xs bg-blue-600/90 backdrop-blur-sm text-white px-2 py-1 rounded-full font-medium shadow-sm flex items-center gap-1 animate-pulse">
                                <ShoppingCart className="w-3 h-3" />
                                <span className="hidden sm:inline">No Orçamento</span>
                            </span>
                        )}

                        {product.featured && (
                            <span className="text-[10px] sm:text-xs bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 px-2 py-1 rounded-full font-medium shadow-sm">
                                ⭐ Destaque
                            </span>
                        )}
                        {product.is_new && (
                            <span className="text-[10px] sm:text-xs bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 px-2 py-1 rounded-full font-medium shadow-sm">
                                🆕 Novo
                            </span>
                        )}
                        {/* Badge de Promoção Ativa */}
                        {getActivePromoPrice(productForDisplay) !== null && (
                            <span className="text-[10px] sm:text-xs bg-red-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full font-medium shadow-sm animate-pulse">
                                Promo
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
                                    className={`text-[10px] sm:text-xs bg-white/80 backdrop-blur-sm border border-slate-100 text-slate-700 px-2 py-1 rounded-full font-medium shadow-sm flex items-center gap-1`}
                                >
                                    {badge.icon} {badge.label}
                                </span>
                            ))
                        }

                        {/* Gatilho de Escassez: Últimas Unidades */}
                        {totalGroupStock !== undefined && 
                         totalGroupStock > 0 && 
                         totalGroupStock <= 2 && (
                            <span className="text-[10px] sm:text-xs bg-orange-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full font-medium shadow-sm">
                                🔥 Acabando
                            </span>
                        )}
                        {/* Badge Sob Encomenda */}
                        {((product as any).effective_production_days ?? (product as any).production_days ?? 0) > 0 && (
                            <span className="text-[10px] sm:text-xs bg-amber-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full font-medium shadow-sm">
                                ⚙️ Encomenda
                            </span>
                        )}
                    </div>

                    {/* Action Buttons (bottom right on hover) */}
                    <div
                        className={`absolute bottom-3 right-3 flex gap-2 transition-all duration-300 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                            }`}
                    >
                        {isAdmin && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/admin/products/${product.id}`);
                                }}
                                className="p-2.5 rounded-full backdrop-blur-md transition-all shadow-lg bg-blue-500 text-white hover:bg-blue-600"
                                title="Editar Produto"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        )}
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
                <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
                    {/* Title & Brand */}
                    <div>
                        <ProductRatingBadge productId={product.id} className="mb-0.5" />
                        <h3
                            onClick={handleTitleClick}
                            className="font-medium text-xs sm:text-sm text-slate-900 line-clamp-3 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                            {toTitleCase(productForDisplay.name.replace(/,?\s*\d+GB\/\d+GB/gi, '').trim())}
                        </h3>
                        {productForDisplay.brand && (
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">{productForDisplay.brand}</p>
                        )}
                        {(currentProduct.sku || product.sku) && (
                            <p className="font-mono text-[9px] sm:text-[10px] text-slate-400 mt-0.5">
                                SKU: {currentProduct.sku || product.sku}
                            </p>
                        )}
                    </div>





                    {/* Variant Selector (RAM/Storage/Colors) - NOVO */}
                    {productGroup && productGroup.variants && (productGroup.variants.length > 1 || (productGroup.variants[0] && productGroup.variants[0].colors.length > 1)) ? (
                        <div className="space-y-2">
                            {/* Limit variants to 2 by default, expand on click */}
                            {(() => {
                                const VARIANTS_LIMIT = 2;
                                const allVariants = productGroup.variants;
                                const hasMoreVariants = allVariants.length > VARIANTS_LIMIT;
                                const visibleVariants = variantsExpanded ? allVariants : allVariants.slice(0, VARIANTS_LIMIT);
                                return (
                                    <>
                                        <div className="space-y-1.5">
                                            {visibleVariants.map((variant, idx) => {
                                                const installment = variantInstallments.get(idx);
                                                const isSelectedVariant = selectedVariantIndex === idx;
                                                const variantInCart = isAdmin && isSelectedVariant && currentColorIndex !== -1 && cartItems.some(item => {
                                                    const colorName = variant.colors[currentColorIndex]?.name;
                                                    return variant.products.some(vp =>
                                                        vp.id === item.product.id &&
                                                        vp.specs?.color === colorName
                                                    );
                                                });

                                                return (
                                                    <div
                                                        key={idx}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedVariantIndex(idx);
                                                            if (selectedVariantIndex !== idx) {
                                                                const newVariant = productGroup.variants[idx];
                                                                setCurrentColorIndex(newVariant && newVariant.colors.length === 1 ? 0 : -1);
                                                            }
                                                        }}
                                                        className={`w-full p-2 sm:p-2.5 rounded-xl border transition-all text-left relative cursor-pointer
                                                            ${isSelectedVariant
                                                                ? variantInCart
                                                                    ? 'border-green-300 bg-green-50/30'
                                                                    : 'border-blue-300 bg-blue-50/20 shadow-sm ring-1 ring-blue-300/50'
                                                                : variantInCart
                                                                    ? 'border-green-200 bg-green-50/20'
                                                                    : 'border-slate-100 bg-slate-50/50 hover:border-slate-300'
                                                            }`}
                                                    >
                                                        {variantInCart && (
                                                            <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                                                                <Check className="w-2.5 h-2.5 text-white" />
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between items-start mb-0.5">
                                                            <div className="flex flex-col">
                                                                <span className={`font-medium text-[10px] sm:text-xs ${variantInCart ? 'text-green-700' : 'text-slate-700'}`}>
                                                                    {variant.ram !== 'no-ram' || variant.storage !== 'no-storage'
                                                                        ? `${variant.ram}/${variant.storage}`
                                                                        : variant.colors.length > 1
                                                                            ? `${variant.colors.length} Cores`
                                                                            : variant.colors[0]?.name || 'Padrão'
                                                                    }
                                                                </span>
                                                                {isSelectedVariant && variant.colors.length > 0 && (
                                                                    <span className={`text-[9px] sm:text-[10px] mt-0.5 ${currentColorIndex !== -1 ? 'text-blue-500' : 'text-slate-400 animate-pulse'}`}>
                                                                        {currentColorIndex !== -1 ? variant.colors[currentColorIndex]?.name : 'Escolha a cor'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-right">
                                                                {variant.products[0] && getActivePromoPrice(variant.products[0]) !== null && (
                                                                    <div className="text-[9px] sm:text-[10px] text-slate-400 line-through">
                                                                        {formatPrice(variant.products[0].price_retail)}
                                                                    </div>
                                                                )}
                                                                <div className={`text-xs sm:text-sm font-semibold tracking-tight ${variantInCart ? 'text-green-600' : getActivePromoPrice(variant.products[0] ?? product) !== null ? 'text-red-500' : 'text-slate-900'}`}>
                                                                    {formatPrice(variant.products[0] ? getEffectivePrice(variant.products[0], customer) : variant.priceRange.min)}
                                                                </div>
                                                                {installment && effectiveCustomerType !== 'wholesale' && (
                                                                    <div className="text-[9px] sm:text-[10px] text-slate-500">
                                                                        12x de {installment}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {/* Color chips — alphabetical, limited to 3, expandable */}
                                                        {(() => {
                                                            const COLORS_LIMIT = 3;
                                                            // Sort alphabetically and preserve original index for state
                                                            const sortedColors = [...variant.colors]
                                                                .map((c, origIdx) => ({ ...c, origIdx }))
                                                                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
                                                            const isColorsExpanded = colorsExpandedVariants.has(idx);
                                                            const hasMoreColors = sortedColors.length > COLORS_LIMIT;
                                                            const visibleColors = isColorsExpanded ? sortedColors : sortedColors.slice(0, COLORS_LIMIT);
                                                            const toggleColors = (e: React.MouseEvent) => {
                                                                e.stopPropagation();
                                                                setColorsExpandedVariants(prev => {
                                                                    const next = new Set(prev);
                                                                    if (next.has(idx)) next.delete(idx); else next.add(idx);
                                                                    return next;
                                                                });
                                                            };
                                                            return (
                                                                <div className={`flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t transition-opacity duration-200
                                                                    ${isSelectedVariant ? 'border-slate-100 opacity-100' : 'border-transparent opacity-50'}
                                                                `}>
                                                                    {visibleColors.map(color => {
                                                                        const isSelectedColor = isSelectedVariant && currentColorIndex === color.origIdx;
                                                                        return (
                                                                            <button
                                                                                key={color.name}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setSelectedVariantIndex(idx);
                                                                                    setUserInteractedWithColor(true);
                                                                                    setCurrentColorIndex(color.origIdx);
                                                                                }}
                                                                                className={`px-2 py-0.5 rounded-full border text-[9px] sm:text-[10px] font-medium transition-all cursor-pointer
                                                                                    ${isSelectedColor
                                                                                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50'}
                                                                                `}
                                                                            >
                                                                                {color.name}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                    {hasMoreColors && (
                                                                        <button
                                                                            onClick={toggleColors}
                                                                            className="px-2 py-0.5 rounded-full border border-dashed border-blue-300 text-[9px] sm:text-[10px] font-medium text-blue-500 hover:bg-blue-50 transition-all flex items-center gap-0.5"
                                                                        >
                                                                            {isColorsExpanded
                                                                                ? 'Ver menos'
                                                                                : `+${sortedColors.length - COLORS_LIMIT} opções`}
                                                                            <ChevronRight className={`w-2.5 h-2.5 transition-transform duration-150 ${isColorsExpanded ? 'rotate-90' : '-rotate-90'}`} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                        {/* Selected color label */}
                                                        {isSelectedVariant && currentColorIndex !== -1 && variant.colors[currentColorIndex] && (
                                                            <p className="text-[9px] text-blue-500 mt-1">
                                                                Cor: <span className="font-semibold">{variant.colors[currentColorIndex].name}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Expand / Collapse button */}
                                        {hasMoreVariants && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setVariantsExpanded(v => !v); }}
                                                className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border border-dashed border-slate-200 text-[10px] sm:text-[11px] font-medium text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
                                            >
                                                <ChevronRight
                                                    className={`w-3 h-3 transition-transform duration-200 ${variantsExpanded ? 'rotate-90' : '-rotate-90'}`}
                                                />
                                                {variantsExpanded
                                                    ? 'Ver menos'
                                                    : `+${allVariants.length - VARIANTS_LIMIT} opções`}
                                            </button>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    ) : (
                        // Fallback: Show individual product specs when no productGroup
                        <div className="space-y-1 sm:space-y-2">
                            <div className="p-2 sm:p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                                <div className="flex justify-between items-start mb-0.5">
                                    {/* Only show RAM/Storage if at least one exists */}
                                    {(product.specs?.ram && product.specs?.ram !== 'no-ram') || (product.specs?.storage && product.specs?.storage !== 'no-storage') ? (
                                        <span className="font-medium text-[10px] sm:text-xs">
                                            {product.specs?.ram || 'N/A'}/{product.specs?.storage || 'N/A'}
                                        </span>
                                    ) : (
                                        <span className="font-medium text-[10px] sm:text-xs text-slate-500">
                                            {productGroup && productGroup.variants[0] && productGroup.variants[0].colors.length > 1
                                                ? `${productGroup.variants[0].colors.length} Cores`
                                                : product.specs?.color || ''}
                                        </span>
                                    )}
                                    <div className="text-right">
                                        {/* Preço riscado se promo ativa OR se tem kit selecionado (fallback individual) */}
                                        {(getActivePromoPrice(product) !== null || selectedKit) && (
                                            <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium tracking-tight flex items-center flex-wrap gap-1">
                                                <span className="line-through">{formatPrice(originalPriceCents * selectedKitQty)}</span>
                                                {selectedKit && (
                                                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1 py-0.5 rounded shadow-sm inline-block leading-none">
                                                        Economize {formatPrice(kitSavingsCents)}
                                                    </span>
                                                )}
                                                {!selectedKit && (product.discount_percentage ?? 0) > 0 && (
                                                    <span className="text-emerald-500 font-bold inline-block leading-none">-{product.discount_percentage}%</span>
                                                )}
                                            </div>
                                        )}
                                        <div className={`text-xs sm:text-sm font-semibold tracking-tight ${getActivePromoPrice(product) !== null || selectedKit ? 'text-red-500' : 'text-slate-900'}`}>
                                            {formatPrice(discountedPriceCents)}
                                        </div>
                                        {installment12x && effectiveCustomerType !== 'wholesale' && (
                                            <div className="text-[9px] sm:text-[10px] text-slate-500">
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

                    {/* Seletor de Kits (apenas grid, renderizado antes dos botões de ação) */}
                    {hasKits && (
                        <div className="mt-3 mb-2">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Escolha seu plano</p>
                            <div className="flex gap-1.5 flex-wrap">
                                {/* Opção base: 1 unidade */}
                                <button
                                    onClick={e => { e.stopPropagation(); setSelectedKitQty(1); }}
                                    className={`flex-1 min-w-[30%] relative flex flex-col items-center justify-center rounded-xl border py-2 px-1 transition-all ${
                                        selectedKitQty === 1
                                            ? 'border-blue-500 bg-blue-50 shadow-sm shadow-blue-100'
                                            : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                                    }`}
                                >
                                    <span className={`text-xs font-bold leading-tight ${
                                        selectedKitQty === 1 ? 'text-blue-700' : 'text-slate-700'
                                    }`}>
                                        1 {kitUnitLabel}
                                    </span>
                                    <span className={`text-[9px] mt-0.5 ${
                                        selectedKitQty === 1 ? 'text-blue-500' : 'text-slate-400'
                                    }`}>
                                        {formatPrice(baseDiscountedPriceCents)}
                                    </span>
                                </button>

                                {/* Opções de kit */}
                                {sortedKits.map((kit, idx) => {
                                    const isSelected = selectedKitQty === kit.quantity;
                                    const isPopular = idx === Math.floor(sortedKits.length / 2) - (sortedKits.length % 2 === 0 ? 0 : 0) && sortedKits.length > 1;
                                    const isBestPrice = idx === sortedKits.length - 1 && sortedKits.length > 1;

                                    const kitUnitPriceCents = kit.price / kit.quantity;
                                    const kitName = kit.name || `${kit.quantity} ${kitUnitLabel}${
                                        kit.quantity > 1 && !['mês','dia','ano','semana'].includes(kitUnitLabel) ? 's' : ''
                                    }`;
                                    return (
                                        <button
                                            key={kit.quantity}
                                            onClick={e => { e.stopPropagation(); setSelectedKitQty(kit.quantity); }}
                                            className={`flex-1 min-w-[30%] relative flex flex-col items-center justify-center rounded-xl border py-2 px-1 transition-all ${
                                                isSelected && !isBestPrice
                                                    ? 'border-blue-500 bg-blue-50 shadow-sm shadow-blue-100'
                                                    : isSelected && isBestPrice
                                                    ? 'border-emerald-500 bg-emerald-50 shadow-sm shadow-emerald-100'
                                                    : isBestPrice
                                                    ? 'border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50'
                                                    : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                                            }`}
                                        >
                                            {/* Super badges */}
                                            {isPopular && !isBestPrice && (
                                                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                    Popular
                                                </span>
                                            )}
                                            {isBestPrice && (
                                                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                    Melhor preço
                                                </span>
                                            )}
                                            <span className={`text-[11px] font-bold leading-tight ${
                                                isSelected && isBestPrice ? 'text-emerald-700'
                                                : isSelected ? 'text-blue-700'
                                                : 'text-slate-700'
                                            }`}>
                                                {kitName}
                                            </span>
                                            <span className={`text-[9px] mt-0.5 ${
                                                isSelected && isBestPrice ? 'text-emerald-500'
                                                : isSelected ? 'text-blue-500'
                                                : 'text-slate-400'
                                            }`}>
                                                {formatPrice(kitUnitPriceCents)}/{kitUnitLabel}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* CTA Buttons */}
                    <div className="space-y-1.5 sm:space-y-2 pt-1">
                        {/* Botão principal: Admin → Orçar | Cliente → Adicionar ao Carrinho */}
                        {isAdmin ? (
                            <button
                                onClick={handleCardClick}
                                disabled={currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1)}
                                className={`w-full py-1.5 sm:py-2 px-2 sm:px-4 text-[11px] sm:text-sm font-medium rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 
                                    ${(currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1))
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                        : (isInCart || addedToCart)
                                            ? 'bg-green-500 text-white shadow hover:bg-green-600'
                                            : 'bg-blue-600 text-white shadow hover:bg-blue-700'
                                    }`}
                            >
                                {currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1) ? (
                                    <>Escolha uma cor</>
                                ) : (isInCart || addedToCart) ? (
                                    <><Check className="w-3.5 h-3.5" />Adicionado</>
                                ) : (
                                    <><ShoppingCart className="w-3.5 h-3.5" />{cartBtnLabel}</>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={handleAddToCart}
                                disabled={currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1)}
                                className={`w-full py-1.5 sm:py-2 px-2 sm:px-4 text-[11px] sm:text-sm font-medium rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 
                                    ${(currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1))
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                        : addedToCart
                                            ? 'bg-green-500 text-white'
                                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow hover:shadow-md'
                                    }`}
                            >
                                {currentColorIndex === -1 && productGroup?.variants && (productGroup.variants.length > 1 || productGroup.variants[0].colors.length > 1) ? (
                                    <>Escolha uma cor</>
                                ) : addedToCart ? (
                                    <><Check className="w-3.5 h-3.5" />Adicionado</>
                                ) : (
                                    <><ShoppingBag className="w-3.5 h-3.5" />{cartBtnLabel}</>
                                )}
                            </button>
                        )}

                        <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
                            <button
                                onClick={handleInfoClick}
                                className="flex-1 py-1.5 sm:py-2 px-2 border border-slate-200 text-slate-600 font-medium rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all text-[11px] sm:text-sm flex items-center justify-center"
                            >
                                Detalhes
                            </button>
                            <button
                                onClick={handleCompare}
                                className={`flex-1 py-1.5 sm:py-2 px-2 border font-medium rounded-xl flex items-center justify-center gap-1 transition-all text-[11px] sm:text-sm ${isInCompare
                                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                title={isInCompare ? 'Remover da comparação' : 'Comparar produto'}
                            >
                                <GitCompare className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{isInCompare ? 'Cancel...' : '+ Comparar'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            )} {/* fim !listMode */}

            {/* Modals */}
            {variants && (
                <>
                    <ProductDetailsModal
                        product={currentProduct}
                        isOpen={showDetailsModal}
                        onClose={() => setShowDetailsModal(false)}
                        onQuote={() => {
                            setShowDetailsModal(false);
                            handleCardClick();
                        }}
                        totalStock={totalGroupStock}
                    />
                </>
            )}
        </>
    );
}
