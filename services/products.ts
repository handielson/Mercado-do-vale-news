import { Product, ProductInput } from '../types/product';
import { ProductStatus } from '../utils/field-standards';
import { logPriceChange } from './priceHistoryService';
import { vpsApiService } from './vpsApiService';
import { categoryService } from './categories';
import { modelService } from './models';
import { brandService } from './brands';
import { buildProductVideoUrl } from '../utils/video-url';
import { getCompanyId } from './companyContext';
import { ensureTag, parseTagsVenda } from '../utils/cross-sell-tags';
import { shopeeProductService } from './shopeeProducts';
import { markLocalNameManaged } from './blingNameSyncPolicy.js';

/**
 * PRODUCT SERVICE — VPS MySQL (fonte exclusiva de verdade)
 * VPS é a fonte operacional; dados relacionais usam os serviços locais correspondentes
 */

// ─── Transform ─────────────────────────────────────────────────────────────

function parseProductTagIds(value: unknown): number[] {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    if (!value) return [];
    try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch {
        return [];
    }
}

function transformFromDB(row: any): Product {
    return {
        id: row.id,
        model_id: row.model_id,
        model: row.model || row.model_name || '',
        category_id: row.category_id,
        brand: row.brand,
        name: row.name,
        sku: row.sku,
        description: row.description,
        eans: row.alternative_eans?.length ? row.alternative_eans : (row.ean ? [row.ean] : []),
        specs: row.specs || {},
        price_cost: row.price_cost,
        price_retail: row.price_retail,
        price_reseller: row.price_reseller,
        price_wholesale: row.price_wholesale,
        ncm: row.ncm,
        cest: row.cest,
        origin: row.origin,
        weight_kg: row.weight_kg,
        dimensions: row.dimensions,
        stock_quantity: row.stock_quantity || 0,
        images: row.images || [],
        status: row.status || ProductStatus.ACTIVE,
        track_inventory: Boolean(row.track_inventory),
        is_gift: Boolean(row.is_gift),
        is_virtual: Boolean(row.is_virtual),
        warranty_type: row.warranty_type || 'brand',
        warranty_template_id: row.warranty_template_id || null,
        parent_id: row.parent_id || undefined,
        is_parent: Number(row.is_parent) === 1,
        bling_id: row.bling_id || undefined,
        bling_parent_id: row.bling_parent_id || undefined,
        shopee_item_id: row.shopee_item_id || undefined,
        video_url: row.video_url || undefined,
        marketing_background_url: row.marketing_background_url || undefined,
        marketing_background_no_price_url: row.marketing_background_no_price_url || undefined,
        marketing_video_url: row.marketing_video_url || undefined,
        blueprint_image_url: row.blueprint_image_url || null,
        blueprint_source_hash: row.blueprint_source_hash || null,
        blueprint_generated_at: row.blueprint_generated_at || null,
        price_promo: row.price_promo || undefined,
        promo_start: row.promo_start || undefined,
        promo_end: row.promo_end || undefined,
        slug: row.slug || undefined,
        exclude_from_seo: Boolean(row.exclude_from_seo),
        hide_from_catalog: Boolean(row.hide_from_catalog),
        meta_title: row.meta_title || undefined,
        meta_description: row.meta_description || undefined,
        keywords: Array.isArray(row.keywords) ? row.keywords : (typeof row.keywords === 'string' ? row.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : []),
        tag_ids: parseProductTagIds(row.tag_ids),
        kits: row.kits || [],
        production_days: row.production_days ?? null,
        created: row.created_at,
        updated: row.updated_at,
    };
}

async function isSerializedProductCategory(categoryId: string | null | undefined): Promise<boolean> {
    if (!categoryId) return false;
    const category = await categoryService.getById(categoryId);
    const categoryName = category?.name?.toUpperCase() || '';
    return ['CELULAR', 'SMARTPHONE', 'TABLET', 'RECEPTOR'].some((keyword) => categoryName.includes(keyword));
}

async function resolveModelBrandName(modelData: any, fallback?: string | null): Promise<string | undefined> {
    const embeddedBrand = Array.isArray(modelData?.brand) ? modelData.brand[0] : modelData?.brand;
    const embeddedName = embeddedBrand?.name || modelData?.brand_name;
    if (embeddedName) return embeddedName;
    if (fallback) return fallback;
    if (!modelData?.brand_id) return undefined;

    const brand = await brandService.getById(modelData.brand_id);
    return brand?.name;
}

