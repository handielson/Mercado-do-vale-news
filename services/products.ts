import { Product, ProductInput } from '../types/product';
import { ProductStatus } from '../utils/field-standards';
import { supabase } from './supabase';
import { logPriceChange } from './priceHistoryService';
import { vpsApiService } from './vpsApiService';

/**
 * PRODUCT SERVICE — VPS MySQL (fonte exclusiva de verdade)
 * Supabase ainda é usado para: models, companies, price_history (dados relacionais que não estão na VPS)
 */

// ─── Company context (Supabase apenas para companies lookup) ──────────────────

const TEMP_COMPANY_ID = 'mercado-do-vale';
let _cachedCompanyId: string | null = null;

async function getCompanyId(): Promise<string> {
    if (_cachedCompanyId) return _cachedCompanyId;
    const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', TEMP_COMPANY_ID)
        .single();
    if (error) throw new Error(`Failed to get company: ${error.message}`);
    _cachedCompanyId = data.id;
    return data.id;
}

// ─── Transform ─────────────────────────────────────────────────────────────

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
        bling_id: row.bling_id || undefined,
        bling_parent_id: row.bling_parent_id || undefined,
        shopee_item_id: row.shopee_item_id || undefined,
        video_url: row.video_url || undefined,
        price_promo: row.price_promo || undefined,
        promo_start: row.promo_start || undefined,
        promo_end: row.promo_end || undefined,
        slug: row.slug || undefined,
        exclude_from_seo: Boolean(row.exclude_from_seo),
        meta_title: row.meta_title || undefined,
        meta_description: row.meta_description || undefined,
        keywords: Array.isArray(row.keywords) ? row.keywords : (typeof row.keywords === 'string' ? row.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : []),
        kits: row.kits || [],
        created: row.created_at,
        updated: row.updated_at,
    };
}

// ─── READ ──────────────────────────────────────────────────────────────────

async function list(): Promise<Product[]> {
    const data = await vpsApiService.getProducts({ status: 'all', limit: 5000 });
    if (!data) throw new Error('Falha ao carregar produtos da VPS');
    return data.map(transformFromDB);
}

