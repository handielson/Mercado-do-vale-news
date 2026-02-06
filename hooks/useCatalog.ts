import { useState, useEffect, useCallback, useMemo } from 'react';
import { catalogService } from '@/services/catalogService';
import type { CatalogProduct } from '@/types/catalog';
import type { FilterState } from '@/components/catalog';

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

    const [filters, setFilters] = useState<FilterState>({
        categories: [],
        brands: [],
        priceRange: null,
        inStockOnly: false,
        featuredOnly: false,
        newOnly: false,
        ...initialFilters
    });

    // Carregar produtos
    const loadProducts = useCallback(async (reset = false) => {
        try {
            setLoading(true);
            setError(null);

            const currentPage = reset ? 1 : page;

            const response = await catalogService.getProducts({
                search: searchQuery || undefined,
                categories: filters.categories,
                brands: filters.brands,
                priceRange: filters.priceRange ? [filters.priceRange.min, filters.priceRange.max] : undefined,
                inStockOnly: filters.inStockOnly,
                featuredOnly: filters.featuredOnly,
                newOnly: filters.newOnly
            }, currentPage, pageSize);

            if (reset) {
                setProducts(response.products);
                setPage(1);
            } else {
                setProducts((prev) => [...prev, ...response.products]);
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
    }, [searchQuery, filters, page, pageSize]);

    // Recarregar quando filtros ou busca mudarem
    useEffect(() => {
        loadProducts(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, filters]);

    // Carregar mais produtos
    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            setPage((prev) => prev + 1);
            loadProducts(false);
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

    // Carregar categorias e marcas reais
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const { catalogMetadataService } = await import('@/services/catalogMetadataService');
                const [categories, brands] = await Promise.all([
                    catalogMetadataService.getAllCategories(),
                    catalogMetadataService.getAllBrands()
                ]);

                setFilterStats({ categories, brands });
            } catch (error) {
                console.error('Erro ao carregar metadados:', error);
            }
        };

        loadMetadata();
    }, []);

    return {
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
    };
}
