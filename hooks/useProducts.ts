
import { useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '../types/product';
import { ProductStatus } from '../utils/field-standards';
import { productService } from '../services/products';
import { vpsApiService } from '../services/vpsApiService';
import { shopeeProductService } from '../services/shopeeProducts';
import { unitService } from '../services/units';
import { ProductFiltersState } from '../components/products/ProductFilters';
import { prefetchModelImages } from '../services/modelImageCache';
import { filterAdminProducts, mergeProductsById } from './adminProductFilters';

/** Converte resposta do VPS MySQL para o tipo Product */
function mapVpsProduct(row: any): Product {
    return {
        id: row.id,
        model_id: row.model_id || undefined,
        model: '',
        category_id: row.category_id || undefined,
        brand: row.brand || undefined,
        name: row.name,
        sku: row.sku || '',
        description: row.description || undefined,
        eans: Array.isArray(row.alternative_eans) && row.alternative_eans.length
            ? row.alternative_eans
            : (row.ean ? [row.ean] : []),
        specs: row.specs || {},
        price_cost: row.price_cost ?? undefined,
        price_retail: row.price_retail ?? undefined,
        price_reseller: row.price_reseller ?? undefined,
        price_wholesale: row.price_wholesale ?? undefined,
        stock_quantity: row.stock !== undefined ? row.stock : (row.stock_quantity || 0),
        images: (() => {
            const imgs = row.images;
            if (!imgs) return [];
            if (Array.isArray(imgs)) return imgs;
            if (typeof imgs === 'string') {
                try { return JSON.parse(imgs) as string[]; } catch { return []; }
            }
            return [];
        })(),
        status: row.status || ProductStatus.ACTIVE,
        track_inventory: Boolean(row.track_inventory),
        is_gift: Boolean(row.is_gift),
        warranty_type: row.warranty_type || 'brand',
        warranty_template_id: row.warranty_template_id || undefined,
        parent_id: row.parent_id || undefined,
        is_parent: Number(row.is_parent) === 1,
        bling_id: row.bling_id || undefined,
        bling_parent_id: row.bling_parent_id || undefined,
        shopee_item_id: row.shopee_item_id || undefined,
        video_url: row.video_url || undefined,
        price_promo: row.price_promo ?? undefined,
        promo_start: row.promo_start || undefined,
        promo_end: row.promo_end || undefined,
        slug: row.slug || undefined,
        origin: row.origin || undefined,
        exclude_from_seo: Boolean(row.exclude_from_seo),
        created: row.created_at,
        updated: row.updated_at,
    };
}

async function enrichProductsWithShopeeLinks(products: Product[]): Promise<Product[]> {
    if (products.length === 0) return products;

    try {
        const shopeeItemByProductId = await shopeeProductService.getItemIdByProductIdMap();

        if (shopeeItemByProductId.size === 0) return products;

        return products.map((product) => ({
            ...product,
            shopee_item_id: shopeeItemByProductId.get(String(product.id)) ?? product.shopee_item_id,
        }));
    } catch (error) {
        console.warn('[useProducts] Falha ao carregar vinculos da Shopee:', error);
        return products;
    }
}

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

async function fetchAllAdminVpsProducts(): Promise<any[] | null> {
    const pageSize = 500;
    const rows: any[] = [];

    for (let offset = 0; ; offset += pageSize) {
        const page = await vpsApiService.getProducts({
            status: 'all',
            limit: pageSize,
            offset,
            compact: true,
            noCache: true,
        });

        if (!page) {
            if (offset === 0) return null;
            console.warn('[useProducts] VPS interrompida ao paginar produtos no offset:', offset);
            break;
        }

        rows.push(...page);
        if (page.length < pageSize) break;
    }

    return rows;
}

/**
 * useProducts Hook
 * Manages product list state, loading, and client-side filtering.
 * Loads instantly from localStorage cache, then refreshes in background.
 */
export const useProducts = () => {
    const searchRequestSeq = useRef(0);
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
        sortBy: 'newest',
        imageStatus: 'all',
        parentVisibility: 'hide_parents',
        brand: 'all',
        categoryId: 'all',
        shopeeStatus: 'all',
        videoStatus: 'all',
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(24);

    /**
     * Fetch products from VPS.
     * mode='spinner'    → mostra isLoading (sem cache, primeiro acesso)
     * mode='background' → silencioso, dados já estão na tela via cache
     * mode='refresh'    → mostra isRefreshing (botão de atualizar clicado)
     */
    const fetchProducts = useCallback(async (mode: 'spinner' | 'background' | 'refresh' = 'spinner') => {
        try {
            if (mode === 'spinner') setIsLoading(true);
            if (mode === 'refresh') setIsRefreshing(true);
            setError(null);

            // VPS MySQL primeiro — fallback VPS se a primeira página falhar.
            let data: Product[];
            const vpsData = await fetchAllAdminVpsProducts();
            if (vpsData) {
                data = await enrichProductsWithShopeeLinks(vpsData.map(mapVpsProduct));
                console.log(`[useProducts] VPS: ${data.length} produtos`);
            } else {
                console.warn('[useProducts] VPS indisponível — usando VPS');
                data = await productService.list();
            }

            setProducts(data);
            setFilteredProducts(data);
            saveToCache(data);
            setCacheAge('agora');

            // Pré-aquece cache de imagens
            const modelIds = data
                .filter(p => p.model_id && (!p.images || p.images.length === 0))
                .map(p => p.model_id!);
            if (modelIds.length > 0) prefetchModelImages(modelIds).catch(() => {});
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
        setFilteredProducts(filterAdminProducts(products, filters));
        setCurrentPage(1); // Reset to first page when filters change
    }, [products, filters]);

    /**
     * Handle filter changes
     */
    const handleFilterChange = useCallback((newFilters: ProductFiltersState) => {
        setFilters(newFilters);
    }, []);

    /**
     * Force-refresh data (used by the refresh button in the UI)
     */
    const refresh = useCallback(() => {
        fetchProducts('refresh');
    }, [fetchProducts]);

    /**
     * Refetch products (useful after create/update/delete)
     */
    const refetch = useCallback(() => {
        fetchProducts('spinner');
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

    // Initial fetch: se tem cache → background silencioso; senão → spinner
    useEffect(() => {
        const hasCachedData = loadFromCache() !== null;
        fetchProducts(hasCachedData ? 'background' : 'spinner');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Enrich search results from the VPS so records created after the cached
    // list was loaded are still discoverable.
    useEffect(() => {
        const term = filters.search.trim();
        if (term.length < 2) return;

        const requestId = ++searchRequestSeq.current;
        const looksLikeSku = /^[a-z0-9._-]+$/i.test(term);

        Promise.all([
            vpsApiService.getProducts({ search: term, status: 'all', limit: 500, noCache: true }),
            looksLikeSku
                ? vpsApiService.getProducts({ sku: term, status: 'all', limit: 5, noCache: true })
                : Promise.resolve(null),
            unitService.searchByIdentifier(term)
                .then(async units => {
                    const productIds = [...new Set(units.map(unit => unit.product_id).filter(Boolean))];
                    const productRows = productIds.length > 0 ? await vpsApiService.getProductsByIds(productIds) : null;
                    return { productRows, units };
                }),
        ])
            .then(async ([searchRows, skuRows, unitSearchResult]) => {
                if (requestId !== searchRequestSeq.current) return;
                const unitsByProductId = new Map<string, typeof unitSearchResult.units>();
                for (const unit of unitSearchResult.units) {
                    const productId = String(unit.product_id || '');
                    if (!productId) continue;
                    const currentUnits = unitsByProductId.get(productId) || [];
                    currentUnits.push(unit);
                    unitsByProductId.set(productId, currentUnits);
                }

                const unitProducts = (unitSearchResult.productRows || []).map(row => {
                    const product = mapVpsProduct(row);
                    const matchedUnits = unitsByProductId.get(String(product.id)) || [];
                    return {
                        ...product,
                        available_units: [...((product as any).available_units || []), ...matchedUnits],
                    };
                });

                const remoteProducts = await enrichProductsWithShopeeLinks([
                    ...(searchRows || []),
                    ...(skuRows || []),
                    ...unitProducts,
                ].map(row => (row && 'available_units' in row ? row as Product : mapVpsProduct(row))));
                if (remoteProducts.length === 0) return;

                setProducts(current => {
                    const merged = mergeProductsById(current, remoteProducts);
                    saveToCache(merged);
                    return merged;
                });
                setCacheAge('agora');
            })
            .catch(error => {
                if (requestId === searchRequestSeq.current) {
                    console.warn('[useProducts] Falha ao enriquecer busca na VPS:', error);
                }
            });
    }, [filters.search]);

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