function isActiveProductForCatalog(product: Product): boolean {
    return String(product.status || '').toLowerCase() === ProductStatus.ACTIVE;
}

interface VariationPriceAdjustment {
    updated: number;
    targetIds: string[];
    ram: string;
    storage: string;
    color: string;
    prices: {
        price_retail: number;
        price_reseller: number;
        price_wholesale: number;
    };
}

type ProductWithPriceAdjustment = Product & {
    priceAdjustment?: VariationPriceAdjustment;
    reusedExistingProduct?: boolean;
};

function normalizeVariationSpec(value: unknown): string {
    return String(value || '').trim().toLowerCase();
}

function isEquivalentSerializedVariation(row: any, input: ProductInput): boolean {
    const rowSpecs = row?.specs || {};
    const inputSpecs = input.specs || {};
    const same = (left: unknown, right: unknown) => normalizeVariationSpec(left) === normalizeVariationSpec(right);
    const sameCapacity = (left: unknown, right: unknown) =>
        normalizeVariationSpec(left).replace(/\s+/g, '').replace(/gib\b/g, 'gb')
        === normalizeVariationSpec(right).replace(/\s+/g, '').replace(/gib\b/g, 'gb');

    return same(row?.model_id, input.model_id)
        && same(row?.sku, input.sku)
        && sameCapacity(rowSpecs.ram, inputSpecs.ram)
        && sameCapacity(rowSpecs.storage || rowSpecs.armazenamento, inputSpecs.storage || inputSpecs.armazenamento)
        && same(rowSpecs.color || rowSpecs.cor, inputSpecs.color || inputSpecs.cor)
        && same(rowSpecs.version || rowSpecs.versao, inputSpecs.version || inputSpecs.versao);
}

function hasSellableStock(product: Product): boolean {
    return !product.track_inventory || (product.stock_quantity || 0) > 0;
}

function salePricesDiffer(product: Product, source: Product): boolean {
    return Number(product.price_retail || 0) !== Number(source.price_retail || 0) ||
        Number(product.price_reseller || 0) !== Number(source.price_reseller || 0) ||
        Number(product.price_wholesale || 0) !== Number(source.price_wholesale || 0);
}

async function syncVariationPrices(source: Product): Promise<VariationPriceAdjustment | null> {
    // Smartphone prices belong to the server-side configuration group, never to the last edited color.
    if (source.model_id) {
        const { smartphonePriceGroups } = await import('./smartphonePriceGroups');
        if ((await smartphonePriceGroups.reference(source.model_id, source)).controlled) return null;
    }
    const modelId = String(source.model_id || '').trim();
    const ram = normalizeVariationSpec(source.specs?.ram);
    const storage = normalizeVariationSpec(source.specs?.storage);

    if (!modelId || !ram || !storage) return null;

    const rows = await vpsApiService.getProducts({
        model_id: modelId,
        status: 'active',
        limit: 500,
        noCache: true,
    });

    const peers = (rows || [])
        .map(transformFromDB)
        .filter((product) =>
            product.id !== source.id &&
            hasSellableStock(product) &&
            normalizeVariationSpec(product.specs?.ram) === ram &&
            normalizeVariationSpec(product.specs?.storage) === storage &&
            salePricesDiffer(product, source)
        );

    if (peers.length === 0) return null;

    const updates = peers.map((product) => ({
        id: product.id,
        price_retail: source.price_retail,
        price_reseller: source.price_reseller,
        price_wholesale: source.price_wholesale,
    }));

    const result = await vpsApiService.bulkSyncPricesStock(updates);
    if (!result.ok) {
        throw new Error('Falha ao padronizar preços da mesma variação no estoque.');
    }

    return {
        updated: peers.length,
        targetIds: peers.map((product) => product.id),
        ram: String(source.specs?.ram || ''),
        storage: String(source.specs?.storage || ''),
        color: String(source.specs?.color || source.specs?.cor || ''),
        prices: {
            price_retail: source.price_retail,
            price_reseller: source.price_reseller,
            price_wholesale: source.price_wholesale,
        },
    };
}

async function enrichProductsWithShopeeLinks(rows: any[]): Promise<any[]> {
    if (rows.length === 0) return rows;

    try {
        const shopeeItemByProductId = await shopeeProductService.getItemIdByProductIdMap();

        if (shopeeItemByProductId.size === 0) return rows;

        return rows.map((row) => ({
            ...row,
            shopee_item_id: shopeeItemByProductId.get(String(row.id)) ?? row.shopee_item_id,
        }));
    } catch (error) {
        console.warn('[products.list] Falha ao carregar vinculos da Shopee:', error);
        return rows;
    }
}

