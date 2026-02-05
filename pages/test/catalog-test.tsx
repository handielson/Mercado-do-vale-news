import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';

interface SimpleProduct {
    id: string;
    name: string;
    brand: string;
    price_retail: number;
    images: string[];
    featured: boolean;
    is_new: boolean;
    discount_percentage: number;
}

interface Banner {
    id: string;
    title: string;
    image_url: string;
    link_type: string;
    display_order: number;
    views_count: number;
    clicks_count: number;
}

function CatalogTestPage() {
    const [products, setProducts] = useState<SimpleProduct[]>([]);
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Buscar produtos diretamente do Supabase
            const { data: productsData, error: productsError } = await supabase
                .from('products')
                .select('id, name, brand, price_retail, images, featured, is_new, discount_percentage')
                .limit(10);

            if (productsError) throw productsError;

            // Buscar banners diretamente do Supabase
            const { data: bannersData, error: bannersError } = await supabase
                .from('catalog_banners')
                .select('*')
                .eq('is_active', true)
                .order('display_order');

            if (bannersError) throw bannersError;

            setProducts(productsData || []);
            setBanners(bannersData || []);

            console.log('✅ Produtos:', productsData);
            console.log('✅ Banners:', bannersData);
        } catch (err: any) {
            console.error('❌ Erro:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Carregando dados do catálogo...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 max-w-md">
                    <h2 className="text-red-800 font-bold text-lg mb-2">❌ Erro ao carregar</h2>
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={loadData}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                        Tentar novamente
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">🧪 Teste do Catálogo</h1>

                {/* Banners */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4">🎨 Banners ({banners.length})</h2>
                    {banners.length === 0 ? (
                        <p className="text-slate-500">Nenhum banner encontrado</p>
                    ) : (
                        <div className="space-y-3">
                            {banners.map(banner => (
                                <div key={banner.id} className="border border-slate-200 rounded-lg p-4">
                                    <div className="flex items-center gap-4">
                                        <img
                                            src={banner.image_url}
                                            alt={banner.title}
                                            className="w-32 h-20 object-cover rounded"
                                        />
                                        <div>
                                            <h3 className="font-semibold">{banner.title}</h3>
                                            <p className="text-sm text-slate-600">
                                                Tipo: {banner.link_type} | Ordem: {banner.display_order}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Views: {banner.views_count} | Clicks: {banner.clicks_count}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Produtos */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-xl font-bold mb-4">📱 Produtos ({products.length})</h2>
                    {products.length === 0 ? (
                        <p className="text-slate-500">Nenhum produto encontrado</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {products.map(product => (
                                <div key={product.id} className="border border-slate-200 rounded-lg p-4">
                                    {product.images && product.images[0] && (
                                        <img
                                            src={product.images[0]}
                                            alt={product.name}
                                            className="w-full h-40 object-cover rounded mb-3"
                                        />
                                    )}
                                    <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                                    <p className="text-xs text-slate-600 mb-2">{product.brand}</p>
                                    <p className="text-lg font-bold text-blue-600">
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL'
                                        }).format(product.price_retail / 100)}
                                    </p>
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                        {product.featured && (
                                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                                ⭐ Destaque
                                            </span>
                                        )}
                                        {product.is_new && (
                                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                                🆕 Novo
                                            </span>
                                        )}
                                        {product.discount_percentage && product.discount_percentage > 0 && (
                                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                                🏷️ {product.discount_percentage}% OFF
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Estatísticas */}
                <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-blue-900 mb-4">📊 Estatísticas</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-blue-600">{products.length}</div>
                            <div className="text-sm text-slate-600">Produtos</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-blue-600">{banners.length}</div>
                            <div className="text-sm text-slate-600">Banners</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-green-600">
                                {products.filter(p => p.featured).length}
                            </div>
                            <div className="text-sm text-slate-600">Em Destaque</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-green-600">
                                {products.filter(p => p.is_new).length}
                            </div>
                            <div className="text-sm text-slate-600">Novos</div>
                        </div>
                    </div>
                </div>

                {/* Botão de Recarregar */}
                <div className="mt-6 text-center">
                    <button
                        onClick={loadData}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                    >
                        🔄 Recarregar Dados
                    </button>
                </div>
            </div>
        </div>
    );
}

// Export sem layout
export default CatalogTestPage;
