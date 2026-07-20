import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { X, LayoutGrid, List, Heart, Search, MoreHorizontal } from 'lucide-react';
import {
    BannerCarousel,
    ProductFilters,
    SearchBar,
    CategoryNav,
    CheckinWidget
} from '@/components/catalog';
import { CatalogFilters } from '@/components/catalog/CatalogFilters';
import { ProductGroupGrid, ProductCardSkeleton } from '@/components/catalog/ProductGroupGrid';
import { PublicHeader } from '@/components/PublicHeader';
import { CatalogSectionComponent } from '@/components/catalog/CatalogSection';
import { FloatingCartButton } from '@/components/catalog/FloatingCartButton';
import { QuoteCartSidebar } from '@/components/catalog/QuoteCartSidebar';
import { FeedbackFloatingButton } from '@/components/catalog/FeedbackFloatingButton';
import { useCatalog } from '@/hooks/useCatalog';
import { promotionService, Promotion } from '@/services/promotionService';

import { catalogSectionsService } from '@/services/catalogSectionsService';
import { groupProductsByVariants } from '@/services/productGrouping';
import { getPublicCompanyData } from '@/services/publicCompanySettings';
import type { CatalogProduct, ProductGroup } from '@/types/catalog';
import type { CatalogSection } from '@/types/catalogSections';
import { QuoteCartProvider } from '@/contexts/QuoteCartContext';
import { generateWhatsAppLink } from '@/utils/whatsappMessageGenerator';
import { useQuoteCart } from '@/contexts/QuoteCartContext';
import { ShareCatalogButton } from '@/components/catalog/ShareCatalogButton';
import { useVpsAuth } from '@/contexts/VpsAuthContext';
import type { CustomerType } from '@/services/bannerService';
import { CartIcon } from '@/components/store/CartIcon';
import {
    buildCatalogPageHref,
    CATALOG_RETURN_STORAGE_KEY,
    getCatalogPageSlice,
    getCatalogPaginationPathname,
    needsCatalogPageData,
    normalizeCatalogPage,
    shouldRestoreCatalogState,
} from './catalogPagination.js';
import { mergeCategoryDisplayCounts } from './catalogCategoryCounts.js';
import {
    getCatalogCollectionByPathname,
    getCatalogCollectionFilters,
    getCatalogSeoConfig,
    getEnabledCatalogCollections,
} from './catalogCollections.js';

const CatalogSectionsLoadingSkeleton = () => (
    <div className="mb-12 space-y-12" aria-label="Secoes do catalogo carregando">
        <section className="py-8">
            <div className="flex items-center justify-between mb-6">
                <div className="animate-pulse">
                    <div className="h-7 bg-slate-200 rounded w-40" />
                    <div className="h-4 bg-slate-100 rounded w-64 max-w-full mt-2" />
                </div>
                <div className="h-5 bg-slate-100 rounded w-16 animate-pulse" />
            </div>
            <div className="grid gap-2 sm:gap-4 md:gap-6 grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <ProductCardSkeleton key={index} />
                ))}
            </div>
        </section>
    </div>
);


