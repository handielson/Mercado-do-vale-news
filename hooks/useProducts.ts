
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
        status: 'all',
        sortBy: 'newest'
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(24);

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
        error,
        filters,
        handleFilterChange,
        refetch,
        deleteProduct,
        // Pagination exports
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        totalPages
    };
};
