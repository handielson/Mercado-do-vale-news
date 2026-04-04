import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { X, LayoutGrid, List, Heart } from 'lucide-react';
import {
    BannerCarousel,
    ProductFilters,
    SearchBar,
    CategoryNav,
    CheckinWidget
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
    const [mobileView, setMobileView] = useState<'grid' | 'list'>('grid');

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
    const [searchParams, setSearchParams] = useSearchParams();
    const initialSearchQuery = searchParams.get('search') ?? '';
    const initialCategory = searchParams.get('categoria') ?? undefined;

    // bypassCache fixo: nunca muda após a primeira renderização, evitando reload quando auth carrega
    // Usuários ADMIN que precisam bypassar cache devem recarregar a página manualmente
    const bypassCache = false;

    const {
        products,
        loading,
        fetching,
        error,
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        favorites,
        toggleFavorite,
        loadMore,
        hasMore,
        filterStats,
        catalogSettings
    } = useCatalog({
        pageSize: 150, // Alto, pois ao agrupar os cards, 150 produtos brutos podem virar apenas 10 ou 15 cards únicos
        initialSearchQuery,
        initialCategory,
        bypassCache
    });

    const productsPerPage = catalogSettings?.products_per_page || 12;
    const [visibleCount, setVisibleCount] = useState(productsPerPage);

    // Quando o catalogSettings carrega ou muda, ajusta o count inicial
    useEffect(() => {
        setVisibleCount(productsPerPage);
    }, [productsPerPage]);

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
            console.log('[DEBUG] Sections loaded:', data);
        } catch (error: any) {
            if (error.code !== '20' && error.name !== 'AbortError' && !error.message?.includes('aborted')) {
                console.error('Erro ao carregar seções:', error);
            }
        } finally {
            setSectionsLoading(false);
        }
    };

    const handleShare = async (product: CatalogProduct) => {
        const productName = product.name;
        // Link direto SEO
        const shareUrl = `${window.location.origin}/produto/${product.slug || product.id}`;

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
        const groups = groupProductsByVariants(products, isAdmin);
        return groups;
    }, [products, isAdmin]);


    const visibleGroups = useMemo(() => {
        return productGroups.slice(0, visibleCount);
    }, [productGroups, visibleCount]);

    // Modo "Todos" — múltiplas categorias selecionadas (pai + filhos)
    const isAllChildrenMode = filters.categories.length > 1;

    // Agrupar productGroups por subcategoria para o modo Seções
    const categorySections = useMemo(() => {
        if (!isAllChildrenMode) return [];

        const catList = filterStats?.categories || [];
        const catMap = new Map(catList.map(c => [c.id!, c.name]));

        return filters.categories
            .map(catId => ({
                categoryId: catId,
                categoryName: catMap.get(catId) || 'Categoria',
                groups: productGroups.filter(g =>
                    g.representativeProduct.category_id === catId
                )
            }))
            .filter(s => s.groups.length > 0);
    }, [isAllChildrenMode, filters.categories, productGroups, filterStats]);

    const actualHasMore = hasMore || visibleCount < productGroups.length;

    const handleLoadMore = useCallback(() => {
        if (visibleCount < productGroups.length) {
            // Mostrar mais do que já foi carregado
            setVisibleCount(prev => prev + productsPerPage);
        } else {
            // Se já mostramos todos os grupos da memória, buscar mais
            loadMore();
            setVisibleCount(prev => prev + productsPerPage);
        }
    }, [visibleCount, productGroups.length, productsPerPage, loadMore]);


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

            {/* Check-in Widget + Atalho de Favoritos */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 flex items-center justify-between gap-2 relative z-10 flex-nowrap">

                {/* Atalho de Favoritos — só para clientes autenticados (não-admin) */}
                {customer ? (
                    <Link
                        to="/favoritos"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:scale-105 active:scale-95 rounded-full text-sm font-semibold shadow-sm transition-all duration-200"
                    >
                        <Heart size={15} fill="currentColor" />
                        <span className="hidden sm:inline">Meus Favoritos</span>
                        <span className="sm:hidden">Favoritos</span>
                        {favorites.size > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                {favorites.size}
                            </span>
                        )}
                    </Link>
                ) : (
                    <div />
                )}

                <div className="min-w-0 shrink">
                    <CheckinWidget />
                </div>
            </div>

            {/* Category Navigation - NOVO */}
            <CategoryNav
                activeCategory={filters.categories[0] || null}
                activeCategoryIds={filters.categories}
                onCategoryChange={(categoryId) => {
                    const ids = Array.isArray(categoryId)
                        ? categoryId
                        : categoryId ? [categoryId] : [];

                    setFilters({
                        ...filters,
                        categories: ids
                    });
                    
                    const newParams = new URLSearchParams(searchParams);
                    const firstId = ids[0];
                    if (firstId) {
                        // Tentar usar o nome legível na URL se achado, senão o ID
                        const catMetadata = filterStats?.categories.find(c => c.id === firstId);
                        newParams.set('categoria', catMetadata ? catMetadata.name : firstId);
                    } else {
                        newParams.delete('categoria');
                    }
                    setSearchParams(newParams, { replace: true });
                }}
                categories={(filterStats?.categories || []).map(cat => ({
                    id: cat.id,
                    name: cat.name,
                    parent_id: cat.parent_id,
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
                            <ShareCatalogButton categoryId={filters.categories[0] || undefined} />
                        </div>
                    </div>

                    {/* Barra de busca + Filtros + Toggle de colunas */}
                    <div className="flex items-stretch gap-2">
                        <div className="flex-1 relative">
                            <SearchBar
                                onSearch={setSearchQuery}
                                initialValue={searchQuery}
                                placeholder="Buscar por nome ou marca..."
                            />
                            {/* Indicador sutil de busca em progresso */}
                            {fetching && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-100 overflow-hidden rounded-full">
                                    <div className="h-full bg-blue-500 animate-[shimmer_1s_ease-in-out_infinite]" style={{width: '40%', animation: 'slide 1s ease-in-out infinite'}} />
                                </div>
                            )}
                        </div>
                        {/* Toggle mobile grade/lista — só no mobile */}
                        <button
                            className="sm:hidden flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition-all shrink-0"
                            onClick={() => setMobileView(v => v === 'grid' ? 'list' : 'grid')}
                            title={mobileView === 'grid' ? 'Ver em lista' : 'Ver em grade'}
                            aria-label="Alternar visualização"
                        >
                            {mobileView === 'grid'
                                ? <List className="w-4 h-4" />
                                : <LayoutGrid className="w-4 h-4" />}
                        </button>
                        <CatalogFilters
                            filters={filters}
                            onFiltersChange={setFilters}
                            filterStats={filterStats || { brands: [] }}
                        />
                    </div>

                    {/* Chips de Filtros Ativos Renderizados na Raiz */}
                    {(filters.brands.length > 0 || (filters.sortBy && filters.sortBy !== 'recent') || filters.priceRange || filters.favoritesOnly) && (
                        <div className="flex flex-wrap gap-2 mt-4 items-center animate-in fade-in slide-in-from-top-2 duration-300">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mr-1">Filtros Ativos:</span>
                            
                            {/* Chip de Favoritos */}
                            {filters.favoritesOnly && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 shadow-sm text-red-700 rounded-full text-xs font-medium">
                                    ❤️ Meus Favoritos
                                    <button onClick={() => setFilters({ ...filters, favoritesOnly: false })} className="hover:text-red-900 transition-colors focus:outline-none">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            )}

                            {/* Chip de Ordem */}
                            {filters.sortBy && filters.sortBy !== 'recent' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-200 shadow-sm text-blue-700 rounded-full text-xs font-medium">
                                    {{
                                        'price_asc': '💰 Menor preço',
                                        'price_desc': '💎 Maior preço',
                                        'featured': '⭐ Destaques'
                                    }[filters.sortBy] || filters.sortBy}
                                    <button onClick={() => setFilters({ ...filters, sortBy: 'recent' })} className="hover:text-red-500 transition-colors focus:outline-none">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            )}

                            {/* Chips de Marcas */}
                            {filters.brands.map(b => (
                                <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 shadow-sm text-slate-700 rounded-full text-xs font-medium hover:border-slate-300 transition-colors">
                                    {b}
                                    <button onClick={() => setFilters({ ...filters, brands: filters.brands.filter(brand => brand !== b) })} className="hover:text-red-500 transition-colors focus:outline-none">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            ))}

                            {/* Botão de limpar tudo caso haja muitos filtros */}
                            {(filters.brands.length > 1 || (filters.brands.length > 0 && filters.favoritesOnly)) && (
                                <button 
                                    onClick={() => setFilters({ ...filters, brands: [], favoritesOnly: false, sortBy: 'recent' })}
                                    className="text-[11px] font-semibold text-slate-400 hover:text-red-500 ml-1 transition-colors uppercase tracking-widest"
                                >
                                    Limpar Tudo
                                </button>
                            )}
                        </div>
                    )}
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
                                mobileView={mobileView}
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
                {isAllChildrenMode ? (
                    /* Modo Todos: seções por subcategoria */
                    <div className="space-y-12">
                        {categorySections.length === 0 && !loading && (
                            <div className="text-center py-16 text-slate-400">
                                <p className="text-lg font-medium">Nenhum produto encontrado</p>
                            </div>
                        )}
                        {categorySections.map(section => (
                            <div key={section.categoryId} className="relative">
                                {/* Divisor com título da subcategoria */}
                                <div className="flex items-center gap-3 mb-6">
                                    <h2 className="text-xl font-bold text-slate-800">
                                        {section.categoryName}
                                    </h2>
                                    <span className="text-sm text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                                        {section.groups.length} {section.groups.length === 1 ? 'item' : 'itens'}
                                    </span>
                                    <div className="flex-1 h-px bg-slate-200" />
                                </div>
                                <ProductGroupGrid
                                    groups={section.groups}
                                    loading={loading && section.groups.length === 0}
                                    hasMore={false}
                                    onLoadMore={() => {}}
                                    onFavorite={toggleFavorite}
                                    onShare={handleShare}
                                    favorites={favorites}
                                    mobileColumns={2}
                                    variant={mobileView === 'list' ? 'list' : 'grid'}
                                    columns={{
                                        mobile: 2,
                                        tablet: 3,
                                        desktop: 4,
                                        wide: 5
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <ProductGroupGrid
                        groups={visibleGroups}
                        loading={loading && productGroups.length === 0}
                        hasMore={actualHasMore}
                        onLoadMore={handleLoadMore}
                        onFavorite={toggleFavorite}
                        onShare={handleShare}
                        favorites={favorites}
                        mobileColumns={2}
                        variant={mobileView === 'list' ? 'list' : 'grid'}
                        columns={{
                            mobile: 2,
                            tablet: 3,
                            desktop: 4,
                            wide: 5
                        }}
                    />
                )}
            </div>

            {/* Carrinho de Compras Online */}
            <CartIcon />

            {/* Feedback Button */}
            <FeedbackFloatingButton />


            {/* Rodapé do Catálogo */}
            {footerText && (
                <footer className="border-t border-slate-200 bg-white mt-4">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <p className="text-xs text-slate-400 text-center md:text-left flex-1">{footerText}</p>
                            
                            <div className="flex gap-4">
                                <a href="/quem-somos" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
                                    Quem Somos
                                </a>
                            </div>
                        </div>
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