// ─── READ ──────────────────────────────────────────────────────────────────

async function list(): Promise<Product[]> {
    const pageSize = 500;
    const maxRecords = 10000;
    const rows: any[] = [];

    const fetchPageWithRetry = async (offset: number, retries = 2): Promise<any[] | null> => {
        for (let attempt = 0; attempt <= retries; attempt++) {
            const page = await vpsApiService.getProducts({
                status: 'all',
                limit: pageSize,
                offset,
                compact: true,
                noCache: true,
            });
            if (page) return page;
            if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
            }
        }
        return null;
    };

    for (let offset = 0; offset < maxRecords; offset += pageSize) {
        const page = await fetchPageWithRetry(offset);

        if (!page) {
            if (offset === 0) {
                throw new Error('Falha ao carregar produtos da VPS');
            }
            console.warn('[products.list] Interrompido por falha parcial ao carregar página da VPS em offset:', offset);
            break;
        }

        rows.push(...page);
        if (page.length < pageSize) break;
    }

    const enrichedRows = await enrichProductsWithShopeeLinks(rows);
    return enrichedRows.map(transformFromDB);
}

async function getById(id: string): Promise<Product | null> {
    const data = await vpsApiService.getProductById(id, true);
    if (!data || data.error) return null;
    
    const product = transformFromDB(data);
    
    // Enrich with model name if missing but we have model_id
    if (!product.model && product.model_id) {
        try {
            const modelData = await modelService.getById(product.model_id);
            if (modelData) {
                product.model = modelData.name;
            }
        } catch (e) {
            console.warn('[productService] Failed to enrich model name:', e);
        }
    }
    
    return product;
}

async function getByEan(ean: string): Promise<Product | null> {
    const data = await vpsApiService.getProductByEan(ean);
    if (!data || data.length === 0) return null;
    return data.map(transformFromDB).find(isActiveProductForCatalog) || null;
}

async function search(query: string): Promise<Product[]> {
    const data = await vpsApiService.getProducts({ search: query, status: 'all', limit: 50, noCache: true });
    return (data || []).map(transformFromDB);
}

async function searchByEAN(ean: string): Promise<Product[]> {
    const data = await vpsApiService.getProductByEan(ean);
    return (data || []).map(transformFromDB).filter(isActiveProductForCatalog);
}

async function listByCategory(categoryId: string, limit = 120): Promise<Product[]> {
    const data = await vpsApiService.getProducts({
        category: categoryId,
        status: 'active',
        limit,
        noCache: true,
    });
    return (data || []).map(transformFromDB).filter(isActiveProductForCatalog);
}

async function listChildren(parentId: string): Promise<Product[]> {
    const data = await vpsApiService.getProductsByParentId(parentId);
    return (data || []).map(transformFromDB);
}

// ─── WRITE ─────────────────────────────────────────────────────────────────

