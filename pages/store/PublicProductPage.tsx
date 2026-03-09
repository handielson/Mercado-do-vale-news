import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Share2, ShoppingCart, ShieldCheck, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/services/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useQuoteCart } from '@/contexts/QuoteCartContext';
import { PublicHeader } from '@/components/PublicHeader';
import { QuoteCartSidebar } from '@/components/catalog/QuoteCartSidebar';
import { FloatingCartButton } from '@/components/catalog/FloatingCartButton';
import { CatalogProduct } from '@/types/catalog';
import { getEffectivePrice } from '@/hooks/useEffectiveCustomerType';

/**
 * PublicProductPage
 * A dedicated SEO-friendly landing page for a single product.
 */
export const PublicProductPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { customer } = useSupabaseAuth();
    const { dispatch } = useQuoteCart();

    const [product, setProduct] = useState<CatalogProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string>('');

    useEffect(() => {
        if (!slug) {
            navigate('/');
            return;
        }

        const fetchProduct = async () => {
            setLoading(true);
            try {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);

                let query = supabase
                    .from('products')
                    .select('*, brand:brands(name), category:categories(name)')
                    .eq('status', 'active');

                if (isUuid) {
                    query = query.eq('id', slug);
                } else {
                    query = query.eq('slug', slug);
                }

                // Fetch the product
                const { data, error } = await query.single();

                if (error) {
                    console.error('Produto não encontrado:', error);
                    toast.error('Produto não encontrado');
                    navigate('/');
                    return;
                }

                // Format it perfectly as CatalogProduct
                const formattedProduct = {
                    ...data,
                    brand: data.brand?.name || data.brand,
                    category: data.category?.name || data.category_id,
                };

                setProduct(formattedProduct as unknown as CatalogProduct);

                if (data.images && data.images.length > 0) {
                    setSelectedImage(data.images[0]);
                }
            } catch (err) {
                console.error(err);
                navigate('/');
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [slug, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50">
                <PublicHeader />
                <div className="flex justify-center items-center h-[60vh]">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!product) return null;

    // Prices calculation
    const effectivePrice = getEffectivePrice(product, customer);
    const originalPrice = effectivePrice / 100;
    const discountedPrice = product.discount_percentage
        ? originalPrice * (1 - product.discount_percentage / 100)
        : originalPrice;

    const title = product.meta_title || `${product.name} | Mercado do Vale`;
    const description = product.meta_description || product.description || `Compre ${product.name} no Mercado do Vale.`;

    const handleAddToCart = () => {
        dispatch({ type: 'ADD_ITEM', payload: product });
        toast.success('Produto adicionado ao carrinho!', {
            icon: '🛒',
            duration: 3000
        });
    };

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: product.name,
                    text: `Olha esse produto no Mercado do Vale: ${product.name}`,
                    url
                });
            } catch (err) {
                console.warn('Share rejected:', err);
            }
        } else {
            await navigator.clipboard.writeText(url);
            toast.success('Link copiado para a área de transferência!');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Injeção JSON-LD Local via Helmet para Crawlers React-Awares (Google) */}
            <Helmet>
                <title>{title}</title>
                <meta name="description" content={description} />
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org/",
                        "@type": "Product",
                        "name": product.name,
                        "image": product.images || [],
                        "description": description,
                        "sku": product.sku || '',
                        "brand": {
                            "@type": "Brand",
                            "name": typeof product.brand === 'string' ? product.brand : 'Mercado do Vale'
                        },
                        "offers": {
                            "@type": "Offer",
                            "url": window.location.href,
                            "priceCurrency": "BRL",
                            "price": discountedPrice.toString(),
                            "availability": product.stock_quantity && product.stock_quantity > 0
                                ? "https://schema.org/InStock"
                                : "https://schema.org/OutOfStock",
                            "itemCondition": "https://schema.org/NewCondition"
                        }
                    })}
                </script>
            </Helmet>

            <PublicHeader />

            <FloatingCartButton />
            <QuoteCartSidebar />

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Breadcrumbs */}
                <nav className="flex items-center gap-2 text-sm text-slate-500 mb-8">
                    <button onClick={() => navigate('/')} className="hover:text-blue-600 transition-colors">
                        Início
                    </button>
                    {product.category && (
                        <>
                            <span>/</span>
                            <span className="text-slate-700">{typeof product.category === 'string' ? product.category : 'Categoria'}</span>
                        </>
                    )}
                    <span>/</span>
                    <span className="text-slate-900 font-medium truncate max-w-[200px] sm:max-w-xs">
                        {product.name}
                    </span>
                </nav>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Galeria de Imagens (Esquerda) */}
                    <div className="space-y-4">
                        <div className="aspect-square bg-white rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center p-4">
                            {selectedImage ? (
                                <img
                                    src={selectedImage}
                                    alt={product.name}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="text-slate-400 font-medium">Sem imagem</div>
                            )}
                        </div>
                        {product.images && product.images.length > 1 && (
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {product.images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedImage(img)}
                                        className={`w-20 h-20 flex-shrink-0 bg-white rounded-lg border-2 overflow-hidden ${selectedImage === img ? 'border-blue-600' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <img src={img} alt="" className="w-full h-full object-contain p-1" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Informações do Produto (Direita) */}
                    <div className="space-y-6">
                        <div>
                            {product.brand && (
                                <span className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2 block">
                                    {typeof product.brand === 'string' ? product.brand : 'Marca'}
                                </span>
                            )}
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                                {product.name}
                            </h1>
                            <div className="flex items-center gap-4 mt-3">
                                <span className="text-sm text-slate-500">
                                    SKU: <span className="font-mono">{product.sku || 'N/A'}</span>
                                </span>
                                <button
                                    onClick={handleShare}
                                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors"
                                >
                                    <Share2 size={16} /> Compartilhar
                                </button>
                            </div>
                        </div>

                        {/* Preço */}
                        <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden">
                            {product.track_inventory && (product.stock_quantity || 0) > 0 && (product.stock_quantity || 0) <= 5 && (
                                <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-xs font-bold text-center py-1 animate-pulse">
                                    Corra! Apenas {product.stock_quantity} unidades em estoque.
                                </div>
                            )}
                            <div className={product.track_inventory && (product.stock_quantity || 0) > 0 && (product.stock_quantity || 0) <= 5 ? "mt-4" : ""}>
                                {product.discount_percentage ? (
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg text-slate-400 line-through">
                                                R$ {originalPrice.toFixed(2).replace('.', ',')}
                                            </span>
                                            <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                                -{product.discount_percentage}% OFF
                                            </span>
                                        </div>
                                        <div className="text-4xl font-extrabold text-slate-900">
                                            R$ {discountedPrice.toFixed(2).replace('.', ',')}
                                        </div>
                                        <p className="text-sm font-medium text-green-600 mt-1">
                                            ou em até <span className="font-bold">12x de R$ {(discountedPrice / 12).toFixed(2).replace('.', ',')}</span> sem juros
                                        </p>
                                        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-100">
                                            ✓ 5% desconto direto no PIX
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-4xl font-extrabold text-slate-900">
                                            R$ {discountedPrice.toFixed(2).replace('.', ',')}
                                        </div>
                                        <p className="text-sm font-medium text-green-600 mt-1">
                                            ou em até <span className="font-bold">12x de R$ {(discountedPrice / 12).toFixed(2).replace('.', ',')}</span> sem juros
                                        </p>
                                    </div>
                                )}

                                <div className="mt-6">
                                    <button
                                        onClick={handleAddToCart}
                                        disabled={!product.track_inventory ? false : (product.stock_quantity || 0) <= 0}
                                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-xl transition-colors shadow-blue-600/20 shadow-lg text-lg"
                                    >
                                        <ShoppingCart size={24} />
                                        {(!product.track_inventory || (product.stock_quantity || 0) > 0) ? 'Adicionar ao Carrinho' : 'Fora de Estoque'}
                                    </button>
                                </div>
                            </div>

                            {/* Badges de Garantia e Entrega */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <ShieldCheck className="w-8 h-8 text-green-600 shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-sm">Garantia de {(product as any).store_warranty_period || (product as any).brand_warranty_period || 90} dias</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Compra 100% segura e garantida pela loja.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <Truck className="w-8 h-8 text-blue-600 shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-sm">Entregamos</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Consulte as taxas pro seu CEP no carrinho.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Descrição Longa */}
                            {product.description && (
                                <div className="pt-6 border-t border-slate-200">
                                    <h3 className="text-lg font-bold text-slate-900 mb-3">Descrição do Produto</h3>
                                    <div className="prose prose-slate prose-sm max-w-none text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: product.description }} />
                                </div>
                            )}

                            {/* Especificações Técnicas */}
                            {product.specs && Object.keys(product.specs).length > 0 && (
                                <div className="pt-6 border-t border-slate-200">
                                    <h3 className="text-lg font-bold text-slate-900 mb-3">Especificações</h3>
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
                                        {Object.entries(product.specs).map(([key, value]) => {
                                            if (typeof value !== 'string' && typeof value !== 'number') return null;
                                            return (
                                                <div key={key} className="flex flex-col border-b border-slate-100 pb-2">
                                                    <span className="text-slate-500 capitalize">{key}</span>
                                                    <span className="font-medium text-slate-900">{value}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
            </main>

            {/* Sticky Mobile CTA */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden z-40 flex items-center gap-4">
                <div className="flex-1">
                    <p className="text-xs text-slate-500 uppercase font-bold">Total à vista</p>
                    <p className="text-xl font-extrabold text-blue-600">R$ {discountedPrice.toFixed(2).replace('.', ',')}</p>
                </div>
                <button
                    onClick={handleAddToCart}
                    disabled={!product.track_inventory ? false : (product.stock_quantity || 0) <= 0}
                    className="flex-shrink-0 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg"
                >
                    <ShoppingCart size={20} />
                    {(!product.track_inventory || (product.stock_quantity || 0) > 0) ? 'Comprar' : 'Esgotado'}
                </button>
            </div>
        </div>
    );
};
