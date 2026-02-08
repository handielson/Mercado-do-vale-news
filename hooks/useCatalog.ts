import { useState, useEffect, useCallback, useMemo } from 'react';
import { catalogService } from '@/services/catalogService';
import { catalogConfigService } from '@/services/catalogConfigService';
import type { CatalogProduct } from '@/types/catalog';
import type { FilterState } from '@/components/catalog';
import type { CatalogSettings } from '@/types/catalogSettings';
import { DEFAULT_CATALOG_SETTINGS } from '@/types/catalogSettings';


interface UseCatalogOptions {
    initialFilters?: Partial<FilterState>;
    pageSize?: number;
}

export function useCatalog(options: UseCatalogOptions = {}) {
    const { initialFilters = {}, pageSize = 12 } = options;

    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [catalogSettings, setCatalogSettings] = useState<CatalogSettings>(DEFAULT_CATALOG_SETTINGS as CatalogSettings);
    const [settingsLoading, setSettingsLoading] = useState(true);

    const [filters, setFilters] = useState<FilterState>({
        categories: [],
        brands: [],
        priceRange: null,
        inStockOnly: false,
        featuredOnly: false,
        newOnly: false,
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
    const loadProducts = useCallback(async (reset = false) => {
        try {
            setLoading(true);
            setError(null);

            // Use functional update to get current page without dependency
            let currentPage = 1;
            if (!reset) {
                setPage((prev) => {
                    currentPage = prev;
                    return prev;
                });
            }

            const response = await catalogService.getProducts({
                search: searchQuery || undefined,
                categories: filters.categories,
                brands: filters.brands,
                priceRange: filters.priceRange ? [filters.priceRange.min, filters.priceRange.max] : undefined,
                inStockOnly: filters.inStockOnly,
                featuredOnly: filters.featuredOnly,
                newOnly: filters.newOnly
            }, currentPage, pageSize);

            // Aplicar regras de visibilidade
            const filteredProducts = applyVisibilityRules(response.products);

            if (reset) {
                setProducts(filteredProducts);
                setPage(1);
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

            console.error('Erro ao carregar produtos:', err);
            setError(err.message || 'Erro ao carregar produtos');
        } finally {
            setLoading(false);
        }
    }, [searchQuery, filters, pageSize, applyVisibilityRules]); // Removed 'page' from dependencies

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
            setPage((prev) => prev + 1);
            // Wait for next render to call loadProducts with updated page
            setTimeout(() => loadProducts(false), 0);
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
    }>({
        categories: [],
        brands: []
    });

    // Carregar categorias e marcas reais com regras de visibilidade
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const { catalogMetadataService } = await import('@/services/catalogMetadataService');
                const [categories, brands] = await Promise.all([
                    catalogMetadataService.getAllCategories(),
                    catalogMetadataService.getAllBrands()
                ]);

                // Aplicar regras de visibilidade às categorias
                const filteredCategories = await catalogConfigService.applyCategoryVisibilityRules(
                    categories,
                    catalogSettings
                );

                setFilterStats({ categories: filteredCategories, brands });
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
