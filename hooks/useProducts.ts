
import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types/product';
import { ProductStatus } from '../utils/field-standards';
import { productService } from '../services/products';
import { ProductFiltersState } from '../components/products/ProductFilters';

const CACHE_KEY = 'admin_products_cache';
const CACHE_TIMESTAMP_KEY = 'admin_products_cache_ts';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function loadFromCache(): Product[] | null {
    try {
        const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
        if (!ts) return null;
        const age = Date.now() - parseInt(ts, 10);
        if (age > CACHE_TTL_MS) return null;
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as Product[];
    } catch {
        return null;
    }
}

function saveToCache(products: Product[]) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(products));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
    } catch { /* quota cheia, ignora */ }
}

function getCacheAge(): string | null {
    try {
        const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
        if (!ts) return null;
        const diffMs = Date.now() - parseInt(ts, 10);
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'agora';
        return `há ${diffMin} min`;
    } catch {
        return null;
    }
}

/**
 * useProducts Hook
 * Manages product list state, loading, and client-side filtering.
 * Loads instantly from localStorage cache, then refreshes in background.
 */
export const useProducts = () => {
    const cached = loadFromCache();
    const [products, setProducts] = useState<Product[]>(cached || []);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>(cached || []);
    const [isLoading, setIsLoading] = useState(!cached); // só mostra loading se não tem cache
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cacheAge, setCacheAge] = useState<string | null>(getCacheAge);
    const [filters, setFilters] = useState<ProductFiltersState>({
        search: '',
        status: 'all',
        sortBy: 'newest'
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(24);

    /**
     * Fetch products from Supabase. forceRefresh = true shows spinner on the button.
     */
    const fetchProducts = useCallback(async (forceRefresh = false) => {
        try {
            if (forceRefresh) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }
            setError(null);
            const data = await productService.list();
            setProducts(data);
            setFilteredProducts(data);
            saveToCache(data);
            setCacheAge('agora');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar produtos');
            console.error('Error fetching products:', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    /**
     * Apply client-side filters
     */
    const applyFilters = useCallback(() => {
        let filtered = [...products];

        // Search filter (name or SKU)
        if (filters.search.trim() !== '') {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(product =>
                product.name.toLowerCase().includes(searchLower) ||
                product.sku.toLowerCase().includes(searchLower)
            );
        }

        // Status filter
        if (filters.status !== 'all') {
            filtered = filtered.filter(product => product.status === filters.status);
        }

        // Sorting
        filtered.sort((a, b) => {
            switch (filters.sortBy) {
                case 'newest':
                    return new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime();
                case 'oldest':
                    return new Date(a.created || 0).getTime() - new Date(b.created || 0).getTime();
                case 'name_asc':
                    return a.name.localeCompare(b.name);
                case 'name_desc':
                    return b.name.localeCompare(a.name);
                default:
                    return 0;
            }
        });

        setFilteredProducts(filtered);
        setCurrentPage(1); // Reset to first page when filters change
    }, [products, filters]);

    /**
     * Handle filter changes
     */
    const handleFilterChange = useCallback((newFilters: ProductFiltersState) => {
        setFilters(newFilters);
    }, []);

    /**
     * Force-refresh data from Supabase (used by the refresh button in the UI)
     */
    const refresh = useCallback(() => {
        fetchProducts(true);
    }, [fetchProducts]);

    /**
     * Refetch products (useful after create/update/delete)
     */
    const refetch = useCallback(() => {
        fetchProducts(false);
    }, [fetchProducts]);

    /**
     * Delete product
     */
    const deleteProduct = useCallback(async (id: string) => {
        try {
            await productService.delete(id);
            await refetch();
            return true;
        } catch (err) {
            console.error('Error deleting product:', err);
            setError(err instanceof Error ? err.message : 'Erro ao deletar produto');
            return false;
        }
    }, [refetch]);

    // Initial fetch: if we have cache, fetch in background silently; otherwise show spinner
    useEffect(() => {
        if (cached) {
            // Já tem dados em tela – atualiza silenciosamente em background
            fetchProducts(false);
        } else {
            fetchProducts(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Apply filters whenever they change
    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    // Calculate pagination
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return {
        products: paginatedProducts,
        allFilteredProducts: filteredProducts,
        allProducts: products,
        isLoading,
        isRefreshing,
        error,
        filters,
        handleFilterChange,
        refetch,
        refresh,
        deleteProduct,
        cacheAge,
        // Pagination exports
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        totalPages
    };
};
