import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { catalogService } from '@/services/catalogService';
import { catalogConfigService } from '@/services/catalogConfigService';
import type { CatalogProduct } from '@/types/catalog';
import type { FilterState } from '@/components/catalog';
import type { CatalogSettings } from '@/types/catalogSettings';
import { DEFAULT_CATALOG_SETTINGS } from '@/types/catalogSettings';


interface UseCatalogOptions {
    initialFilters?: Partial<FilterState>;
    initialSearchQuery?: string;
    initialCategory?: string;
    pageSize?: number;
    bypassCache?: boolean;
    customerId?: string;
}

const getGuestId = () => {
    if (typeof window === 'undefined') return 'guest_ssr';
    let id = localStorage.getItem('@mv:catalog_guest_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('@mv:catalog_guest_id', id);
    }
    return `guest_${id}`;
};

export function useCatalog(options: UseCatalogOptions = {}) {
    const {
        initialFilters = {},
        initialSearchQuery = '',
        initialCategory = '',
        pageSize = 12,
        bypassCache = false,
        customerId
    } = options;

    const effectiveCustomerId = useMemo(() => customerId || getGuestId(), [customerId]);

    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const [page, setPage] = useState(1);
    const pageRef = useRef(1); // Ref para leitura síncrona da página atual
    const [hasMore, setHasMore] = useState(true);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [catalogSettings, setCatalogSettings] = useState<CatalogSettings>(DEFAULT_CATALOG_SETTINGS as CatalogSettings);
    const [settingsLoading, setSettingsLoading] = useState(true);

    const initialCategoryIsUuid = initialCategory && /^[0-9a-f]{8}-/i.test(initialCategory);

    const [filters, setFilters] = useState<FilterState>({
        categories: initialCategoryIsUuid ? [initialCategory] : [],
        brands: [],
        priceRange: null,
        inStockOnly: false,
        featuredOnly: false,
        newOnly: false,
        sortBy: 'recent',
        ...initialFilters
    });

    // Carregar configurações do catálogo
    useEffect(() => {
        const loadSettings = async () => {
            try {
                setSettingsLoading(true);
                const settings = await catalogConfigService.getSettings();
                setCatalogSettings(settings);
            } catch (err) {
                console.error('Erro ao carregar configurações do catálogo:', err);
                // Usar configurações padrão em caso de erro
                setCatalogSettings(DEFAULT_CATALOG_SETTINGS as CatalogSettings);
            } finally {
                setSettingsLoading(false);
            }
        };

        loadSettings();
    }, []);

    // Aplicar regras de visibilidade aos produtos
    const applyVisibilityRules = useCallback((rawProducts: CatalogProduct[]) => {
        return catalogConfigService.applyVisibilityRules(rawProducts, catalogSettings);
    }, [catalogSettings]);

    // Carregar produtos
    const loadProducts = useCallback(async (reset = false, forcePage?: number) => {
        try {
            // Determina a página: reset volta p/ 1, forcePage sobreescreve, senão usa pageRef
            const currentPage = reset ? 1 : (forcePage ?? pageRef.current);

            console.log('[useCatalog] Loading products:', {
                reset,
                filters,
                searchQuery,
                currentPage
            });
            setLoading(true);
            setError(null);

            // Expand category to include its children automatically
            let expandedCategories = filters.categories;
            if (filters.categories && filters.categories.length === 1 && filterStats?.categories?.length > 0) {
                const selectedId = filters.categories[0];
                const childIds = filterStats.categories
                    .filter(c => c.parent_id === selectedId)
                    .map(c => c.id);
                if (childIds.length > 0) {
                    expandedCategories = [selectedId, ...childIds];
                }
            }

            const response = await catalogService.getProducts({
                search: searchQuery || undefined,
                categories: expandedCategories,
                brands: filters.brands,
                priceRange: filters.priceRange ? [filters.priceRange.min, filters.priceRange.max] : undefined,
                inStockOnly: filters.inStockOnly,
                featuredOnly: filters.featuredOnly,
                newOnly: filters.newOnly,
                favoritesOnly: filters.favoritesOnly,
                customerId: effectiveCustomerId,
                sortBy: filters.sortBy as 'recent' | 'price_asc' | 'price_desc' | 'featured' | undefined
            }, currentPage, pageSize, bypassCache);

            console.log('[useCatalog] Products loaded:', {
                count: response.products.length,
                hasMore: response.hasMore,
                total: response.total
            });

            // catalogService já aplica as regras de visibilidade em ambos os caminhos (VPS e Supabase).
            // NÃO reaplicar aqui para evitar dupla filtragem que elimina produtos válidos.
            console.log('[useCatalog] Products ready (visibility already applied by catalogService):', response.products.length);

            if (reset) {
                setProducts(response.products);
                setPage(1);
                pageRef.current = 1;
            } else {
                setProducts((prev) => [...prev, ...response.products]);
            }

            setHasMore(response.hasMore);
        } catch (err: any) {
            // Ignore abort errors - they're expected when requests are cancelled
            if (err.name === 'AbortError' || err.message === 'AbortError' || err.message?.includes('aborted')) {
                console.log('[useCatalog] Request was aborted (expected behavior)');
                return;
            }

            console.error('[useCatalog] Error loading products:', err);
            setError(err.message || 'Erro ao carregar produtos');
        } finally {
            setLoading(false);
        }
    }, [searchQuery, filters, pageSize, applyVisibilityRules, bypassCache]);

    // Recarregar quando filtros, busca ou configurações mudarem
    useEffect(() => {
        if (!settingsLoading) {
            loadProducts(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, filters, catalogSettings, settingsLoading]);

    // Carregar mais produtos
    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            const nextPage = pageRef.current + 1;
            pageRef.current = nextPage;
            setPage(nextPage);
            loadProducts(false, nextPage);
        }
    }, [loading, hasMore, loadProducts]);

    // Gerenciar favoritos
    const toggleFavorite = useCallback(async (productId: string) => {
        setFavorites((prev) => {
            const newFavorites = new Set(prev);
            const isFav = newFavorites.has(productId);
            
            if (isFav) {
                newFavorites.delete(productId);
                catalogService.removeFromFavorites(productId, effectiveCustomerId).catch(console.error);
            } else {
                newFavorites.add(productId);
                catalogService.addToFavorites(productId, effectiveCustomerId).catch(console.error);
            }
            return newFavorites;
        });
    }, [effectiveCustomerId]);

    // Carregar favoritos da VPS
    useEffect(() => {
        let mounted = true;
        const loadFavs = async () => {
            try {
                const favs = await catalogService.getUserFavorites(effectiveCustomerId);
                if (mounted) setFavorites(new Set(favs));
            } catch (err) {
                console.error('Erro ao carregar favoritos:', err);
            }
        };
        loadFavs();
        return () => { mounted = false; };
    }, [effectiveCustomerId]);

    // Estatísticas de filtros
    const [filterStats, setFilterStats] = useState<{
        categories: Array<{ id: string; name: string; parent_id?: string | null; count: number }>;
        brands: Array<{ name: string; count: number }>;
        priceRange?: { min: number; max: number };
    }>({
        categories: [],
        brands: []
    });

    // Carregar categorias e marcas reais com regras de visibilidade
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const { catalogMetadataService } = await import('@/services/catalogMetadataService');
                const [allCategories, brands, priceRange] = await Promise.all([
                    catalogMetadataService.getAllCategories(),
                    catalogMetadataService.getAllBrands(),
                    catalogMetadataService.getPriceRange()
                ]);

                // Aplicar regras de visibilidade às categorias (hide_empty_categories, hide_categories_no_stock)
                const filteredCategories = await catalogConfigService.applyCategoryVisibilityRules(
                    allCategories,
                    catalogSettings
                );

                setFilterStats({ categories: filteredCategories, brands, priceRange: priceRange ?? undefined });

                // Traduzir slug de categoria via URL para ID real
                if (initialCategory && !initialCategory.match(/^[0-9a-f]{8}-/i)) {
                    const matchedCat = filteredCategories.find(c => c.name.toLowerCase() === initialCategory.toLowerCase());
                    if (matchedCat) {
                        setFilters(prev => ({
                            ...prev,
                            categories: [matchedCat.id]
                        }));
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar metadados:', error);
            }
        };

        if (!settingsLoading) {
            loadMetadata();
        }
    }, [catalogSettings, settingsLoading]);


    return {
        products,
        loading: loading || settingsLoading,
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
        catalogSettings, // Expor configurações para uso nos componentes
    };
}
