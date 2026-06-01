import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ArrowLeft, ShoppingBag, Frown, RefreshCw, ShoppingCart } from 'lucide-react';
import { PublicHeader } from '@/components/PublicHeader';
import { useVpsAuth } from '@/contexts/VpsAuthContext';
import { catalogService } from '@/services/catalogService';
import { vpsApiService } from '@/services/vpsApiService';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

// ── Tipos simples para os produtos favoritos com dados dinâmicos ─────────────
interface FavoriteProduct {
    id: string;
    name: string;
    sku: string;
    price_retail: number;
    stock_quantity: number;
    track_inventory: boolean;
    image_url?: string;
    images?: string[];
    brand?: string;
    slug?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatBRL(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getFirstImage(product: FavoriteProduct): string | null {
    if (Array.isArray(product.images) && product.images.length > 0) return product.images[0];
    if (product.image_url) return product.image_url;
    return null;
}

// ── Card de produto favorito ──────────────────────────────────────────────────
function FavoriteCard({
    product,
    onRemove,
    removing,
}: {
    product: FavoriteProduct;
    onRemove: (id: string) => void;
    removing: boolean;
}) {
    const navigate = useNavigate();
    const { addItem } = useCart();
    const img = getFirstImage(product);
    const inStock = !product.track_inventory || product.stock_quantity > 0;

    const handleClick = () => {
        const href = product.slug ? `/produto/${product.slug}` : `/produto/${product.id}`;
        navigate(href);
    };

    const handleAddToCart = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!inStock) {
            toast.error('Produto sem estoque no momento.');
            return;
        }
        // Constrói objeto mínimo compatível com CatalogProduct.
        // price_retail é em centavos no CartContext (price_retail * 100).
        const catalogProduct = {
            id: product.id,
            name: product.name,
            sku: product.sku,
            price_retail: Math.round(product.price_retail * 100), // BRL → centavos
            stock_quantity: product.stock_quantity,
            track_inventory: product.track_inventory,
            image_url: product.image_url,
            images: product.images ?? [],
            brand: product.brand ?? '',
            slug: product.slug,
            status: 'active',
        } as any;
        addItem(catalogProduct, 1);
        toast.success(`${product.name} adicionado ao carrinho! 🛒`);
    };

    return (
        <div
            className={`group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col ${removing ? 'opacity-40 scale-95 pointer-events-none' : ''}`}
        >
            {/* Badge de estoque */}
            <div className="absolute top-3 left-3 z-10">
                {inStock ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold rounded-full shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Em estoque
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-red-600 text-[10px] font-semibold rounded-full shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                        Sem estoque
                    </span>
                )}
            </div>

            {/* Botão remover favorito */}
            <button
                onClick={(e) => { e.stopPropagation(); onRemove(product.id); }}
                className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm border border-red-200 rounded-full text-red-500 hover:bg-red-50 hover:scale-110 transition-all shadow-sm"
                title="Remover dos favoritos"
            >
                <Heart size={15} fill="currentColor" />
            </button>

            {/* Imagem */}
            <div
                className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer"
                onClick={handleClick}
            >
                {img ? (
                    <img
                        src={img}
                        alt={product.name}
                        className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <ShoppingBag size={40} className="text-slate-300" />
                )}
            </div>

            {/* Conteúdo */}
            <div className="p-4 flex flex-col gap-2 flex-1">
                {product.brand && (
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{product.brand}</span>
                )}
                <h3
                    className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={handleClick}
                >
                    {product.name}
                </h3>

