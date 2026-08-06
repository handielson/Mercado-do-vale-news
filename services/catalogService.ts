import { buildAuthHeaders } from './authSession';
import type { CatalogProduct } from '@/types/catalog';
import { vpsApiService } from '@/services/vpsApiService';
import { normalizeProduct } from '@/services/productNormalizer';
import { catalogConfigService } from '@/services/catalogConfigService';
import { buildVpsUrl, getVpsSyncHeaders } from '@/services/vpsProxyBase';
import { vpsClient } from '@/services/vpsClient';
import type { CatalogSettings } from '@/types/catalogSettings';
import { filterBySelectedCategories } from './catalogFiltering';
import { colorService } from './colors';
import { modelColorImagesService } from './model-color-images';


// Persistent Cache (Stale-While-Revalidate pattern)
const CACHE_TTL = 30 * 1000; // 30 segundos (evita cache obsoleto prolongado na UI)
const CACHE_KEY_PREFIX = '@mv:catalog:v8:';

// Helper to safely access localStorage (prevents SSR errors)
const getStorage = () => typeof window !== 'undefined' ? window.localStorage : null;

const removeHiddenOffers = <T extends Record<string, any>>(products: T[]): T[] =>
    products.filter(product => !product.offer_type || product.offer_visibility !== 'hidden');

const removeHiddenCatalogProducts = <T extends Record<string, any>>(products: T[]): T[] =>
    products.filter(product => !product.hide_from_catalog);