function CatalogContent() {
    const [sections, setSections] = useState<CatalogSection[]>([]);
    const [sectionsLoading, setSectionsLoading] = useState(true);

    const [footerText, setFooterText] = useState('');
    const [promoActive, setPromoActive] = useState(false);
    const [promoData, setPromoData] = useState<Promotion | null>(null);
    const [promoTimeLeft, setPromoTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);

    const { customer } = useVpsAuth();
    const [mobileView, setMobileView] = useState<'grid' | 'list'>('grid');
    const [autoDetectedBrand, setAutoDetectedBrand] = useState<string | null>(null);
    const [expandCats, setExpandCats] = useState(false);
    const [headerHeight, setHeaderHeight] = useState(56);

    // Mede a altura real do header para posicionar a sticky bar corretamente
    useEffect(() => {
        const header = document.querySelector('header');
        if (!header) return;
        const update = () => setHeaderHeight(header.offsetHeight);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(header);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const prefetchProductPage = () => {
            import('../store/PublicProductPage').catch(() => undefined);
        };

        if ('requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(prefetchProductPage, { timeout: 4000 });
            return () => window.cancelIdleCallback(idleId);
        }

        const timer = window.setTimeout(prefetchProductPage, 2500);
        return () => window.clearTimeout(timer);
    }, []);

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
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialSearchQuery = searchParams.get('search') ?? '';
    const initialCategory = searchParams.get('categoria') ?? undefined;
    const currentPage = normalizeCatalogPage(searchParams.get('page'));
    const isAllProductsPage = location.pathname === '/produtos';
    const activeCollection = getCatalogCollectionByPathname(location.pathname);
    const catalogSeo = getCatalogSeoConfig(activeCollection, location.pathname);
    const isCollectionPage = !!activeCollection;
    const isHomeCatalogPage = location.pathname === '/';
    const restoreScrollRef = useRef(false);

    // bypassCache fixo: nunca muda após a primeira renderização, evitando reload quando auth carrega
    // Usuários ADMIN que precisam bypassar cache devem recarregar a página manualmente
    const bypassCache = false;

    useEffect(() => {
        const syncCatalogHeadTags = () => {
            const descriptionTags = Array.from(document.querySelectorAll('meta[name="description"]'));
            const [descriptionTag, ...duplicateDescriptions] = descriptionTags;
            if (descriptionTag instanceof HTMLMetaElement) {
                descriptionTag.content = catalogSeo.description;
            }
            duplicateDescriptions.forEach(tag => {
                if (tag.parentNode) {
                    tag.parentNode.removeChild(tag);
                }
            });

            const canonicalTags = Array.from(document.querySelectorAll('link[rel="canonical"]'));
            const [canonicalTag, ...duplicateCanonicals] = canonicalTags;
            if (canonicalTag instanceof HTMLLinkElement) {
                canonicalTag.href = catalogSeo.canonical;
            }
            duplicateCanonicals.forEach(tag => {
                if (tag.parentNode) {
                    tag.parentNode.removeChild(tag);
                }
            });
        };

        syncCatalogHeadTags();
        const frameId = window.requestAnimationFrame(syncCatalogHeadTags);
        const timeoutId = window.setTimeout(syncCatalogHeadTags, 100);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.clearTimeout(timeoutId);
        };
    }, [catalogSeo.canonical, catalogSeo.description]);

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
        initialFilters: getCatalogCollectionFilters(activeCollection),
        initialSearchQuery,
        initialCategory,
        bypassCache
    });

    // Sincronizar a busca do estado com a URL para permitir compartilhamento do link de busca
    // e resetar a paginação quando o termo muda.
    useEffect(() => {
        setSearchParams(prevParams => {
            const newParams = new URLSearchParams(prevParams);
            const currentSearch = newParams.get('search') ?? '';
            const newSearch = searchQuery.trim();
            let changed = false;
            
            if (currentSearch !== newSearch) {
               if (newSearch) {
                   newParams.set('search', newSearch);
               } else {
                   newParams.delete('search');
               }
               newParams.delete('page');
               changed = true;
            }
            return changed ? newParams : prevParams;
        }, { replace: true });
    }, [searchQuery, setSearchParams]);

    const productsPerPage = catalogSettings?.products_per_page || 12;

    // Carregar seções ativas
    useEffect(() => {
        loadSections();
        getPublicCompanyData().then(c => {
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

    const syncCategoryUrl = useCallback((categoryIds: string[]) => {
        setSearchParams(prevParams => {
            const nextParams = new URLSearchParams(prevParams);
            const firstId = categoryIds[0];

            if (firstId) {
                const categoryMetadata = filterStats?.categories.find(category => category.id === firstId);
                nextParams.set('categoria', categoryMetadata ? categoryMetadata.name : firstId);
            } else {
                nextParams.delete('categoria');
            }

            nextParams.delete('page');
            return nextParams;
        }, { replace: true });
    }, [filterStats?.categories, setSearchParams]);

    const hasActiveSearch = searchQuery.trim().length > 0;

    // Group products by variants (Brand + Model + RAM + Storage)
    // A vitrine publica deve mostrar apenas grupos com produtos vendaveis em estoque.
    const productGroups = useMemo(() => {
        const groups = groupProductsByVariants(products, false);
        return groups;
    }, [products]);

    const categoryNavCategories = useMemo(() => {
        const baseCategories = filterStats?.categories || [];
        if (!baseCategories.length || hasMore || loading || fetching) {
            return baseCategories;
        }

        const selectedIds = filters.categories;
        return mergeCategoryDisplayCounts(
            baseCategories,
            productGroups,
            selectedIds.length > 0 ? { onlyCategoryIds: selectedIds } : undefined,
        );
    }, [fetching, filterStats?.categories, filters.categories, hasMore, loading, productGroups]);

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

    // Melhoria 2 — Detecção visual de marca na busca (chip informativo, sem alterar filters.brands)
    // Nota: NÃO adicionamos ao filters.brands pois o filtro client-side de marca no catalogService
    // é case-sensitive e p.brand pode ser null, quebrando a busca. A busca textual já inclui p.brand.
    useEffect(() => {
        if (!filterStats?.brands?.length) return;
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            if (autoDetectedBrand) setAutoDetectedBrand(null);
            return;
        }
        const knownBrands = filterStats.brands.map(b => b.name);
        const matched = knownBrands.find(name => name.toLowerCase() === query) ?? null;
        if (matched !== autoDetectedBrand) setAutoDetectedBrand(matched);
    }, [searchQuery, filterStats, autoDetectedBrand]);

    // Melhoria 1 — Agrupar resultados de busca por categoria (mín. 3 produtos por categoria)
    const searchCategorySections = useMemo(() => {
        if (!hasActiveSearch || filters.categories.length > 0) return [];

        const catList = filterStats?.categories || [];
        const catMap = new Map(catList.map(c => [c.id!, c.name]));

        const catGroupMap = new Map<string, typeof productGroups>();
        for (const group of productGroups) {
            const catId = group.representativeProduct.category_id;
            if (!catId) continue;
            if (!catGroupMap.has(catId)) catGroupMap.set(catId, []);
            catGroupMap.get(catId)!.push(group);
        }

        return Array.from(catGroupMap.entries())
            .filter(([, groups]) => groups.length >= 3)
            .map(([catId, groups]) => ({
                categoryId: catId,
                categoryName: catMap.get(catId) || 'Categoria',
                groups,
            }));
    }, [hasActiveSearch, filters.categories, productGroups, filterStats?.categories]);

    // Ativa agrupamento quando há busca ativa, sem filtro de categoria e 2+ seções com 3+ itens
    const isSearchCategoryMode = hasActiveSearch && !filters.categories.length && searchCategorySections.length >= 2;
    const isPaginatedCatalogMode = !isAllChildrenMode && !isSearchCategoryMode;
    const catalogPageSlice = useMemo(() => {
        return getCatalogPageSlice(productGroups, currentPage, productsPerPage);
    }, [productGroups, currentPage, productsPerPage]);

    const visibleGroups = useMemo(() => {
        return isPaginatedCatalogMode ? catalogPageSlice.items : [];
    }, [catalogPageSlice.items, isPaginatedCatalogMode]);

    const needsMoreGroupsForPage = isPaginatedCatalogMode && needsCatalogPageData({
        loadedGroupCount: productGroups.length,
        currentPage,
        pageSize: productsPerPage,
        hasMore,
        loading: loading || fetching,
    });

    const hasPreviousPage = currentPage > 1;
    const hasNextPage = isPaginatedCatalogMode && (
        hasMore || catalogPageSlice.endIndex < productGroups.length
    );
    const knownPageCount = Math.max(1, Math.ceil(productGroups.length / productsPerPage) || 1);
    const lastPageForNavigation = hasNextPage ? Math.max(knownPageCount, currentPage + 1) : knownPageCount;
    const paginationPages = useMemo(() => {
        const pages = new Set<number>([1, currentPage - 1, currentPage, currentPage + 1, lastPageForNavigation]);
        return Array.from(pages)
            .filter(page => page >= 1 && page <= lastPageForNavigation)
            .sort((left, right) => left - right);
    }, [currentPage, lastPageForNavigation]);
    const showPagination = isPaginatedCatalogMode && (hasPreviousPage || hasNextPage || paginationPages.length > 1);
    const isCatalogGridLoading = (loading && productGroups.length === 0) || needsMoreGroupsForPage;
    const isAllProductsListing = !filters.categories.length && !hasActiveSearch;
    const showDesktopCategoryNav = !hasActiveSearch;
    const paginationPathname = getCatalogPaginationPathname({
        pathname: location.pathname,
        isAllProducts: isAllProductsListing && !isCollectionPage,
    });

    useEffect(() => {
        if (!needsMoreGroupsForPage) return;
        loadMore();
    }, [needsMoreGroupsForPage, loadMore]);

    useEffect(() => {
        if (!isAllProductsPage || needsMoreGroupsForPage || loading || fetching || restoreScrollRef.current) {
            return;
        }

        if (typeof window === 'undefined') return;

        const rawSavedState = window.sessionStorage.getItem(CATALOG_RETURN_STORAGE_KEY);
        if (rawSavedState) {
            try {
                const savedState = JSON.parse(rawSavedState);
                if (shouldRestoreCatalogState(savedState, {
                    pathname: location.pathname,
                    search: location.search,
                })) {
                    return;
                }
            } catch {
                window.sessionStorage.removeItem(CATALOG_RETURN_STORAGE_KEY);
            }
        }

        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: 'auto' });
        });
    }, [
        currentPage,
        fetching,
        isAllProductsPage,
        loading,
        location.pathname,
        location.search,
        needsMoreGroupsForPage,
    ]);

    useEffect(() => {
        restoreScrollRef.current = false;
    }, [location.pathname, location.search]);

    useEffect(() => {
        if (!isPaginatedCatalogMode || needsMoreGroupsForPage || loading || fetching || restoreScrollRef.current) {
            return;
        }

        if (typeof window === 'undefined') return;

        const rawSavedState = window.sessionStorage.getItem(CATALOG_RETURN_STORAGE_KEY);
        if (!rawSavedState) return;

        try {
            const savedState = JSON.parse(rawSavedState);
            if (!shouldRestoreCatalogState(savedState, {
                pathname: location.pathname,
                search: location.search,
            })) {
                return;
            }

            restoreScrollRef.current = true;
            window.sessionStorage.removeItem(CATALOG_RETURN_STORAGE_KEY);
            window.requestAnimationFrame(() => {
                window.scrollTo({ top: savedState.scrollY || 0, behavior: 'auto' });
            });
        } catch {
            window.sessionStorage.removeItem(CATALOG_RETURN_STORAGE_KEY);
        }
    }, [
        fetching,
        isPaginatedCatalogMode,
        loading,
        location.pathname,
        location.search,
        needsMoreGroupsForPage,
    ]);


    if (error) {

        return (
            <div className="min-h-screen bg-slate-50">
                <PublicHeader />
                <main className="flex items-center justify-center p-4 min-h-[calc(100vh-64px)]">
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 max-w-md">
                        <h2 className="text-red-800 font-bold text-lg mb-2">❌ Erro ao carregar catálogo</h2>
                        <p className="text-red-600">{error}</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* SEO — Helmet injeta title/meta na <head> para crawlers */}
            <Helmet>
                <title>{catalogSeo.title}</title>
                <meta name="description" content={catalogSeo.description} />
                <link rel="canonical" href={catalogSeo.canonical} />
                <meta property="og:title" content={catalogSeo.ogTitle} />
                <meta property="og:description" content={catalogSeo.ogDescription} />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={catalogSeo.canonical} />
            </Helmet>

            {/* h1 invisível ao usuário mas visível para crawlers (SEO) */}
            <h1 className="sr-only">{catalogSeo.heading}</h1>

            {/* Public Header */}
            <PublicHeader />

            <main>
            {/* Mobile Sticky Search Bar + Categories Dropdown */}
            <div className="sm:hidden sticky z-40" style={{ top: headerHeight }}>
                {/* Barra de busca */}
                <div className="bg-white border-b border-slate-200 shadow-sm px-3 py-2 flex items-center gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar por nome, marca ou EAN..."
                            className="w-full pl-9 pr-8 py-2 text-sm bg-slate-100 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                                aria-label="Limpar busca"
                            >
                                <X className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setExpandCats(v => !v)}
                        className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all shrink-0 ${
                            expandCats
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title="Ver categorias"
                        aria-label="Categorias"
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                </div>

                {/* Dropdown de categorias (Mobile Tree) */}
                {expandCats && (
                    <div className="bg-white border-b border-slate-200 shadow-lg px-3 py-3 max-h-[70vh] overflow-y-auto overscroll-contain">
                        <div className="flex flex-col gap-2">
                            {/* Botão TODOS */}
                            <button
                                onClick={() => {
                                    setFilters({ ...filters, categories: [] });
                                    syncCategoryUrl([]);
                                    navigate('/produtos');
                                    setExpandCats(false);
                                }}
                                className={`flex items-center gap-3 py-3 px-4 rounded-xl border transition-all ${
                                    filters.categories.length === 0
                                        ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                <span className="text-xl">🏠</span>
                                <span className="text-xs sm:text-sm font-bold uppercase tracking-wide">Todos os Produtos</span>
                            </button>

                            {(filterStats?.categories || []).filter(c => !c.parent_id).map(cat => {
                                const children = (filterStats?.categories || []).filter(c => c.parent_id === cat.id);
                                const isRootActive = filters.categories.includes(cat.id!);
                                const hasActiveChild = children.some(c => filters.categories.includes(c.id!));
                                const isActiveBlock = isRootActive || hasActiveChild;

                                return (
                                    <div key={cat.id} className={`flex flex-col rounded-xl border overflow-hidden transition-all ${isActiveBlock ? 'border-slate-300 shadow-sm' : 'border-slate-100'}`}>
                                        {/* Categoria Pai */}
                                        <button
                                            onClick={() => {
                                                const ids = children.length > 0 ? [cat.id!, ...children.map(c => c.id!)] : [cat.id!];
                                                setFilters({ ...filters, categories: ids });
                                                syncCategoryUrl(ids);
                                                setExpandCats(false);
                                            }}
                                            className={`flex items-center gap-3 py-2.5 px-3 transition-all ${
                                                isActiveBlock
                                                    ? 'bg-slate-100/80 text-slate-900'
                                                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span className="text-lg opacity-80">📦</span>
                                            <span className="text-xs sm:text-sm font-bold uppercase tracking-wide flex-1 text-left line-clamp-1">{cat.name}</span>
                                            {cat.count > 0 && (
                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-full">{cat.count}</span>
                                            )}
                                        </button>

                                        {/* Subcategorias (Filhos em Grid) */}
                                        {children.length > 0 && (
                                            <div className="grid grid-cols-2 gap-px bg-slate-200/50 border-t border-slate-100">
                                                {children.map(child => {
                                                    const isChildActive = filters.categories.includes(child.id!);
                                                    return (
                                                        <button
                                                            key={child.id}
                                                            onClick={() => {
                                                                const ids = [child.id!];
                                                                setFilters({ ...filters, categories: ids });
                                                                syncCategoryUrl(ids);
                                                                setExpandCats(false);
                                                            }}
                                                            className={`flex items-center justify-between py-2 px-3 bg-white transition-all ${
                                                                isChildActive ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-600 hover:bg-slate-50'
                                                            }`}
                                                        >
                                                            <span className="text-[10px] uppercase font-semibold tracking-wide truncate pr-1">{child.name}</span>
                                                            {child.count > 0 && (
                                                                <span className={`text-[9px] font-bold px-1.5 rounded-full ${isChildActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                                    {child.count}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {isHomeCatalogPage && (
                <>
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
                </>
            )}

            {/* Category Navigation - oculto no mobile (coberto pelo dropdown da sticky bar) */}
            {showDesktopCategoryNav && (
                <div className="hidden sm:block min-h-[190px]">
                    <CategoryNav
                        activeCategory={filters.categories[0] || null}
                        activeCategoryIds={filters.categories}
                        onCategoryChange={(categoryId) => {
                            const ids = Array.isArray(categoryId)
                                ? categoryId
                                : categoryId ? [categoryId] : [];

                            if (ids.length === 0) {
                                setFilters({
                                    ...filters,
                                    categories: []
                                });
                                syncCategoryUrl([]);
                                navigate('/produtos');
                                return;
                            }

                            setFilters({
                                ...filters,
                                categories: ids
                            });

                            syncCategoryUrl(ids);
                        }}
                        categories={categoryNavCategories.map(cat => ({
                            id: cat.id,
                            name: cat.name,
                            parent_id: cat.parent_id,
                            count: cat.count
                        }))}
                    />
                </div>
            )}

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
                    {/* Barra de busca + Filtros + Toggle de colunas + Compartilhar */}
                    <div className="flex items-stretch gap-2">
                        {/* Busca — escondida no mobile (coberta pela sticky bar acima) */}
                        <div className="hidden sm:flex flex-1 relative">
                            <SearchBar
                                onSearch={setSearchQuery}
                                initialValue={searchQuery}
                                placeholder="Buscar por nome, marca ou EAN..."
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
                        <ShareCatalogButton categoryId={filters.categories[0] || undefined} />
                    </div>

                    <nav
                        aria-label="Colecoes de produtos"
                        className="mt-4 flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        <Link
                            to="/produtos"
                            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                                !isCollectionPage && isAllProductsPage
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            Todos os Produtos
                        </Link>
                        {getEnabledCatalogCollections().map((collection) => (
                            <Link
                                key={collection.key}
                                to={collection.path}
                                className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                                    activeCollection?.key === collection.key
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                {collection.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Chips de Filtros Ativos Renderizados na Raiz */}
                    {(filters.brands.length > 0 || (filters.sortBy && filters.sortBy !== 'recent') || filters.priceRange || filters.favoritesOnly || autoDetectedBrand) && (
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

                            {/* Chip de Marca Auto-Detectada */}
                            {autoDetectedBrand && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 shadow-sm text-blue-700 rounded-full text-xs font-medium">
                                    🏷️ Marca: {autoDetectedBrand}
                                    <button
                                        onClick={() => { setAutoDetectedBrand(null); setSearchQuery(''); }}
                                        className="hover:text-red-500 transition-colors focus:outline-none"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            )}

                            {/* Chips de Marcas (filtros manuais do painel) */}
                            {filters.brands.map(b => (
                                <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 shadow-sm text-slate-700 rounded-full text-xs font-medium hover:border-slate-300 transition-colors">
                                    {b}
                                    <button
                                        onClick={() => setFilters({ ...filters, brands: filters.brands.filter(brand => brand !== b) })}
                                        className="hover:text-red-500 transition-colors focus:outline-none"
                                    >
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
                {isHomeCatalogPage && sectionsLoading && !filters.categories.length && !hasActiveSearch && (
                    <CatalogSectionsLoadingSkeleton />
                )}

                {isHomeCatalogPage && !sectionsLoading && Array.isArray(sections) && sections.length > 0 && !filters.categories.length && !hasActiveSearch && (
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

                {!filters.categories.length && !hasActiveSearch && (
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">{catalogSeo.heading}</h2>
                        {isCollectionPage && catalogSeo.intro && (
                            <p className="mt-2 max-w-3xl text-sm text-slate-600">{catalogSeo.intro}</p>
                        )}
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
                                    priorityImageCount={1}
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
                ) : isSearchCategoryMode ? (
                    /* Modo Busca: produtos agrupados por categoria */
                    <div className="space-y-12">
                        {searchCategorySections.map(section => (
                            <div key={section.categoryId} className="relative">
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
                                    loading={false}
                                    hasMore={false}
                                    onLoadMore={() => {}}
                                    onFavorite={toggleFavorite}
                                    onShare={handleShare}
                                    favorites={favorites}
                                    mobileColumns={2}
                                    variant={mobileView === 'list' ? 'list' : 'grid'}
                                    priorityImageCount={1}
                                    columns={{ mobile: 2, tablet: 3, desktop: 4, wide: 5 }}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <ProductGroupGrid
                            groups={visibleGroups}
                            loading={isCatalogGridLoading}
                            hasMore={false}
                            onFavorite={toggleFavorite}
                            onShare={handleShare}
                            favorites={favorites}
                            mobileColumns={2}
                            variant={mobileView === 'list' ? 'list' : 'grid'}
                            priorityImageCount={isAllProductsListing ? 1 : 0}
                            columns={{
                                mobile: 2,
                                tablet: 3,
                                desktop: 4,
                                wide: 5
                            }}
                        />

                        {showPagination && (
                            <nav
                                aria-label="Paginação dos produtos"
                                className="mt-8 flex flex-wrap items-center justify-center gap-2"
                            >
                                {hasPreviousPage && (
                                    <Link
                                        to={buildCatalogPageHref({
                                            pathname: paginationPathname,
                                            searchParams,
                                            page: 1,
                                        })}
                                        aria-label="Primeira pagina"
                                        title="Primeira pagina"
                                        className="min-w-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-center font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                                    >
                                        &lt;&lt;
                                    </Link>
                                )}

                                {hasPreviousPage && (
                                    <Link
                                        to={buildCatalogPageHref({
                                            pathname: paginationPathname,
                                            searchParams,
                                            page: currentPage - 1,
                                        })}
                                        className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:border-slate-300 hover:bg-slate-50 transition-colors"
                                    >
                                        Anterior
                                    </Link>
                                )}

                                {paginationPages.map((pageNumber, index) => {
                                    const previousPage = paginationPages[index - 1];
                                    const hasGapBefore = previousPage && pageNumber - previousPage > 1;

                                    return (
                                        <div key={`page-slot-${pageNumber}`} className="flex items-center gap-2">
                                            {hasGapBefore && (
                                                <span className="px-1 text-slate-400" aria-hidden="true">
                                                    ...
                                                </span>
                                            )}
                                            <Link
                                                to={buildCatalogPageHref({
                                                    pathname: paginationPathname,
                                                    searchParams,
                                                    page: pageNumber,
                                                })}
                                                aria-current={pageNumber === currentPage ? 'page' : undefined}
                                                className={`min-w-[44px] px-4 py-2 rounded-xl border text-center font-semibold transition-colors ${
                                                    pageNumber === currentPage
                                                        ? 'border-slate-900 bg-slate-900 text-white'
                                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                {pageNumber}
                                            </Link>
                                        </div>
                                    );
                                })}

                                {hasNextPage && (
                                    <Link
                                        to={buildCatalogPageHref({
                                            pathname: paginationPathname,
                                            searchParams,
                                            page: currentPage + 1,
                                        })}
                                        className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:border-slate-300 hover:bg-slate-50 transition-colors"
                                    >
                                        Próxima
                                    </Link>
                                )}

                                {hasNextPage && (
                                    <Link
                                        to={buildCatalogPageHref({
                                            pathname: paginationPathname,
                                            searchParams,
                                            page: lastPageForNavigation,
                                        })}
                                        aria-label="Ultima pagina"
                                        title="Ultima pagina"
                                        className="min-w-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-center font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                                    >
                                        &gt;&gt;
                                    </Link>
                                )}
                            </nav>
                        )}
                    </>
                )}
            </div>
            </main>

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
    const location = useLocation();

    return (
        <QuoteCartProvider>
            <CatalogContent key={location.pathname} />
        </QuoteCartProvider>
    );
}