async function create(input: ProductInput): Promise<ProductWithPriceAdjustment> {
    const id = crypto.randomUUID();

    // Validate model_id
    if (!input.model_id || input.model_id.trim() === '') {
        throw new Error('Model ID é obrigatório. Por favor, escaneie um EAN ou selecione um modelo.');
    }

    const modelData = await modelService.getById(input.model_id);
    if (!modelData) throw new Error('Failed to fetch model: Modelo nao encontrado na VPS');

    const brand = await resolveModelBrandName(modelData, input.brand);
    // Respeita override manual de categoria no formulário.
    const category_id = input.category_id || modelData.category_id;
    const dimensions = input.dimensions || modelData.template_values?.dimensions;
    const weight_kg = input.weight_kg || modelData.template_values?.weight_kg;

    const isSerializedCategory = await isSerializedProductCategory(category_id);

    // SKU uniqueness check — busca exata na VPS (fonte da verdade)
    // Ignora códigos de unidade do Bling (PCS, UN, PC, CX) que não são SKUs reais
    const UNIT_CODES = ['PCS', 'UN', 'PC', 'CX'];
    if (input.sku && !UNIT_CODES.includes(input.sku.toUpperCase())) {
        const skuConflict = await vpsApiService.getProducts({ sku: input.sku, status: 'all', limit: 50, noCache: true });
        
        // Filtra correspondência exata para segurança (ilike pode retornar substrings em alguns BDs)
        const exactMatch = (skuConflict || []).filter(
            (p: any) => p.sku?.toLowerCase() === input.sku!.toLowerCase()
        );

        if (exactMatch.length > 0) {
            if (isSerializedCategory) {
                const reusable = exactMatch.find((row: any) =>
                    String(row.status || '').toLowerCase() === ProductStatus.ACTIVE
                    && isEquivalentSerializedVariation(row, input)
                );
                if (reusable) {
                    const existing = transformFromDB(reusable) as ProductWithPriceAdjustment;
                    existing.reusedExistingProduct = true;
                    console.info(`[productService] Produto serializado existente reutilizado para o SKU "${input.sku}".`);
                    return existing;
                }
                console.warn(`[WARNING] SKU "${input.sku}" já existe, mas pertence a outra variacao. Novo cadastro serializado mantido separado.`);
            } else {
                throw new Error(`SKU "${input.sku}" já está em uso pelo produto "${exactMatch[0].name}". Cada produto deve ter um SKU único.`);
            }
        }
    }

    let finalVideoUrl = input.video_url || null;
    if (!finalVideoUrl && modelData.template_values?.has_video && input.sku) {
        try {
            const { companySettingsService } = await import('./companySettingsService');
            const settings = await companySettingsService.get() as any;
            const videoBaseUrl = settings?.synology_video_base_url || settings?.synologyVideoBaseUrl;
            if (videoBaseUrl) {
                const ext = settings?.synologyVideoExtension || settings?.synology_video_extension || '.mp4';
                finalVideoUrl = buildProductVideoUrl(videoBaseUrl, input.sku, ext);
            }
        } catch (e) { console.error('Failed to auto-generate video URL:', e); }
    }

    const companyId = await getCompanyId();

    const payload: any = {
        id,
        company_id: companyId,
        model_id: input.model_id,
        parent_id: input.parent_id || null,
        is_parent: input.is_parent ? 1 : 0,
        brand,
        category_id,
        name: input.name,
        sku: input.sku || null,
        description: input.description || null,
        ean: input.eans?.[0] || null,
        alternative_eans: input.eans || [],
        specs: { ...(modelData.template_values || {}), ...(input.specs || {}) },
        price_cost: input.price_cost,
        price_retail: input.price_retail,
        price_reseller: input.price_reseller,
        price_wholesale: input.price_wholesale,
        images: input.images || [],
        ncm: input.ncm || null,
        cest: input.cest || null,
        origin: input.origin || null,
        weight_kg,
        dimensions,
        stock_quantity: input.stock_quantity || 0,
        status: input.status,
        track_inventory: input.track_inventory ? 1 : 0,
        is_gift: input.is_gift ? 1 : 0,
        is_virtual: input.is_virtual ? 1 : 0,
        warranty_type: input.warranty_type || 'brand',
        warranty_template_id: input.warranty_template_id || null,
        price_promo: input.price_promo || null,
        promo_start: input.promo_start || null,
        promo_end: input.promo_end || null,
        bling_id: input.bling_id || null,
        bling_parent_id: input.bling_parent_id || null,
        shopee_item_id: input.shopee_item_id || null,
        video_url: finalVideoUrl,
        marketing_background_url: input.marketing_background_url || null,
        marketing_background_no_price_url: input.marketing_background_no_price_url || null,
        marketing_video_url: input.marketing_video_url || null,
        slug: input.slug || null,
        exclude_from_seo: input.exclude_from_seo ? 1 : 0,
        hide_from_catalog: input.hide_from_catalog ? 1 : 0,
        meta_title: input.meta_title || null,
        meta_description: input.meta_description || null,
        keywords: input.keywords ? input.keywords.join(',') : null,
        kits: input.kits && input.kits.length > 0 ? input.kits : null,
        production_days: input.production_days != null ? input.production_days : null,
    };

    // Auto-tag: garante que a marca apareça em specs.tags_venda (cross-sell).
    // Comparação case/accent-insensitive evita duplicar com tag já existente.
    if (brand) {
        payload.specs = {
            ...payload.specs,
            tags_venda: ensureTag(parseTagsVenda(payload.specs?.tags_venda), brand),
        };
    }
    payload.specs = markLocalNameManaged(payload.specs);

    const result = await vpsApiService.createProduct(payload);
    if (result.errors.length > 0) throw new Error(`Failed to create product: ${result.errors[0].error}`);

    // O batch pode reaproveitar um produto existente (por exemplo, pelo bling_id).
    // Nesse caso, o ID resolvido pela API deve ser usado na unidade serializada criada
    // logo depois pelo ProductForm; manter o UUID solicitado gera uma unidade orfa.
    const resolved = result.resolved?.find((row) => row.requested_id === id) || result.resolved?.[0];
    const resolvedId = resolved?.id || id;
    const persistedRow = await vpsApiService.getProductById(resolvedId, true);
    if (!persistedRow) throw new Error('Produto salvo, mas não foi possível reler os preços. Recarregue antes de continuar.');
    const savedProduct = transformFromDB(persistedRow || { ...payload, id: resolvedId }) as ProductWithPriceAdjustment;
    const priceAdjustment = await syncVariationPrices(savedProduct);
    if (priceAdjustment) {
        savedProduct.priceAdjustment = priceAdjustment;
    }

    return savedProduct;
}

