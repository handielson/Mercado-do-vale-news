import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    BannerCarousel,
    ProductFilters,
    SearchBar,
    CategoryNav
} from '@/components/catalog';
import { CatalogFilters } from '@/components/catalog/CatalogFilters';
import { ProductGroupGrid } from '@/components/catalog/ProductGroupGrid';
import { PublicHeader } from '@/components/PublicHeader';
import { CatalogSectionComponent } from '@/components/catalog/CatalogSection';
import { FloatingCartButton } from '@/components/catalog/FloatingCartButton';
import { QuoteCartSidebar } from '@/components/catalog/QuoteCartSidebar';
import { useCatalog } from '@/hooks/useCatalog';

import { catalogSectionsService } from '@/services/catalogSectionsService';
import { groupProductsByVariants } from '@/services/productGrouping';
import type { CatalogProduct, ProductGroup } from '@/types/catalog';
import type { CatalogSection } from '@/types/catalogSections';
import { QuoteCartProvider } from '@/contexts/QuoteCartContext';
import { generateWhatsAppLink } from '@/utils/whatsappMessageGenerator';
import { useQuoteCart } from '@/contexts/QuoteCartContext';
import { ShareCatalogButton } from '@/components/catalog/ShareCatalogButton';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import type { CustomerType } from '@/services/bannerService';

function CatalogContent() {
    const [sections, setSections] = useState<CatalogSection[]>([]);
    const [sectionsLoading, setSectionsLoading] = useState(true);
    const [isCartOpen, setIsCartOpen] = useState(false);

    const { customer } = useSupabaseAuth();

    // Mapeia customer_type do banco (retail/wholesale/resale) → CustomerType do banner (varejo/revenda/atacado)
    const customerType = ((): CustomerType | undefined => {
        switch (customer?.customer_type) {
            case 'wholesale': return 'atacado';
            case 'resale': return 'revenda';
            case 'retail': return 'varejo';
            default: return undefined; // não logado → só banners públicos (target_audience vazio)
        }
    })();

    // Ler ?search= da URL para suportar links de produto compartilhados
    const [searchParams] = useSearchParams();
    const initialSearchQuery = searchParams.get('search') ?? '';

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
        pageSize: 12,
        initialSearchQuery
    });

    // Carregar seções ativas
    useEffect(() => {
        loadSections();
    }, []);

    const loadSections = async () => {
        try {
            setSectionsLoading(true);
            const data = await catalogSectionsService.getActiveSections();
            setSections(data);
        } catch (error) {
            console.error('Erro ao carregar seções:', error);
        } finally {
            setSectionsLoading(false);
        }
    };

    const handleShare = async (product: CatalogProduct) => {
        const productName = product.name;
        // Link com busca pré-preenchida para que o destinatário veja o produto direto
        const shareUrl = `${window.location.origin}/?search=${encodeURIComponent(productName)}`;

        // Web Share API (funciona em mobile e browsers modernos)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: productName,
                    text: product.description || productName,
                    url: shareUrl
                });
                return;
            } catch (_) {
                // Usuário cancelou ou erro — cai no fallback
            }
        }

        // Fallback: copiar link para área de transferência
        try {
            await navigator.clipboard.writeText(shareUrl);
            const { toast } = await import('sonner');
            toast.success('Link copiado!', { description: productName, duration: 2500 });
        } catch {
            window.prompt('Copie o link do produto:', shareUrl);
        }
    };

    // Group products by variants (Brand + Model + RAM + Storage)
    const productGroups = useMemo(() => {
        return groupProductsByVariants(products);
    }, [products]);

    // Handle send quote (will implement multi-product message in next phase)
    const handleSendQuote = async () => {
        // Placeholder - will implement in Phase 3
        alert('Funcionalidade de envio será implementada na próxima fase!');
        setIsCartOpen(false);
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
                    <BannerCarousel customerType={customerType} />
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
                categories={(filterStats?.categories || []).map(cat => ({
                    id: cat.id,
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
                                {loading ? 'Carregando...' : `${productGroups.length} ${productGroups.length === 1 ? 'variante encontrada' : 'variantes encontradas'}`}
                            </p>
                        </div>

                        {/* Share and View Controls */}
                        <div className="flex items-center gap-3">
                            {/* Share Catalog Button */}
                            <ShareCatalogButton />
                        </div>
                    </div>

                    {/* Barra de busca + Filtros na mesma linha */}
                    <div className="flex items-stretch gap-2">
                        <div className="flex-1">
                            <SearchBar
                                onSearch={setSearchQuery}
                                initialValue={searchQuery}
                                placeholder="Buscar por nome ou marca..."
                            />
                        </div>
                        <CatalogFilters
                            filters={filters}
                            onFiltersChange={setFilters}
                            filterStats={filterStats || { brands: [] }}
                        />
                    </div>
                </div>

                {/* Seções do Catálogo - ocultar quando há filtro de categoria ativo ou busca */}
                {!sectionsLoading && Array.isArray(sections) && sections.length > 0 && !filters.categories.length && !searchQuery && (
                    <div className="mb-12 space-y-12">
                        {sections.map((section) => (
                            <CatalogSectionComponent
                                key={section.id}
                                section={section}
                                onFavorite={toggleFavorite}
                                onShare={handleShare}
                                favorites={favorites}
                            />
                        ))}
                    </div>
                )}

                {/* Divisor */}
                {sections.length > 0 && !filters.categories.length && !searchQuery && (
                    <div className="mb-8">
                        <div className="border-t border-slate-200"></div>
                    </div>
                )}

                {/* Grid de produtos - Largura total */}
                <ProductGroupGrid
                    groups={productGroups}
                    loading={loading}
                    hasMore={hasMore}
                    onLoadMore={loadMore}
                    onFavorite={toggleFavorite}
                    onShare={handleShare}
                    favorites={favorites}
                    variant="grid"
                    columns={{
                        mobile: 1,
                        tablet: 2,
                        desktop: 3,
                        wide: 4
                    }}
                />
            </div>

            {/* Floating Cart Button */}
            <FloatingCartButton onClick={() => setIsCartOpen(true)} />

            {/* Cart Sidebar */}
            <QuoteCartSidebar
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                onSendQuote={handleSendQuote}
            />
        </div>
    );
}

export default function CatalogPage() {
    return (
        <QuoteCartProvider>
            <CatalogContent />
        </QuoteCartProvider>
    );
}
