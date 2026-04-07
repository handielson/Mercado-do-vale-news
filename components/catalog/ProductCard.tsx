import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Share2, ShoppingCart, Pencil } from 'lucide-react';
import type { CatalogProduct } from '@/types/catalog';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getEffectivePrice } from '@/hooks/useEffectiveCustomerType';
import { toTitleCase } from '@/utils/stringFormatters';
import { getCacheBustedUrl } from '@/utils/cache-buster';
import { CashbackBadge } from './CashbackBadge';

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
    const [selectedKitQty, setSelectedKitQty] = useState<number>(1);
    const navigate = useNavigate();

    // Get customer context for pricing and roles
    const { customer } = useSupabaseAuth();
    const isAdmin = customer?.customer_type === 'ADMIN';

    // Calcular preço com desconto usando tipo de cliente efetivo
    const effectivePrice = getEffectivePrice(product, customer);
    const originalPrice = effectivePrice / 100;
    const baseDiscountedPrice = product.discount_percentage
        ? originalPrice * (1 - product.discount_percentage / 100)
        : originalPrice;

    const hasDiscount = product.discount_percentage && product.discount_percentage > 0;

    // Kit: calcula preço e economia baseado na opção selecionada
    const hasKits = Array.isArray(product.kits) && product.kits.length > 0;
    const sortedKits = hasKits
        ? [...product.kits!].sort((a, b) => a.quantity - b.quantity)
        : [];
    const selectedKit = hasKits && selectedKitQty > 1
        ? sortedKits.find(k => k.quantity === selectedKitQty) ?? null
        : null;
    const discountedPrice = selectedKit
        ? selectedKit.price / 100
        : baseDiscountedPrice;
    const kitSavings = selectedKit
        ? (baseDiscountedPrice * selectedKit.quantity) - (selectedKit.price / 100)
        : 0;

    // Deriva label singular a partir do nome do kit (ex: "3 meses" → "mês")
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
        if (!selectedKit) return 'Adicionar ao Carrinho';
        const kitLabel = selectedKit.name || `${selectedKit.quantity} ${kitUnitLabel === 'un' ? 'un' : `${kitUnitLabel}es`}`;
        return `Adicionar ${kitLabel}`;
    })();

    // Handler de clique no cart (passa a quantity do kit selecionado)
    const handleAddToCartWithKit = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onAddToCart?.(product);
    }, [onAddToCart, product]);

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

        // Fallback VPS-first: alguns endpoints compactos retornam apenas image_url
        if (typeof (product as any).image_url === 'string' && (product as any).image_url) {
            return (product as any).image_url;
        }

        // Fallback genérico baseado na marca
        const brandName = product.brand || 'Produto';
        return `data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%233B82F6'/><text x='200' y='155' font-family='Arial' font-size='18' fill='white' text-anchor='middle'>${encodeURIComponent(brandName)}</text></svg>`;
    };

    const rawImageUrl = !imageError ? getImageUrl() : `data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%23EF4444'/><text x='200' y='155' font-family='Arial' font-size='18' fill='white' text-anchor='middle'>Sem Imagem</text></svg>`;
    const imageUrl = getCacheBustedUrl(rawImageUrl, product.updated || product.created);

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

    const handleTitleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/produto/${product.slug || product.id}`);
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
                    <div
                        className="relative w-32 h-32 flex-shrink-0 cursor-pointer overflow-hidden bg-white"
                        onClick={handleTitleClick}
                    >
                        {product.is_combo && product.tags?.includes('mosaic_combo') && Array.isArray(product.images) && product.images.length > 1 ? (
                            <div className={`w-full h-full grid gap-0.5 ${product.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`}>
                                {product.images.slice(0, 4).map((img, i) => (
                                    <div key={i} className={`relative bg-white overflow-hidden ${product.images!.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
                                        <img src={getCacheBustedUrl(img, product.updated || product.created)} className="w-full h-full object-contain p-0.5" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <img
                                src={imageUrl}
                                alt={[product.name, product.specs?.color, product.brand].filter(Boolean).join(' ')}
                                onError={() => setImageError(true)}
                                className="w-full h-full object-cover rounded-lg"
                            />
                        )}
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
                            {product.is_combo && (
                                <span className="text-xs bg-teal-500 text-white px-2 py-1 rounded-full font-semibold shadow-sm">
                                    📦 Kit
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <h3
                                onClick={handleTitleClick}
                                className="font-semibold text-lg text-slate-900 mb-1 cursor-pointer hover:text-blue-600 hover:underline"
                            >
                                {toTitleCase(product.name)}
                            </h3>
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
                                <div className="flex items-center gap-2">
                                    <p className="text-2xl font-bold text-blue-600">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discountedPrice)}
                                    </p>
                                    <CashbackBadge paidAmountBrl={discountedPrice} variant="minimal" />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {isAdmin && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            navigate(`/admin/products/${product.id}`);
                                        }}
                                        className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                                        title="Editar Produto"
                                    >
                                        <Pencil className="w-5 h-5" />
                                    </button>
                                )}
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
            <div
                className="relative aspect-[4/3] overflow-hidden bg-slate-100 cursor-pointer"
                onClick={handleTitleClick}
            >
                {product.is_combo && product.tags?.includes('mosaic_combo') && Array.isArray(product.images) && product.images.length > 1 ? (
                    <div className={`w-full h-full grid gap-0.5 bg-white ${product.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`}>
                        {product.images.slice(0, 4).map((img, i) => (
                            <div key={i} className={`relative bg-white overflow-hidden border border-slate-50 ${product.images!.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
                                <img src={getCacheBustedUrl(img, product.updated || product.created)} className={`w-full h-full object-contain p-1 transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'}`} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <img
                        src={imageUrl}
                        alt={[product.name, product.specs?.color, product.brand].filter(Boolean).join(' ')}
                        onError={() => setImageError(true)}
                        className={`w-full h-full object-cover transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'
                            }`}
                    />
                )}

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
                    {product.is_combo && (
                        <span className="text-xs bg-teal-500 text-white px-3 py-1.5 rounded-full font-semibold shadow-md backdrop-blur-sm">
                            📦 Kit
                        </span>
                    )}
                </div>

                {/* Desconto */}
                {hasDiscount && (
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                        <span className="text-sm bg-red-500 text-white px-3 py-1.5 rounded-full font-bold shadow-md">
                            -{product.discount_percentage}%
                        </span>
                        <CashbackBadge paidAmountBrl={discountedPrice} variant="minimal" />
                    </div>
                )}
                {!hasDiscount && (
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                        <CashbackBadge paidAmountBrl={discountedPrice} variant="minimal" />
                    </div>
                )}

                {/* Ações (aparecem no hover) */}
                <div
                    className={`absolute top-3 right-3 flex flex-col gap-2 transition-all duration-300 ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                        }`}
                >
                    {isAdmin && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigate(`/admin/products/${product.id}`);
                            }}
                            className="p-2.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all shadow-lg"
                            title="Editar Produto"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                    )}
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
                {product.track_inventory !== false && product.stock_quantity !== undefined && product.stock_quantity <= 0 && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                        <span className="text-white font-bold text-lg">Esgotado</span>
                    </div>
                )}
            </div>

            {/* Conteúdo */}
            <div className="p-4">
                {/* Título e Marca */}
                <div className="mb-3">
                    <h3
                        onClick={handleTitleClick}
                        className="font-semibold text-slate-900 mb-1 line-clamp-3 hover:text-blue-600 transition-colors cursor-pointer hover:underline"
                    >
                        {toTitleCase(product.name)}
                    </h3>
                    <p className="text-sm text-slate-600">{product.brand}</p>
                </div>

                {/* Seletor de Kits — aparece somente se o produto tem kits configurados */}
                {hasKits && (
                    <div className="mb-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Escolha seu plano</p>
                        <div className="flex gap-1.5">
                            {/* Opção base: 1 unidade */}
                            <button
                                onClick={e => { e.stopPropagation(); setSelectedKitQty(1); }}
                                className={`flex-1 relative flex flex-col items-center rounded-xl border py-2 px-1 transition-all ${
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
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(baseDiscountedPrice)}
                                </span>
                            </button>

                            {/* Opções de kit */}
                            {sortedKits.map((kit, idx) => {
                                const isSelected = selectedKitQty === kit.quantity;
                                const isPopular = idx === Math.floor(sortedKits.length / 2) - (sortedKits.length % 2 === 0 ? 0 : 0) && sortedKits.length > 1;
                                const isBestPrice = idx === sortedKits.length - 1 && sortedKits.length > 1;
                                const kitUnitPrice = (kit.price / 100) / kit.quantity;
                                const kitName = kit.name || `${kit.quantity} ${kitUnitLabel}${
                                    kit.quantity > 1 && !['mês','dia','ano','semana'].includes(kitUnitLabel) ? 's' : ''
                                }`;
                                return (
                                    <button
                                        key={kit.quantity}
                                        onClick={e => { e.stopPropagation(); setSelectedKitQty(kit.quantity); }}
                                        className={`flex-1 relative flex flex-col items-center rounded-xl border py-2 px-1 transition-all ${
                                            isSelected && !isBestPrice
                                                ? 'border-blue-500 bg-blue-50 shadow-sm shadow-blue-100'
                                                : isSelected && isBestPrice
                                                ? 'border-emerald-500 bg-emerald-50 shadow-sm shadow-emerald-100'
                                                : isBestPrice
                                                ? 'border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50'
                                                : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                                        }`}
                                    >
                                        {/* Super badge */}
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
                                        <span className={`text-xs font-bold leading-tight ${
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
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kitUnitPrice)}/{kitUnitLabel}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Preço */}
                <div className="mb-3">
                    {hasDiscount && !selectedKit && (
                        <p className="text-sm text-slate-500 line-through mb-1">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(originalPrice)}
                        </p>
                    )}
                    <div className="flex items-end gap-2">
                        <p className="text-2xl font-bold text-blue-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discountedPrice)}
                        </p>
                        {selectedKit && kitSavings > 0 && (
                            <p className="text-xs text-emerald-600 font-semibold mb-0.5">
                                Economize {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kitSavings)}
                            </p>
                        )}
                    </div>
                    {hasDiscount && !selectedKit && (
                        <p className="text-xs text-green-600 font-semibold mt-1">
                            Economize {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(originalPrice - discountedPrice)}
                        </p>
                    )}
                </div>

                {/* Botão de ação */}
                {onAddToCart && (
                    <button
                        onClick={handleAddToCartWithKit}
                        disabled={product.track_inventory !== false && product.stock_quantity !== undefined && product.stock_quantity <= 0}
                        className={`w-full py-2.5 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                            product.track_inventory !== false && product.stock_quantity !== undefined && product.stock_quantity <= 0
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-95'
                        }`}
                    >
                        <ShoppingCart className="w-4 h-4" />
                        {product.track_inventory !== false && product.stock_quantity !== undefined && product.stock_quantity <= 0
                            ? 'Esgotado'
                            : cartBtnLabel
                        }
                    </button>
                )}
            </div>
        </div>
    );
}
