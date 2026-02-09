import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, Grid, List, Search, Filter } from 'lucide-react';
import { useSupabaseAuth as useAuth } from '../../hooks/useSupabaseAuth';
import { catalogService } from '../../services/catalogService';
import type { CatalogProduct } from '../../types/catalog';
import { ModernProductCard } from '../../components/catalog/ModernProductCard';
import { ProductCard } from '../../components/catalog/ProductCard';

export const CustomerCatalogPage: React.FC = () => {
    const { user, customer, signOut } = useAuth();
    const navigate = useNavigate();

    // State
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [favorites, setFavorites] = useState<string[]>([]);

    // Redirect admins to admin dashboard
    useEffect(() => {
        if (customer?.customer_type === 'ADMIN') {
            navigate('/admin/dashboard', { replace: true });
        }
    }, [customer, navigate]);

    // Load products
    useEffect(() => {
        loadProducts();
        if (customer?.id) {
            loadFavorites();
        }
    }, [customer]);

    const loadProducts = async () => {
        try {
            setLoading(true);
            const result = await catalogService.getProducts({}, 1, 50);
            setProducts(result.products);
        } catch (error) {
            console.error('Error loading products:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadFavorites = async () => {
        if (!customer?.id) return;
        try {
            const favs = await catalogService.getUserFavorites(customer.id);
            setFavorites(favs.map(p => p.id));
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/cliente/login');
    };

    const handleFavorite = async (productId: string) => {
        if (!customer?.id) {
            alert('Faça login para adicionar aos favoritos');
            return;
        }

        try {
            const isFav = favorites.includes(productId);
            if (isFav) {
                await catalogService.removeFromFavorites(productId, customer.id);
                setFavorites(prev => prev.filter(id => id !== productId));
            } else {
                await catalogService.addToFavorites(productId, customer.id);
                setFavorites(prev => [...prev, productId]);
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    const handleShare = async (product: CatalogProduct) => {
        const text = `Confira este produto: ${product.name}\nPreço: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((product.price_retail || 0) / 100)}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: product.name,
                    text,
                    url: window.location.href
                });
            } catch (error) {
                console.log('Share cancelled');
            }
        } else {
            navigator.clipboard.writeText(text);
            alert('Link copiado para a área de transferência!');
        }
    };

    // Filter products by search
    const filteredProducts = products.filter(product => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            product.name.toLowerCase().includes(query) ||
            product.brand?.toLowerCase().includes(query) ||
            product.model?.toLowerCase().includes(query)
        );
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShoppingBag className="text-blue-600" size={32} />
                        <h1 className="text-2xl font-bold text-slate-800">Mercado do Vale</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-semibold text-slate-700">
                                {customer?.name || user?.user_metadata?.full_name || 'Cliente'}
                            </p>
                            <p className="text-xs text-slate-500">{user?.email}</p>
                        </div>
                        <button
                            onClick={() => navigate('/perfil')}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                        >
                            <User size={18} />
                            Meu Perfil
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <LogOut size={18} />
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Search and Filters */}
                <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar produtos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            title="Visualização em grade"
                        >
                            <Grid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'list'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            title="Visualização em lista"
                        >
                            <List size={20} />
                        </button>
                    </div>
                </div>

                {/* Products Grid/List */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-slate-600">Carregando produtos...</p>
                        </div>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-20">
                        <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-slate-700 mb-2">
                            {searchQuery ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                        </h3>
                        <p className="text-slate-500">
                            {searchQuery
                                ? 'Tente buscar com outros termos'
                                : 'Novos produtos serão adicionados em breve'}
                        </p>
                    </div>
                ) : (
                    <div
                        className={
                            viewMode === 'grid'
                                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                                : 'space-y-4'
                        }
                    >
                        {filteredProducts.map((product) => (
                            <ModernProductCard
                                key={product.id}
                                product={product}
                                onFavorite={handleFavorite}
                                onShare={handleShare}
                                isFavorite={favorites.includes(product.id)}
                            />
                        ))}
                    </div>
                )}

                {/* Product Count */}
                {!loading && filteredProducts.length > 0 && (
                    <div className="mt-8 text-center text-sm text-slate-600">
                        Mostrando {filteredProducts.length} {filteredProducts.length === 1 ? 'produto' : 'produtos'}
                    </div>
                )}
            </main>
        </div>
    );
};