async function update(id: string, input: ProductInput): Promise<ProductWithPriceAdjustment> {
    // Carrega produto existente — preserva model_id legado e serve de base para price history/Shopee sync.
    const oldProduct = await getById(id);
    if (!oldProduct) throw new Error(`Produto não encontrado: ${id}`);

    // Preserva model_id existente quando o form não envia (produtos legados sem modelo associado).
    const trimmedInputModelId = input.model_id?.trim() || '';
    const effectiveModelId = trimmedInputModelId || oldProduct.model_id || null;

    // Busca modelo apenas quando há model_id. Erro explícito só se o usuário escolheu um modelo inválido;
    // model_id preservado de legado segue sem enriquecimento.
    let modelData: any = null;
    if (effectiveModelId) {
        modelData = await modelService.getById(effectiveModelId);
        if (!modelData) {
            if (trimmedInputModelId) {
                throw new Error('Failed to fetch model: Modelo nao encontrado na VPS');
            }
            console.warn(`[productService.update] Modelo ${effectiveModelId} não encontrado; seguindo sem enriquecimento de template.`);
        }
    }

    const brand = await resolveModelBrandName(modelData, input.brand || oldProduct.brand);
    // Respeita override manual de categoria no formulário.
    const category_id = input.category_id || modelData?.category_id || oldProduct.category_id;
    const dimensions = input.dimensions || modelData?.template_values?.dimensions || oldProduct.dimensions;
    const weight_kg = input.weight_kg || modelData?.template_values?.weight_kg || oldProduct.weight_kg;

    const isSerializedCategory = await isSerializedProductCategory(category_id);

    // SKU uniqueness check — busca exata na VPS (fonte da verdade), excluindo o próprio produto editado
    // Ignora códigos de unidade do Bling (PCS, UN, PC, CX) que não são SKUs reais
    const UNIT_CODES = ['PCS', 'UN', 'PC', 'CX'];
    if (input.sku && !UNIT_CODES.includes(input.sku.toUpperCase())) {
        const skuConflict = await vpsApiService.getProducts({ sku: input.sku, limit: 5 });

        const exactMatch = (skuConflict || []).filter(
            (p: any) => p.sku?.toLowerCase() === input.sku!.toLowerCase() && p.id !== id
        );

        if (exactMatch.length > 0) {
            const conflict = exactMatch[0];
            if (isSerializedCategory) {
                console.warn(`[WARNING] SKU "${input.sku}" já existe (produto "${conflict.name}"). Atualização permitida (categoria serializada).`);
            } else {
                throw new Error(`SKU "${input.sku}" já está em uso pelo produto "${conflict.name}". Cada produto deve ter um SKU único.`);
            }
        }
    }

    let finalVideoUrl = input.video_url || null;
    if (!finalVideoUrl && modelData?.template_values?.has_video && input.sku) {
        try {
            const { companySettingsService } = await import('./companySettingsService');
            const settings = await companySettingsService.get() as any;
            const videoBaseUrl = settings?.synology_video_base_url || settings?.synologyVideoBaseUrl;
            if (videoBaseUrl) {
                const ext = settings?.synologyVideoExtension || settings?.synology_video_extension || '.mp4';
                finalVideoUrl = buildProductVideoUrl(videoBaseUrl, input.sku, ext);
            }
        } catch (e) { console.error('Failed to auto-generate video URL:', e); }
    }

    const companyId = await getCompanyId();

    const payload: any = {
        id,
        company_id: companyId,
        model_id: effectiveModelId,
        parent_id: input.parent_id ?? null,
        brand,
        category_id,
        name: input.name,
        sku: input.sku || null,
        description: input.description || null,
        ean: input.eans?.[0] || null,
        alternative_eans: input.eans || [],
        specs: { ...(modelData?.template_values || {}), ...(input.specs || {}) },
        price_cost: input.price_cost,
        price_retail: input.price_retail,
        price_reseller: input.price_reseller,
        price_wholesale: input.price_wholesale,
        images: input.images || [],
        ncm: input.ncm || null,
        cest: input.cest || null,
        origin: input.origin || null,
        weight_kg,
        dimensions,
        stock_quantity: input.stock_quantity || 0,
        status: input.status,
        track_inventory: input.track_inventory ? 1 : 0,
        is_gift: input.is_gift ? 1 : 0,
        is_virtual: input.is_virtual ? 1 : 0,
        warranty_type: input.warranty_type || 'brand',
        warranty_template_id: input.warranty_template_id || null,
        price_promo: input.price_promo || null,
        promo_start: input.promo_start || null,
        promo_end: input.promo_end || null,
        bling_id: input.bling_id || null,
        bling_parent_id: input.bling_parent_id || null,
        shopee_item_id: input.shopee_item_id || null,
        video_url: finalVideoUrl,
        marketing_background_url: input.marketing_background_url || null,
        marketing_background_no_price_url: input.marketing_background_no_price_url || null,
        marketing_video_url: input.marketing_video_url || null,
        slug: input.slug || null,
        exclude_from_seo: input.exclude_from_seo ? 1 : 0,
        hide_from_catalog: input.hide_from_catalog ? 1 : 0,
        meta_title: input.meta_title || null,
        meta_description: input.meta_description || null,
        keywords: input.keywords ? input.keywords.join(',') : null,
        kits: input.kits && input.kits.length > 0 ? input.kits : null,
        production_days: input.production_days != null ? input.production_days : null,
    };

    // Auto-tag: garante que a marca atual apareça em specs.tags_venda.
    if (brand) {
        payload.specs = {
            ...payload.specs,
            tags_venda: ensureTag(parseTagsVenda(payload.specs?.tags_venda), brand),
        };
    }
    payload.specs = markLocalNameManaged(payload.specs);

    const ok = await vpsApiService.updateProduct(id, payload);
    if (!ok) throw new Error(`Failed to update product in VPS`);
    const persistedRow = await vpsApiService.getProductById(id, true);
    if (!persistedRow) throw new Error('Produto salvo, mas não foi possível reler os preços. Recarregue antes de continuar.');
    const savedProduct = transformFromDB(persistedRow) as ProductWithPriceAdjustment;

    // Log price change (usa VPS — tabela price_history não está na VPS)
    try {
        if (oldProduct) {
            const pricesChanged =
                oldProduct.price_cost !== savedProduct.price_cost ||
                oldProduct.price_retail !== savedProduct.price_retail ||
                oldProduct.price_reseller !== savedProduct.price_reseller ||
                oldProduct.price_wholesale !== savedProduct.price_wholesale;
            if (pricesChanged) {
                await logPriceChange(id, {
                    price_cost: savedProduct.price_cost,
                    price_retail: savedProduct.price_retail,
                    price_reseller: savedProduct.price_reseller,
                    price_wholesale: savedProduct.price_wholesale,
                });
            }
        }
    } catch (logErr) {
        console.warn('[productService] Failed to log price change:', logErr);
    }

    // Shopee Sync Automático
    if (payload.shopee_item_id && oldProduct) {
        import('./shopeeService').then(({ shopeeService }) => {
            if (oldProduct.price_retail !== savedProduct.price_retail) {
                shopeeService.updatePrice(id, savedProduct.price_retail).catch(e => console.error("Shopee Price Sync Error:", e));
            }
            if (input.track_inventory && oldProduct.stock_quantity !== input.stock_quantity) {
                shopeeService.updateStock(id, input.stock_quantity || 0).catch(e => console.error("Shopee Stock Sync Error:", e));
            }
        });
    }

    const priceAdjustment = await syncVariationPrices(savedProduct);
    if (priceAdjustment) {
        savedProduct.priceAdjustment = priceAdjustment;
    }

    return savedProduct;
}

async function deleteProduct(id: string): Promise<void> {
    const ok = await vpsApiService.deleteProduct(id);
    if (!ok) {
        throw new Error(`Delete na VPS falhou para id=${id}. Operação cancelada.`);
    }
}

export const productService = {
    list,
    getById,
    getByEan,
    create,
    update,
    delete: deleteProduct,
    search,
    searchByEAN,
    listByCategory,
    listChildren,
};