                <div className="mt-auto pt-2 flex flex-col gap-2">
                    <span className="text-lg font-bold text-slate-900">
                        {product.price_retail > 0 ? formatBRL(product.price_retail) : '—'}
                    </span>
                    <div className="flex gap-2">
                        {/* Adicionar ao carrinho */}
                        <button
                            onClick={handleAddToCart}
                            disabled={!inStock}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                                inStock
                                    ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                            title={inStock ? 'Adicionar ao carrinho' : 'Sem estoque'}
                        >
                            <ShoppingCart size={13} />
                            <span>Adicionar</span>
                        </button>
                        {/* Ver produto */}
                        <button
                            onClick={handleClick}
                            className="px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg transition-all"
                        >
                            Ver
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function FavoriteSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
            <div className="aspect-square bg-slate-100" />
            <div className="p-4 space-y-3">
                <div className="h-3 bg-slate-100 rounded-full w-1/3" />
                <div className="h-4 bg-slate-100 rounded-full w-full" />
                <div className="h-4 bg-slate-100 rounded-full w-3/4" />
                <div className="flex justify-between items-center mt-2">
                    <div className="h-6 bg-slate-100 rounded-full w-20" />
                    <div className="h-8 bg-slate-100 rounded-lg w-24" />
                </div>
            </div>
        </div>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────
export function CustomerFavoritesPage() {
    const navigate = useNavigate();
    const { customer, isLoading: authLoading } = useVpsAuth();

    const [products, setProducts] = useState<FavoriteProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

    // Redirecionar se não autenticado
    useEffect(() => {
        if (!authLoading && !customer) {
            navigate('/cliente/login?redirect=/favoritos', { replace: true });
        }
    }, [authLoading, customer, navigate]);

    const loadFavorites = useCallback(async () => {
        if (!customer?.id) return;

        setLoading(true);
        setError(null);

        try {
            // 1. Buscar IDs de favoritos na VPS
            const favoriteIds = await catalogService.getUserFavorites(customer.id);

            if (favoriteIds.length === 0) {
                setProducts([]);
                return;
            }

            // 2. Buscar dados dinâmicos de cada produto (preço + estoque atuais) na VPS
            const productPromises = favoriteIds.map(async (id) => {
                try {
                    const raw = await vpsApiService.getProductById(id);
                    if (!raw) return null;

                    // Normalizar stock
                    const s = raw.stock !== undefined ? raw.stock : raw.stock_quantity;
                    let stockVal = 0;
                    if (typeof s === 'number') stockVal = s;
                    else if (typeof s === 'string' && s.trim() !== '' && s.trim().toLowerCase() !== 'null') {
                        stockVal = parseInt(s, 10) || 0;
                    }

                    // Normalizar preço — VPS armazena price_retail em centavos.
                    // O campo `price` (quando presente) já vem em BRL; `price_retail` precisa ÷ 100.
                    const rawPriceRetail = raw.price_retail ?? null;
                    const rawPriceBRL    = raw.price ?? raw.preco ?? raw.preco_venda ?? raw.preco_varejo ?? null;
                    let price = 0;
                    if (rawPriceRetail !== null && rawPriceRetail !== undefined) {
                        // centavos → BRL
                        price = parseFloat(String(rawPriceRetail)) / 100;
                    } else if (rawPriceBRL !== null && rawPriceBRL !== undefined) {
                        // já em BRL
                        price = parseFloat(String(rawPriceBRL));
                    }
                    if (isNaN(price) || price < 0) price = 0;

                    // Normalizar imagens
                    let imgs: string[] = [];
                    if (Array.isArray(raw.images)) imgs = raw.images;
                    else if (typeof raw.images === 'string') { try { imgs = JSON.parse(raw.images); } catch { imgs = []; } }

                    return {
                        id: raw.id,
                        name: raw.name,
                        sku: raw.sku,
                        price_retail: price,
                        stock_quantity: stockVal,
                        track_inventory: raw.track_inventory ?? (s !== null && s !== undefined),
                        image_url: raw.image_url,
                        images: imgs,
                        brand: raw.brand,
                        slug: raw.slug,
                    } as FavoriteProduct;
                } catch {
                    return null;
                }
            });

            const results = await Promise.all(productPromises);
            setProducts(results.filter(Boolean) as FavoriteProduct[]);
        } catch (err: any) {
            console.error('[CustomerFavoritesPage] Erro ao carregar favoritos:', err);
            setError('Não foi possível carregar seus favoritos. Tente novamente.');
        } finally {
            setLoading(false);
        }
    }, [customer?.id]);

    useEffect(() => {
        if (customer?.id) {
            loadFavorites();
        }
    }, [customer?.id, loadFavorites]);

    // Remove com optimistic update
    const handleRemove = useCallback(async (productId: string) => {
        if (!customer?.id) return;

        // Optimistic UI
        setRemovingIds(prev => new Set(prev).add(productId));
        setProducts(prev => prev.filter(p => p.id !== productId));

        try {
            await catalogService.removeFromFavorites(productId, customer.id);
            toast.success('Removido dos favoritos');
        } catch {
            // Reverter se falhar
            toast.error('Erro ao remover favorito. Tente novamente.');
            loadFavorites();
        } finally {
            setRemovingIds(prev => { const s = new Set(prev); s.delete(productId); return s; });
        }
    }, [customer?.id, loadFavorites]);

    // Loading de auth
    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-50">
                <PublicHeader />
                <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    if (!customer) return null; // Redirecionando

    return (
        <div className="min-h-screen bg-slate-50">
            <PublicHeader />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6 transition-colors bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm"
                    >
                        <ArrowLeft size={16} />
                        Voltar à loja
                    </Link>

                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center border border-red-100">
                                <Heart size={20} className="text-red-500" fill="currentColor" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">
                                    Meus Favoritos
                                    {!loading && products.length > 0 && (
                                        <span className="ml-2 text-lg font-normal text-slate-400">
                                            ({products.length})
                                        </span>
                                    )}
                                </h1>
                                <p className="text-sm text-slate-500 mt-0.5">Produtos que você salvou para lembrar depois</p>
                            </div>
                        </div>

                        {!loading && products.length > 0 && (
                            <button
                                onClick={loadFavorites}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                <RefreshCw size={14} />
                                Atualizar preços
                            </button>
                        )}
                    </div>
                </div>

                {/* Estados */}

                {/* Erro */}
                {error && !loading && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                            <Frown size={28} className="text-red-400" />
                        </div>
                        <p className="text-slate-600 text-center">{error}</p>
                        <button
                            onClick={loadFavorites}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
                        >
                            Tentar novamente
                        </button>
                    </div>
                )}

                {/* Carregando */}
                {loading && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => <FavoriteSkeleton key={i} />)}
                    </div>
                )}

                {/* Vazio */}
                {!loading && !error && products.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 gap-6">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
                            <Heart size={40} className="text-slate-300" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-slate-700 mb-2">Nenhum favorito ainda</h2>
                            <p className="text-slate-500 max-w-sm">
                                Toque no coração ❤️ em qualquer produto do catálogo para salvar aqui.
                            </p>
                        </div>
                        <Link
                            to="/"
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-colors shadow-md hover:shadow-lg"
                        >
                            Explorar produtos
                        </Link>
                    </div>
                )}

                {/* Grid de favoritos */}
                {!loading && !error && products.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {products.map(product => (
                            <FavoriteCard
                                key={product.id}
                                product={product}
                                onRemove={handleRemove}
                                removing={removingIds.has(product.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
