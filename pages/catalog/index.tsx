import { useState } from 'react';
import { Grid, List } from 'lucide-react';
import {
    BannerCarousel,
    ProductGrid,
    ProductFilters,
    SearchBar,
    CategoryNav
} from '@/components/catalog';
import { PublicHeader } from '@/components/PublicHeader';
import { useCatalog } from '@/hooks/useCatalog';
import { catalogShareService } from '@/services/catalogShareService';
import type { CatalogProduct } from '@/types/catalog';

export default function CatalogPage() {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const {
        products,
        loading,
        error,
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        favorites,
        toggleFavorite,
        loadMore,
        hasMore,
        filterStats
    } = useCatalog({
        pageSize: 12
    });

    const handleShare = async (product: CatalogProduct) => {
        try {
            const shareUrl = await catalogShareService.shareProduct(product.id, 'whatsapp');

            // Abrir WhatsApp
            window.open(shareUrl, '_blank');
        } catch (error) {
            console.error('Erro ao compartilhar:', error);
            alert('Erro ao compartilhar produto');
        }
    };

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50">
                <PublicHeader />
                <div className="flex items-center justify-center p-4 min-h-[calc(100vh-64px)]">
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 max-w-md">
                        <h2 className="text-red-800 font-bold text-lg mb-2">❌ Erro ao carregar catálogo</h2>
                        <p className="text-red-600">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Public Header */}
            <PublicHeader />

            {/* Banner Carousel */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <BannerCarousel />
                </div>
            </div>

            {/* Category Navigation - NOVO */}
            <CategoryNav
                activeCategory={filters.categories[0] || null}
                onCategoryChange={(categoryId) => {
                    setFilters({
                        ...filters,
                        categories: categoryId ? [categoryId] : []
                    });
                }}
                categories={filterStats.categories.map(cat => ({
                    name: cat.name,
                    count: cat.count
                }))}
            />

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header com busca e controles */}
                <div className="mb-6">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 mb-2">
                                Catálogo de Produtos
                            </h1>
                            <p className="text-slate-600">
                                {loading ? 'Carregando...' : `${products.length} produtos encontrados`}
                            </p>
                        </div>

                        {/* Controles de visualização */}
                        <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded transition-colors ${viewMode === 'grid'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                title="Visualização em grade"
                            >
                                <Grid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded transition-colors ${viewMode === 'list'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                title="Visualização em lista"
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Barra de busca */}
                    <SearchBar
                        onSearch={setSearchQuery}
                        initialValue={searchQuery}
                        placeholder="Buscar por nome, marca ou modelo..."
                    />
                </div>

                {/* Grid de produtos - Largura total */}
                <ProductGrid
                    products={products}
                    loading={loading}
                    hasMore={hasMore}
                    onLoadMore={loadMore}
                    onFavorite={toggleFavorite}
                    onShare={handleShare}
                    favorites={favorites}
                    variant={viewMode}
                    columns={{
                        mobile: 1,
                        tablet: 2,
                        desktop: 3,
                        wide: 4
                    }}
                />
            </div>
        </div>
    );
}