export const catalogService = {
    _lastVpsRaw: null as any,
    _lastMappedResult: null as any[] | null,
    /**
     * Buscar produtos do catálogo com filtros
     */
    getProducts: async (
        filters?: {
            search?: string;
            categories?: string[];
            brands?: string[];
            priceRange?: [number, number];
            inStockOnly?: boolean;
            featuredOnly?: boolean;
            newOnly?: boolean;
            favoritesOnly?: boolean;
            customerId?: string;
            sortBy?: 'recent' | 'price_asc' | 'price_desc' | 'featured';
        },
        page: number = 1,
        pageSize: number = 20,
        bypassCache: boolean = false,
        settingsOverride?: CatalogSettings
    ): Promise<{ products: CatalogProduct[], total: number, hasMore: boolean }> => {
        const cacheKey = `${CACHE_KEY_PREFIX}products:${JSON.stringify({ filters, page, pageSize })}`;

        // ── Busca com termo: vai direto ao VPS (server-side) ──────────────────
        // Isso resolve o problema de limit: 1000 esconder produtos além da 1000ª posição.
        // O VPS busca em TODOS os produtos do banco (nome, sku, ean, etc.).
        const searchTerm = filters?.search?.trim() || '';
        if (searchTerm) {
            // EAN puro (8-14 dígitos) → endpoint dedicado /products/by-ean
            if (/^\d{8,14}$/.test(searchTerm)) {
                const byEan = await vpsApiService.getProductByEan(searchTerm);
                if (byEan && byEan.length > 0) {
                    const settings = await catalogConfigService.getSettings();
                    let mapped = removeHiddenCatalogProducts(removeHiddenOffers(byEan.map(normalizeProduct))) as unknown as CatalogProduct[];
                    mapped = catalogConfigService.applyVisibilityRules(mapped, settings) as unknown as CatalogProduct[];
                    return { products: mapped, total: mapped.length, hasMore: false };
                }
                return { products: [], total: 0, hasMore: false };
            }

            // Busca por texto → VPS server-side search (sem limite de 1000)
            const [vpsRaw, vpsCats, settings] = await Promise.all([
                vpsApiService.getProducts({ search: searchTerm, status: 'active', limit: 500, noCache: true }),
                vpsApiService.getCategories(),
                settingsOverride ? Promise.resolve(settingsOverride) : catalogConfigService.getSettings(),
            ]);

            if (!vpsRaw) return { products: [], total: 0, hasMore: false };

            const catSlugMap = new Map<string, string>(
                (vpsCats || []).map((c: any) => [c.id, c.slug])
            );

            let result = removeHiddenCatalogProducts(removeHiddenOffers(vpsRaw)).map((p: any) => ({
                ...normalizeProduct(p),
                category_slug: p.category_id ? catSlugMap.get(p.category_id) : undefined,
            })) as unknown as CatalogProduct[];

            result = catalogConfigService.applyVisibilityRules(result as any, settings) as unknown as CatalogProduct[];
            result = filterBySelectedCategories(result, filters?.categories);

            const from = (page - 1) * pageSize;
            const paginated = result.slice(from, from + pageSize);
            return { products: paginated, total: result.length, hasMore: paginated.length === pageSize };
        }

        // Helper para salvar no cache
        const saveToCache = (products: any[], total: number, hasMore: boolean) => {
            if (filters?.search) return; // Buscas não são cacheadas
            const storage = getStorage();
            if (!storage) return;
            try {
                storage.setItem(cacheKey, JSON.stringify({ data: products, total, hasMore, timestamp: Date.now() }));
            } catch (e) {
                // quota exceeded — ignora silenciosamente
            }
        };

        // Helper para buscar da VPS
        const fetchFromVps = async () => {
            let vpsRaw: any = null;
            let vpsCats: any[] = [];
            const useCompactPayload = true;

            // Depois da migracao de base64 para URLs HTTP na VPS, o payload compacto
            // volta a ser suficiente para os cards do catalogo.
            if (filters?.categories && filters.categories.length > 0 && !filters?.search) {
                [vpsCats, vpsRaw] = await Promise.all([
                    vpsApiService.getCategories(),
                    vpsApiService.getProducts({
                        category: filters.categories.join(','),
                        favoritesOnly: filters?.favoritesOnly,
                        customerId: filters?.customerId,
                        limit: 2000,
                        compact: useCompactPayload,
                    }),
                ]);
            } else {
                [vpsCats, vpsRaw] = await Promise.all([
                    vpsApiService.getCategories(),
                    vpsApiService.getProducts({
                        favoritesOnly: filters?.favoritesOnly,
                        customerId: filters?.customerId,
                        limit: 1000,
                        compact: useCompactPayload,
                    }),
                ]);
            }

            if (vpsRaw === null) return null;
            const settings = settingsOverride ?? await catalogConfigService.getSettings();

            const catSlugMap = new Map<string, string>(
                (vpsCats || []).map((c: any) => [c.id, c.slug])
            );

            let result: any[];
            if (catalogService._lastVpsRaw === vpsRaw && catalogService._lastMappedResult) {
                // IMPORTANT: create a new array to avoid mutating the cached mapping!
                result = [...catalogService._lastMappedResult];
            } else {
                result = removeHiddenCatalogProducts(removeHiddenOffers(vpsRaw as any[])).map((p: any) => {
                    const normalized = normalizeProduct(p);
                    
                    // Pré-calcula uma string de busca sem acentos para este produto
                    const removeAccents = (str: any) => {
                        if (!str || typeof str !== 'string') return '';
                        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                    };

                    const alternativeEans = Array.isArray(p.alternative_eans)
                        ? p.alternative_eans.join(' ')
                        : (typeof p.alternative_eans === 'string' ? p.alternative_eans : '');

                    const searchStr = removeAccents(p.name) + ' ' + 
                                      removeAccents(p.brand) + ' ' + 
                                      removeAccents(p.model) + ' ' + 
                                      removeAccents(p.sku) + ' ' +
                                      removeAccents(p.ean) + ' ' +
                                      removeAccents(alternativeEans);
                    
                    return { 
                        ...normalized, 
                        category_slug: p.category_id ? catSlugMap.get(p.category_id) : undefined,
                        _search_string: searchStr
                     };
                });
                catalogService._lastVpsRaw = vpsRaw;
                // Save the mapped result to prevent duplicate work, but NEXT TIME clone it
                catalogService._lastMappedResult = result;
                result = [...result]; // and clone for this run as well
            }

            // Fallback de imagem para catálogo geral:
            // quando a VPS devolve images vazias, usa a galeria de modelo/cor já cadastrada.
            const productsNeedingImages = result.filter(
                (p: any) => (!Array.isArray(p.images) || p.images.length === 0) && p.model_id
            );

            if (productsNeedingImages.length > 0) {
                const modelIds = [...new Set(productsNeedingImages.map((p: any) => p.model_id))];
                const colorNames = [...new Set(
                    productsNeedingImages.map((p: any) => p.specs?.color).filter(Boolean) as string[]
                )];

                const [modelImagesResult, colorRowsResult] = await Promise.allSettled([
                    modelColorImagesService.getByModelIds(modelIds),
                    colorNames.length > 0
                        ? colorService.list().then(colors => colors.filter(color => colorNames.includes(color.name)))
                        : Promise.resolve([])
                ]);
                const modelImages = modelImagesResult.status === 'fulfilled' ? modelImagesResult.value : [];
                const colorRows = colorRowsResult.status === 'fulfilled' ? colorRowsResult.value : [];

                if (modelImagesResult.status === 'rejected' || colorRowsResult.status === 'rejected') {
                    console.warn('[catalogService] Fallback de imagens por modelo/cor indisponivel; seguindo com imagens publicas dos produtos.', {
                        modelImagesError: modelImagesResult.status === 'rejected' ? modelImagesResult.reason : null,
                        colorRowsError: colorRowsResult.status === 'rejected' ? colorRowsResult.reason : null,
                    });
                }

                if (modelImages && modelImages.length > 0) {
                    const colorNameToId = new Map<string, string>(
                        (colorRows || []).map(c => [c.name, c.id])
                    );

                    result = result.map((product: any) => {
                        if (Array.isArray(product.images) && product.images.length > 0) return product;
                        if (!product.model_id) return product;

                        const entriesForModel = modelImages.filter(mi => mi.model_id === product.model_id);
                        if (entriesForModel.length === 0) return product;

                        const colorName = product.specs?.color;
                        const colorId = colorName ? colorNameToId.get(colorName) : undefined;
                        const chosen = colorId
                            ? entriesForModel.find(mi => mi.color_id === colorId)
                            : undefined;

                        if (chosen?.images?.length > 0) {
                            return {
                                ...product,
                                images: chosen.images,
                                image_url: product.image_url || chosen.images[0]
                            };
                        }

                        return product;
                    });
                }
            }

            if (filters?.search && filters.search.trim() !== '') {
                const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                const query = removeAccents(filters.search.trim());
                result = result.filter(p => (p as any)._search_string.includes(query));
            }

            // Aplica as regras globais configuradas no catálogo (estoque, inativos, preço, etc.)
            result = catalogConfigService.applyVisibilityRules(result, settings);

            if (filters?.inStockOnly) {
                result = result.filter(p => !p.track_inventory || (p.stock_quantity || 0) > 0);
            }
            result = filterBySelectedCategories(result, filters?.categories);
            if (filters?.brands && filters.brands.length > 0) {
                result = result.filter(p => p.brand && filters.brands!.includes(p.brand));
            }
            if (filters?.priceRange) {
                result = result.filter(p => (p.price_retail || 0) >= filters.priceRange![0] && (p.price_retail || 0) <= filters.priceRange![1]);
            }
            if (filters?.featuredOnly) {
                result = result.filter(p => p.custom_fields && typeof p.custom_fields === 'object' && 'featured' in p.custom_fields && p.custom_fields.featured === true);
            }

            const isFeaturedProduct = (product: any) => (
                product.custom_fields &&
                typeof product.custom_fields === 'object' &&
                'featured' in product.custom_fields &&
                product.custom_fields.featured === true
            );

            const sortByRecent = (left: any, right: any) => {
                const dateLeft = new Date(left.created_at || 0).getTime();
                const dateRight = new Date(right.created_at || 0).getTime();
                return dateRight - dateLeft;
            };

            switch (filters?.sortBy) {
                case 'price_asc':  result.sort((a, b) => (a.price_retail || 0) - (b.price_retail || 0)); break;
                case 'price_desc': result.sort((a, b) => (b.price_retail || 0) - (a.price_retail || 0)); break;
                case 'featured':
                    result.sort((a, b) => {
                        const featuredDelta = Number(isFeaturedProduct(b)) - Number(isFeaturedProduct(a));
                        return featuredDelta || sortByRecent(a, b);
                    });
                    break;
                default:
                    result.sort(sortByRecent);
            }

            const from = (page - 1) * pageSize;
            const paginated = result.slice(from, from + pageSize);

            // Em compact=true a VPS remove imagens base64 para economizar payload.
            // Para cards visíveis sem mídia, hidrata via /products/:id (payload completo).
            const hasMedia = (product: any) => {
                if (Array.isArray(product.images) && product.images.some((img: any) => typeof img === 'string' && img.trim().length > 0)) {
                    return true;
                }
                return typeof product.image_url === 'string' && product.image_url.trim().length > 0;
            };

            const missingMedia = paginated
                .filter((product: any) => product?.id && !hasMedia(product))
                .slice(0, 24);

            let hydratedPaginated = paginated;
            if (missingMedia.length > 0) {
                // Batch fetch: 1 request com .in(ids) em vez de N fetches individuais.
                // Antes: 24× /products/{id} em paralelo (~3s cada → 60s+ de wait time agregado).
                // Agora: 1× /products/by-ids?ids=... → ~500ms.
                const ids = missingMedia.map((p: any) => p.id).filter(Boolean);
                const fullRowsRaw = await vpsApiService.getProductsByIds(ids) || [];
                const fullRows = fullRowsRaw
                    .map((full: any) => {
                        const normalized = normalizeProduct(full as any);
                        if (!hasMedia(normalized)) return null;
                        return {
                            id: full.id,
                            images: normalized.images,
                            image_url: normalized.image_url || normalized.images?.[0] || null,
                        };
                    })
                    .filter(Boolean);

                const mediaById = new Map(
                    fullRows.map((row: any) => [row.id, row])
                );

                hydratedPaginated = paginated.map((product: any) => {
                    const media = mediaById.get(product.id);
                    if (!media) return product;
                    return {
                        ...product,
                        images: media.images,
                        image_url: media.image_url,
                    };
                });
            }
            return { products: hydratedPaginated as unknown as CatalogProduct[], total: result.length, hasMore: paginated.length === pageSize };
        };

        // ── SWR (Stale-While-Revalidate) ──────────────────────────────────────
        // 1. Verificar cache localStorage
        if (!bypassCache && !filters?.search) {
            const storage = getStorage();
            if (storage) {
                try {
                    const cachedStr = storage.getItem(cacheKey);
                    if (cachedStr) {
                        const cached = JSON.parse(cachedStr);
                        const isStale = Date.now() - cached.timestamp >= CACHE_TTL;

                        if (!isStale) {
                            // Cache fresco → retorna instantaneamente
                            console.log('⚡ [catalogService] Cache fresco — retornando instantaneamente');
                            return { products: cached.data, total: cached.total, hasMore: cached.hasMore };
                        } else {
                            // Cache stale → serve imediatamente e revalida em background
                            console.log('⚡ [catalogService] Cache stale — servindo imediatamente, revalidando em background');
                            fetchFromVps().then(fresh => {
                                if (fresh) saveToCache(fresh.products, fresh.total, fresh.hasMore);
                            }).catch(() => {});
                            return { products: cached.data, total: cached.total, hasMore: cached.hasMore };
                        }
                    }
                } catch (e) {
                    console.warn('[catalogService] Failed to parse catalog cache', e);
                }
            }
        }

        // 2. Sem cache → busca da VPS e salva
        console.log(`🌐 [catalogService] Buscando da VPS (bypassCache: ${bypassCache})`);
        try {
            const fresh = await fetchFromVps();
            if (fresh) {
                saveToCache(fresh.products, fresh.total, fresh.hasMore);
                console.log(`⚡ [catalogService] VPS: ${fresh.products.length}/${fresh.total} produtos`);
                return fresh;
            }
        } catch (vpsErr) {
            console.error('[catalogService] VPS falhou:', vpsErr);
            throw new Error('Falha ao conectar com o serviço de catálogo integrado.');
        }

        return { products: [], total: 0, hasMore: false };
    },


    /**
     * Buscar produtos por texto
     */
    searchProducts: async (query: string): Promise<CatalogProduct[]> => {
        if (query.length < 2) return [];
        // VPS é a fonte de verdade — catálogo VPS descontinuado para catálogo
        const results = await vpsApiService.getProducts({ search: query, limit: 50, noCache: true });
        return removeHiddenCatalogProducts(removeHiddenOffers(results || [])).map(normalizeProduct) as unknown as CatalogProduct[];
    },

    /**
     * Buscar produto por ID
     */
    getProductById: async (id: string): Promise<CatalogProduct | null> => {
        // VPS é a fonte de verdade — catálogo VPS descontinuado para catálogo
        const product = await vpsApiService.getProductById(id, true);
        if (!product) return null;
        // Registrar visualização (analytics VPS — ok manter)
        await catalogService.recordProductView(id);
        if (product.hide_from_catalog) return null;
        if (product.offer_type && product.offer_visibility === 'hidden') return null;
        return normalizeProduct(product) as unknown as CatalogProduct;
    },

    /**
     * Buscar produtos por categoria
     */
    getProductsByCategory: async (category: string, bypassCache: boolean = false): Promise<CatalogProduct[]> => {
        const cacheKey = `${CACHE_KEY_PREFIX}category:${category}`;
        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try {
                    const cachedStr = storage.getItem(cacheKey);
                    if (cachedStr) {
                        const cached = JSON.parse(cachedStr);
                        if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
                    }
                } catch (e) { }
            }
        }
        // VPS é a fonte de verdade — catálogo VPS descontinuado para catálogo
        const results = await vpsApiService.getProducts({ category, limit: 200 });
        const products = removeHiddenCatalogProducts(removeHiddenOffers(results || [])).map(normalizeProduct) as unknown as CatalogProduct[];
        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try { storage.setItem(cacheKey, JSON.stringify({ data: products, timestamp: Date.now() })); } catch (e) { }
            }
        }
        return products;
    },

    /**
     * Buscar produtos em destaque
     */
    getFeaturedProducts: async (limit: number = 10, bypassCache: boolean = false): Promise<CatalogProduct[]> => {
        const cacheKey = `${CACHE_KEY_PREFIX}featured:${limit}`;
        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try {
                    const cachedStr = storage.getItem(cacheKey);
                    if (cachedStr) {
                        const cached = JSON.parse(cachedStr);
                        if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
                    }
                } catch (e) { }
            }
        }
        // VPS é a fonte de verdade — busca produtos em destaque
        let products: CatalogProduct[] = [];
        try {
            const res = await fetch(buildVpsUrl(`/products?is_featured=true&limit=${limit}`));
            if (res.ok) {
                const data = await res.json();
                products = removeHiddenCatalogProducts(removeHiddenOffers(data || [])).map(normalizeProduct) as unknown as CatalogProduct[];
            }
        } catch (e) { console.warn('[catalogService] getFeaturedProducts VPS error:', e); }
        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try { storage.setItem(cacheKey, JSON.stringify({ data: products, timestamp: Date.now() })); } catch (e) { }
            }
        }
        return products;
    },

    /**
     * Buscar produtos novos
     */
    getNewProducts: async (limit: number = 10, bypassCache: boolean = false): Promise<CatalogProduct[]> => {
        const cacheKey = `${CACHE_KEY_PREFIX}new:${limit}`;
        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try {
                    const cachedStr = storage.getItem(cacheKey);
                    if (cachedStr) {
                        const cached = JSON.parse(cachedStr);
                        if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
                    }
                } catch (e) { }
            }
        }
        // VPS é a fonte de verdade — busca produtos novos
        let products: CatalogProduct[] = [];
        try {
            const res = await fetch(buildVpsUrl(`/products?is_new=true&limit=${limit}`));
            if (res.ok) {
                const data = await res.json();
                products = removeHiddenCatalogProducts(removeHiddenOffers(data || [])).map(normalizeProduct) as unknown as CatalogProduct[];
            }
        } catch (e) { console.warn('[catalogService] getNewProducts VPS error:', e); }
        if (!bypassCache) {
            const storage = getStorage();
            if (storage) {
                try { storage.setItem(cacheKey, JSON.stringify({ data: products, timestamp: Date.now() })); } catch (e) { }
            }
        }
        return products;
    },

    /**
     * Registrar visualização de produto
     */
    recordProductView: async (productId: string, customerId?: string): Promise<void> => {
        const sessionId = localStorage.getItem('session_id') || crypto.randomUUID();
        localStorage.setItem('session_id', sessionId);

        await vpsClient.post(`/products/${encodeURIComponent(productId)}/view`, {
            customer_id: customerId,
            session_id: sessionId,
        });
    },

    /**
     * Adicionar aos favoritos
     */
    addToFavorites: async (productId: string, customerId: string): Promise<void> => {
        try {
            const path = `/customers/${customerId}/favorites`;
            await fetch(buildVpsUrl(path, { method: 'POST' }), {
                method: 'POST',
                headers: await buildAuthHeaders({
                    'Content-Type': 'application/json',
                    ...getVpsSyncHeaders(),
                }),
                body: JSON.stringify({ productId }),
            });
        } catch (error: any) {
            console.error('Error adding to favorites:', error);
            throw error;
        }
    },

    /**
     * Remover dos favoritos
     */
    removeFromFavorites: async (productId: string, customerId: string): Promise<void> => {
        try {
            const path = `/customers/${customerId}/favorites/${productId}`;
            await fetch(buildVpsUrl(path, { method: 'DELETE' }), {
                method: 'DELETE',
                headers: await buildAuthHeaders({
                    ...getVpsSyncHeaders(),
                }),
            });
        } catch (error: any) {
            console.error('Error removing from favorites:', error);
            throw error;
        }
    },

    /**
     * Buscar IDs dos produtos favoritos do usuário
     */
    getUserFavorites: async (customerId: string): Promise<string[]> => {
        try {
            const path = `/customers/${customerId}/favorites`;
            const res = await fetch(buildVpsUrl(path, { method: 'GET' }), {
                headers: await buildAuthHeaders({
                    Accept: 'application/json',
                    ...getVpsSyncHeaders(),
                }),
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) return [];
            const data = await res.json();
            // Pode retornar array de IDs ou array de objetos { product_id }
            if (Array.isArray(data)) {
                return data.map((item: any) => (typeof item === 'string' ? item : item.product_id)).filter(Boolean);
            }
            return [];
        } catch (error: any) {
            console.error('Error getting favorites:', error);
            return [];
        }
    },

    /**
     * Verificar se produto está nos favoritos
     */
    isFavorite: async (productId: string, customerId: string): Promise<boolean> => {
        try {
            const favs = await catalogService.getUserFavorites(customerId);
            return favs.includes(productId);
        } catch (error: any) {
            console.error('Error checking favorite:', error);
            return false;
        }
    },

    /**
     * Limpar cache
     */
    clearCache: () => {
        const storage = getStorage();
        if (storage) {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(CACHE_KEY_PREFIX)) {
                    storage.removeItem(key);
                }
            }
        }
    },

    /**
     * Buscar categorias disponíveis (somente IDs em uso)
     */
    getCategories: async (): Promise<string[]> => {
        const cacheKey = `${CACHE_KEY_PREFIX}categories_used`;
        const storage = getStorage();
        if (storage) {
            try {
                const cachedStr = storage.getItem(cacheKey);
                if (cachedStr) {
                    const cached = JSON.parse(cachedStr);
                    if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
                }
            } catch (e) { }
        }
        // VPS é a fonte de verdade para categorias
        const cats = await vpsApiService.getCategories();
        const result = [...new Set((cats || []).map((c: any) => c.id).filter(Boolean))].sort() as string[];
        if (storage) {
            try { storage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() })); } catch (e) { }
        }
        return result;
    },

    /**
     * Buscar lista completa de categorias com ID e Nome (útil para Selects)
     */
    getCategoriesWithNames: async (): Promise<{ id: string, name: string }[]> => {
        const cacheKey = `${CACHE_KEY_PREFIX}categories_full`;
        const storage = getStorage();
        if (storage) {
            try {
                const cachedStr = storage.getItem(cacheKey);
                if (cachedStr) {
                    const cached = JSON.parse(cachedStr);
                    if (Date.now() - cached.timestamp < CACHE_TTL) {
                        return cached.data;
                    }
                }
            } catch (e) { }
        }

        const cats = await vpsApiService.getCategories();
        const result = (cats || [])
            .map((c: any) => ({ id: c.id, name: c.name }))
            .filter(c => c.id && c.name)
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

        if (storage) {
            try {
                storage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() }));
            } catch (e) { }
        }

        return result;
    },

    /**
     * Buscar marcas disponíveis
     */
    getBrands: async (): Promise<string[]> => {
        const cacheKey = `${CACHE_KEY_PREFIX}brands_used`;
        const storage = getStorage();
        if (storage) {
            try {
                const cachedStr = storage.getItem(cacheKey);
                if (cachedStr) {
                    const cached = JSON.parse(cachedStr);
                    if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
                }
            } catch (e) { }
        }
        // VPS é a fonte de verdade — extrai marcas únicas dos produtos
        const vpsProducts = await vpsApiService.getProducts({ limit: 2000, compact: true });
        const result = [...new Set((vpsProducts || []).map((p: any) => p.brand).filter(Boolean))].sort() as string[];
        if (storage) {
            try { storage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() })); } catch (e) { }
        }
        return result;
    }
};

// Função RPC para incrementar views (criar no VPS)
/*
CREATE OR REPLACE FUNCTION increment_product_views(product_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE products 
  SET 
    views_count = COALESCE(views_count, 0) + 1,
    last_viewed_at = NOW()
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/