async function getById(id: string): Promise<Product | null> {
    const data = await vpsApiService.getProductById(id, true);
    if (!data || data.error) return null;
    
    const product = transformFromDB(data);
    
    // Enrich with model name if missing but we have model_id
    if (!product.model && product.model_id) {
        try {
            const { data: modelData } = await supabase
                .from('models')
                .select('name')
                .eq('id', product.model_id)
                .single();
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
    return transformFromDB(data[0]);
}

async function search(query: string): Promise<Product[]> {
    const data = await vpsApiService.getProducts({ search: query, status: 'all', limit: 50, noCache: true });
    return (data || []).map(transformFromDB);
}

async function searchByEAN(ean: string): Promise<Product[]> {
    const data = await vpsApiService.getProductByEan(ean);
    return (data || []).map(transformFromDB);
}

async function listChildren(parentId: string): Promise<Product[]> {
    const data = await vpsApiService.getProductsByParentId(parentId);
    return (data || []).map(transformFromDB);
}

// ─── WRITE ─────────────────────────────────────────────────────────────────

async function create(input: ProductInput): Promise<Product> {
    const id = crypto.randomUUID();

    // Validate model_id
    if (!input.model_id || input.model_id.trim() === '') {
        throw new Error('Model ID é obrigatório. Por favor, escaneie um EAN ou selecione um modelo.');
    }

    // Fetch model via Supabase (models table não está na VPS)
    const { data: modelData, error: modelError } = await supabase
        .from('models')
        .select('id, name, brand_id, category_id, template_values, brand:brands(name)')
        .eq('id', input.model_id)
        .single();
    if (modelError) throw new Error(`Failed to fetch model: ${modelError.message}`);

    const brand = (modelData.brand as any)?.[0]?.name || input.brand;
    const category_id = modelData.category_id || input.category_id;
    const dimensions = input.dimensions || modelData.template_values?.dimensions;
    const weight_kg = input.weight_kg || modelData.template_values?.weight_kg;

    // Categorias de produtos físicos serializados onde múltiplos itens podem compartilhar o mesmo SKU
    let isSerializedCategory = false;
    if (category_id) {
        const { data: catData } = await supabase.from('categories').select('name').eq('id', category_id).single();
        if (catData && ['CELULAR', 'SMARTPHONE', 'TABLET', 'RECEPTOR'].some(kw => catData.name.toUpperCase().includes(kw))) {
            isSerializedCategory = true;
        }
    }

    // SKU uniqueness check — busca exata na VPS (fonte da verdade)
    // Ignora códigos de unidade do Bling (PCS, UN, PC, CX) que não são SKUs reais
    const UNIT_CODES = ['PCS', 'UN', 'PC', 'CX'];
    if (input.sku && !UNIT_CODES.includes(input.sku.toUpperCase())) {
        const skuConflict = await vpsApiService.getProducts({ sku: input.sku, limit: 1 });
        
        // Filtra correspondência exata para segurança (ilike pode retornar substrings em alguns BDs)
        const exactMatch = (skuConflict || []).filter(
            (p: any) => p.sku?.toLowerCase() === input.sku!.toLowerCase()
        );

        if (exactMatch.length > 0) {
            if (isSerializedCategory) {
                console.warn(`[WARNING] SKU "${input.sku}" já existe (produto "${exactMatch[0].name}"). Cadastro permitido (categoria serializada).`);
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
                const baseUrl = videoBaseUrl.endsWith('/') ? videoBaseUrl : `${videoBaseUrl}/`;
                finalVideoUrl = `${baseUrl}${input.sku.replace(/\s+/g, '')}${ext}`;
            }
        } catch (e) { console.error('Failed to auto-generate video URL:', e); }
    }

    const companyId = await getCompanyId();

    const payload: any = {
        id,
        company_id: companyId,
        model_id: input.model_id,
        parent_id: input.parent_id || null,
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
        slug: input.slug || null,
        exclude_from_seo: input.exclude_from_seo ? 1 : 0,
        meta_title: input.meta_title || null,
        meta_description: input.meta_description || null,
        keywords: input.keywords ? input.keywords.join(',') : null,
        kits: input.kits && input.kits.length > 0 ? input.kits : null,
    };

    const result = await vpsApiService.createProduct(payload);
    if (result.errors.length > 0) throw new Error(`Failed to create product: ${result.errors[0].error}`);

    return transformFromDB(payload);
}

async function update(id: string, input: ProductInput): Promise<Product> {
    // Validate model_id
    if (!input.model_id || input.model_id.trim() === '') {
        throw new Error('Model ID é obrigatório. Por favor, escaneie um EAN ou selecione um modelo.');
    }

    // Fetch model via Supabase (models não estão na VPS)
    const { data: modelData, error: modelError } = await supabase
        .from('models')
        .select('id, name, brand_id, category_id, template_values, brand:brands(name)')
        .eq('id', input.model_id)
        .single();
    if (modelError) throw new Error(`Failed to fetch model: ${modelError.message}`);

    const brand = (modelData.brand as any)?.[0]?.name || input.brand;
    const category_id = modelData.category_id || input.category_id;
    const dimensions = input.dimensions || modelData.template_values?.dimensions;
    const weight_kg = input.weight_kg || modelData.template_values?.weight_kg;

    // Categorias de produtos físicos serializados onde múltiplos itens podem compartilhar o mesmo SKU
    let isSerializedCategory = false;
    if (category_id) {
        const { data: catData } = await supabase.from('categories').select('name').eq('id', category_id).single();
        if (catData && ['CELULAR', 'SMARTPHONE', 'TABLET', 'RECEPTOR'].some(kw => catData.name.toUpperCase().includes(kw))) {
            isSerializedCategory = true;
        }
    }

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
    if (!finalVideoUrl && modelData.template_values?.has_video && input.sku) {
        try {
            const { companySettingsService } = await import('./companySettingsService');
            const settings = await companySettingsService.get() as any;
            const videoBaseUrl = settings?.synology_video_base_url || settings?.synologyVideoBaseUrl;
            if (videoBaseUrl) {
                const ext = settings?.synologyVideoExtension || settings?.synology_video_extension || '.mp4';
                const baseUrl = videoBaseUrl.endsWith('/') ? videoBaseUrl : `${videoBaseUrl}/`;
                finalVideoUrl = `${baseUrl}${input.sku.replace(/\s+/g, '')}${ext}`;
            }
        } catch (e) { console.error('Failed to auto-generate video URL:', e); }
    }

    const companyId = await getCompanyId();

    const payload: any = {
        id,
        company_id: companyId,
        model_id: input.model_id,
        parent_id: input.parent_id ?? null,
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
        slug: input.slug || null,
        exclude_from_seo: input.exclude_from_seo ? 1 : 0,
        meta_title: input.meta_title || null,
        meta_description: input.meta_description || null,
        keywords: input.keywords ? input.keywords.join(',') : null,
        kits: input.kits && input.kits.length > 0 ? input.kits : null,
    };

    // Pegamos o oldProduct ANTES de atualizar para comparar preços e estoques
    let oldProduct: Product | null = null;
    try {
        oldProduct = await getById(id);
    } catch(e) {}

    const ok = await vpsApiService.updateProduct(id, payload);
    if (!ok) throw new Error(`Failed to update product in VPS`);

    // Garante persistência de NCM/CEST/Origin na VPS.
    // O PUT /products/:id pode não gravar esses campos (schema seletivo do servidor).
    // Usamos o POST /products/batch (upsert) que certamente processa todos os campos.
    if (payload.ncm || payload.cest || payload.origin) {
        const fiscalPatch = {
            id,
            company_id: payload.company_id,
            ncm: payload.ncm ?? null,
            cest: payload.cest ?? null,
            origin: payload.origin ?? null,
        };
        vpsApiService.syncProducts([fiscalPatch])
            .catch(e => console.warn('[productService] Fiscal sync via batch failed:', e));
    }

    // Log price change (usa Supabase — tabela price_history não está na VPS)
    try {
        if (oldProduct) {
            const pricesChanged =
                oldProduct.price_cost !== input.price_cost ||
                oldProduct.price_retail !== input.price_retail ||
                oldProduct.price_reseller !== input.price_reseller ||
                oldProduct.price_wholesale !== input.price_wholesale;
            if (pricesChanged) {
                await logPriceChange(id, {
                    price_cost: input.price_cost,
                    price_retail: input.price_retail,
                    price_reseller: input.price_reseller,
                    price_wholesale: input.price_wholesale,
                });
            }
        }
    } catch (logErr) {
        console.warn('[productService] Failed to log price change:', logErr);
    }

    // Shopee Sync Automático
    if (payload.shopee_item_id && oldProduct) {
        import('./shopeeService').then(({ shopeeService }) => {
            if (oldProduct.price_retail !== input.price_retail) {
                shopeeService.updatePrice(id, input.price_retail).catch(e => console.error("Shopee Price Sync Error:", e));
            }
            if (input.track_inventory && oldProduct.stock_quantity !== input.stock_quantity) {
                shopeeService.updateStock(id, input.stock_quantity || 0).catch(e => console.error("Shopee Stock Sync Error:", e));
            }
        });
    }

    return transformFromDB(payload);
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
    listChildren,
};
