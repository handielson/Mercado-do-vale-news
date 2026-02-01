
import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types/product';
import { ProductStatus } from '../utils/field-standards';
import { productService } from '../services/products';
import { ProductFiltersState } from '../components/products/ProductFilters';

/**
 * useProducts Hook
 * Manages product list state, loading, and client-side filtering
 */
export const useProducts = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<ProductFiltersState>({
        search: '',
        status: 'all'
    });

    /**
     * Fetch products from service
     */
    const fetchProducts = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await productService.list();
            setProducts(data);
            setFilteredProducts(data); // Initially show all
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar produtos');
            console.error('Error fetching products:', err);
        } finally {
            setIsLoading(false);
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

        setFilteredProducts(filtered);
    }, [products, filters]);

    /**
     * Handle filter changes
     */
    const handleFilterChange = useCallback((newFilters: ProductFiltersState) => {
        setFilters(newFilters);
    }, []);

    /**
     * Refetch products (useful after create/update/delete)
     */
    const refetch = useCallback(() => {
        fetchProducts();
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

    // Initial fetch on mount
    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    // Apply filters whenever they change
    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    return {
        products: filteredProducts,
        allProducts: products,
        isLoading,
        error,
        filters,
        handleFilterChange,
        refetch,
        deleteProduct
    };
};
