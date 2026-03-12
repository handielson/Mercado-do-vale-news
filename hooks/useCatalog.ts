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
}

export function useCatalog(options: UseCatalogOptions = {}) {
    const {
        initialFilters = {},
        initialSearchQuery = '',
        initialCategory = '',
        pageSize = 12,
        bypassCache = false
    } = options;

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

    const [filters, setFilters] = useState<FilterState>({
        categories: initialCategory ? [initialCategory] : [],
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

            const response = await catalogService.getProducts({
                search: searchQuery || undefined,
                categories: filters.categories,
                brands: filters.brands,
                priceRange: filters.priceRange ? [filters.priceRange.min, filters.priceRange.max] : undefined,
                inStockOnly: filters.inStockOnly,
                featuredOnly: filters.featuredOnly,
                newOnly: filters.newOnly,
                sortBy: filters.sortBy as 'recent' | 'price_asc' | 'price_desc' | 'featured' | undefined
            }, currentPage, pageSize, bypassCache);

            console.log('[useCatalog] Products loaded:', {
                count: response.products.length,
                hasMore: response.hasMore,
                total: response.total
            });

            // Aplicar regras de visibilidade
            const filteredProducts = applyVisibilityRules(response.products);

            console.log('[useCatalog] After visibility rules:', {
                originalCount: response.products.length,
                filteredCount: filteredProducts.length
            });

            if (reset) {
                setProducts(filteredProducts);
                setPage(1);
                pageRef.current = 1;
            } else {
                setProducts((prev) => [...prev, ...filteredProducts]);
            }

            setHasMore(response.hasMore);
        } catch (err: any) {
            // Ignore abort errors - they're expected when requests are cancelled
            if (err.name === 'AbortError') {
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
    const toggleFavorite = useCallback((productId: string) => {
        setFavorites((prev) => {
            const newFavorites = new Set(prev);
            if (newFavorites.has(productId)) {
                newFavorites.delete(productId);
            } else {
                newFavorites.add(productId);
            }
            // Salvar no localStorage
            localStorage.setItem('catalog_favorites', JSON.stringify(Array.from(newFavorites)));
            return newFavorites;
        });
    }, []);

    // Carregar favoritos do localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('catalog_favorites');
            if (saved) {
                setFavorites(new Set(JSON.parse(saved)));
            }
        } catch (err) {
            console.error('Erro ao carregar favoritos:', err);
        }
    }, []);

    // Estatísticas de filtros
    const [filterStats, setFilterStats] = useState<{
        categories: Array<{ id: string; name: string; count: number }>;
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
