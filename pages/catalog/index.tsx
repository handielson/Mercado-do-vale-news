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
import { FeedbackFloatingButton } from '@/components/catalog/FeedbackFloatingButton';
import { useCatalog } from '@/hooks/useCatalog';
import { promotionService, Promotion } from '@/services/promotionService';

import { catalogSectionsService } from '@/services/catalogSectionsService';
import { groupProductsByVariants } from '@/services/productGrouping';
import { getCompanyData } from '@/services/companyService';
import type { CatalogProduct, ProductGroup } from '@/types/catalog';
import type { CatalogSection } from '@/types/catalogSections';
import { QuoteCartProvider } from '@/contexts/QuoteCartContext';
import { generateWhatsAppLink } from '@/utils/whatsappMessageGenerator';
import { useQuoteCart } from '@/contexts/QuoteCartContext';
import { ShareCatalogButton } from '@/components/catalog/ShareCatalogButton';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import type { CustomerType } from '@/services/bannerService';
import { CartIcon } from '@/components/store/CartIcon';


function CatalogContent() {
    const [sections, setSections] = useState<CatalogSection[]>([]);
    const [sectionsLoading, setSectionsLoading] = useState(true);

    const [footerText, setFooterText] = useState('');
    const [promoActive, setPromoActive] = useState(false);
    const [promoData, setPromoData] = useState<Promotion | null>(null);
    const [promoTimeLeft, setPromoTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);

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

    // Ler ?search= e ?categoria= da URL para suportar links compartilhados e botões de atalho
    const [searchParams] = useSearchParams();
    const initialSearchQuery = searchParams.get('search') ?? '';
    const initialCategory = searchParams.get('categoria') ?? undefined;

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
        initialSearchQuery,
        initialCategory,
        bypassCache: customer?.customer_type === 'ADMIN'
    });

    // Carregar seções ativas
    useEffect(() => {
        loadSections();
        getCompanyData().then(c => {
            if (c.catalogFooterText) setFooterText(c.catalogFooterText);
        }).catch(() => { });

        promotionService.getPromotionStatus('one_year_screen_protector')
            .then(res => {
                setPromoActive(res.isActive);
                setPromoData(res.promotion);
            }).catch(() => { });
    }, []);

    // Timer regressivo para promoções programadas ou com data de fim
    useEffect(() => {
        if (!promoActive || !promoData || !promoData.end_date) {
            setPromoTimeLeft(null);
            return;
        }

        const endDate = new Date(promoData.end_date).getTime();

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const distance = endDate - now;

            if (distance < 0) {
                clearInterval(timer);
                setPromoActive(false); // Desativa automaticamente na tela se der o tempo
                setPromoTimeLeft(null);
                return;
            }

            setPromoTimeLeft({
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((distance % (1000 * 60)) / 1000)
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [promoActive, promoData]);

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

    const isAdmin = customer?.customer_type === 'ADMIN';

    // Group products by variants (Brand + Model + RAM + Storage)
    // Pass includeOutOfStock=true for admin so zero-stock SKUs still get grouped
    const productGroups = useMemo(() => {
        return groupProductsByVariants(products, isAdmin);
    }, [products, isAdmin]);


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

            {/* Promo Banner Global */}
            {promoData && promoActive && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
                    <div className="rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-blue-500/20">
                        <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        <div className="relative z-10 flex-1 text-center md:text-left flex flex-col md:flex-row items-center justify-between w-full">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black mb-2 flex items-center justify-center md:justify-start gap-2">
                                    🛡️ {promoData.title}
                                </h2>
                                <a
                                    href="/promocoes/pelicula-gratis"
                                    className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white text-sm underline underline-offset-2 transition-colors"
                                >
                                    Ver condições e regulamento →
                                </a>
                            </div>

                            {/* Contador */}
                            {promoTimeLeft && (
                                <div className="mt-4 md:mt-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-md border border-white/10 rounded-xl px-6 py-3 shrink-0">
                                    <span className="text-xs uppercase tracking-widest text-blue-200 mb-1 font-semibold">Oferta Expira Em</span>
                                    <div className="flex items-center gap-2 text-white font-mono text-xl font-bold">
                                        <div className="flex flex-col items-center">
                                            <span>{promoTimeLeft.days.toString().padStart(2, '0')}</span>
                                            <span className="text-[9px] text-blue-300">DIAS</span>
                                        </div>
                                        <span className="text-blue-400/50 -mt-3">:</span>
                                        <div className="flex flex-col items-center">
                                            <span>{promoTimeLeft.hours.toString().padStart(2, '0')}</span>
                                            <span className="text-[9px] text-blue-300">HRS</span>
                                        </div>
                                        <span className="text-blue-400/50 -mt-3">:</span>
                                        <div className="flex flex-col items-center">
                                            <span>{promoTimeLeft.minutes.toString().padStart(2, '0')}</span>
                                            <span className="text-[9px] text-blue-300">MIN</span>
                                        </div>
                                        <span className="text-blue-400/50 -mt-3">:</span>
                                        <div className="flex flex-col items-center">
                                            <span>{promoTimeLeft.seconds.toString().padStart(2, '0')}</span>
                                            <span className="text-[9px] text-blue-300">SEG</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header com busca e controles */}
                <div className="mb-6">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
                        <div>
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

                {!filters.categories.length && !searchQuery && (
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Todos os Produtos</h2>
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

            {/* Carrinho de Compras Online */}
            <CartIcon />

            {/* Feedback Button */}
            <FeedbackFloatingButton />


            {/* Rodapé do Catálogo */}
            {footerText && (
                <footer className="border-t border-slate-200 bg-white mt-4">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 text-center">
                        <p className="text-xs text-slate-400">{footerText}</p>
                    </div>
                </footer>
            )}
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
