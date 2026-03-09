import { Product, ProductInput } from '../types/product';
import { ProductStatus } from '../utils/field-standards';
import { supabase } from './supabase';
import { logPriceChange } from './priceHistoryService';

/**
 * PRODUCT SERVICE - Supabase Implementation
 * Multi-tenant service with Row Level Security
 */

// TEMPORARY: Hardcoded company_id until we implement auth
const TEMP_COMPANY_ID = 'mercado-do-vale';

/**
 * Get company_id from companies table by slug
 */
async function getCompanyId(): Promise<string> {
    const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', TEMP_COMPANY_ID)
        .single();

    if (error) throw new Error(`Failed to get company: ${error.message}`);
    return data.id;
}

/**
 * List all products
 */
async function list(): Promise<Product[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

    if (error) throw new Error(`Failed to fetch products: ${error.message}`);

    return (data || []).map(transformFromDB);
}

/**
 * Get product by ID
 */
async function getById(id: string): Promise<Product | null> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch product: ${error.message}`);
    }

    console.log('🔍 [productService.getById] Raw database data:', data);
    console.log('🔍 [productService.getById] data.specs:', data.specs);
    console.log('🔍 [productService.getById] typeof data.specs:', typeof data.specs);

    return transformFromDB(data);
}

/**
 * Get product by EAN
 */
async function getByEan(ean: string): Promise<Product | null> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .eq('ean', ean)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch product by EAN: ${error.message}`);
    }

    return transformFromDB(data);
}

/**
 * Create new product
 */
async function create(input: ProductInput): Promise<Product> {
    const companyId = await getCompanyId();

    // Validate model_id is provided
    if (!input.model_id || input.model_id.trim() === '') {
        throw new Error('Model ID é obrigatório. Por favor, escaneie um EAN ou selecione um modelo.');
    }

    // Validate SKU uniqueness
    if (input.sku) {
        const { data: existing } = await supabase
            .from('products')
            .select('id, name')
            .eq('company_id', companyId)
            .eq('sku', input.sku)
            .maybeSingle();
        if (existing) {
            throw new Error(`SKU "${input.sku}" já está em uso pelo produto "${existing.name}". Cada produto deve ter um SKU único.`);
        }
    }

    // Fetch model data to populate brand, category, dimensions
    const { data: modelData, error: modelError } = await supabase
        .from('models')
        .select(`
            id,
            name,
            brand_id,
            category_id,
            template_values,
            brand:brands(name)
        `)
        .eq('id', input.model_id)
        .single();

    if (modelError) throw new Error(`Failed to fetch model: ${modelError.message}`);

    // Merge model data with input
    const brand = (modelData.brand as any)?.[0]?.name || input.brand;
    const category_id = modelData.category_id || input.category_id;
    const dimensions = input.dimensions || modelData.template_values?.dimensions;
    const weight_kg = input.weight_kg || modelData.template_values?.weight_kg;

    const { data, error } = await supabase
        .from('products')
        .insert({
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
            specs: input.specs || {},
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
            track_inventory: input.track_inventory,
            is_gift: input.is_gift || false,
            warranty_type: input.warranty_type || 'brand',
            warranty_template_id: input.warranty_template_id || null,
            price_promo: input.price_promo || null,
            promo_start: input.promo_start || null,
            promo_end: input.promo_end || null,
            bling_id: input.bling_id || null,
            bling_parent_id: input.bling_parent_id || null,
            // SEO Additions
            slug: input.slug || null,
            meta_title: input.meta_title || null,
            meta_description: input.meta_description || null,
            seo_keywords: input.seo_keywords || [],
        })
        .select('*')
        .single();

    if (error) throw new Error(`Failed to create product: ${error.message}`);

    return transformFromDB(data);
}

/**
 * Update existing product
 */
async function update(id: string, input: ProductInput): Promise<Product> {
    const companyId = await getCompanyId();

    // Validate model_id is provided
    if (!input.model_id || input.model_id.trim() === '') {
        throw new Error('Model ID é obrigatório. Por favor, escaneie um EAN ou selecione um modelo.');
    }

    // Validate SKU uniqueness (excluding self)
    if (input.sku) {
        const { data: existing } = await supabase
            .from('products')
            .select('id, name')
            .eq('company_id', companyId)
            .eq('sku', input.sku)
            .neq('id', id)
            .maybeSingle();
        if (existing) {
            throw new Error(`SKU "${input.sku}" já está em uso pelo produto "${existing.name}". Cada produto deve ter um SKU único.`);
        }
    }

    // Fetch model data to populate brand, category, dimensions
    const { data: modelData, error: modelError } = await supabase
        .from('models')
        .select(`
            id,
            name,
            brand_id,
            category_id,
            template_values,
            brand:brands(name)
        `)
        .eq('id', input.model_id)
        .single();

    if (modelError) throw new Error(`Failed to fetch model: ${modelError.message}`);

    // Merge model data with input
    const brand = (modelData.brand as any)?.[0]?.name || input.brand;
    const category_id = modelData.category_id || input.category_id;
    const dimensions = input.dimensions || modelData.template_values?.dimensions;
    const weight_kg = input.weight_kg || modelData.template_values?.weight_kg;

    const { data, error } = await supabase
        .from('products')
        .update({
            model_id: input.model_id,
            parent_id: input.parent_id ?? null,
            brand,
            category_id,
            name: input.name,
            sku: input.sku || null,
            description: input.description || null,
            ean: input.eans?.[0] || null,
            alternative_eans: input.eans || [],
            specs: input.specs || {},
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
            track_inventory: input.track_inventory,
            is_gift: input.is_gift || false,
            warranty_type: input.warranty_type || 'brand',
            warranty_template_id: input.warranty_template_id || null,
            price_promo: input.price_promo || null,
            promo_start: input.promo_start || null,
            promo_end: input.promo_end || null,
            bling_id: input.bling_id || null,
            bling_parent_id: input.bling_parent_id || null,
            // SEO Additions
            slug: input.slug || null,
            meta_title: input.meta_title || null,
            meta_description: input.meta_description || null,
            seo_keywords: input.seo_keywords || [],
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update product: ${error.message}`);

    // Log price change if any price field changed
    try {
        const oldProduct = await getById(id);
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

    return transformFromDB(data);
}

/**
 * Delete product
 */
async function deleteProduct(id: string): Promise<void> {
    const companyId = await getCompanyId();

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to delete product: ${error.message}`);
}

/**
 * Search products by name or EAN
 */
async function search(query: string): Promise<Product[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .or(`name.ilike.%${query}%,ean.ilike.%${query}%,sku.ilike.%${query}%`)
        .order('name')
        .limit(50);

    if (error) throw new Error(`Failed to search products: ${error.message}`);

    return (data || []).map(transformFromDB);
}

/**
 * Search products by EAN (returns array for bulk operations)
 */
async function searchByEAN(ean: string): Promise<Product[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .eq('ean', ean)
        .limit(10); // Allow multiple products with same EAN

    if (error) throw new Error(`Failed to search by EAN: ${error.message}`);

    return (data || []).map(transformFromDB);
}

/**
 * List children (variations) of a parent product
 */
async function listChildren(parentId: string): Promise<Product[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .eq('parent_id', parentId)
        .order('name');

    if (error) throw new Error(`Failed to fetch product children: ${error.message}`);
    return (data || []).map(transformFromDB);
}

/**
 * Transform database row to Product type
 */
function transformFromDB(row: any): Product {
    return {
        id: row.id,
        model_id: row.model_id,
        model: '', // Will be populated when needed
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
        track_inventory: row.track_inventory !== false,
        is_gift: row.is_gift || false,
        warranty_type: row.warranty_type || 'brand',
        warranty_template_id: row.warranty_template_id || null,
        parent_id: row.parent_id || undefined,
        bling_id: row.bling_id || undefined,
        bling_parent_id: row.bling_parent_id || undefined,
        price_promo: row.price_promo || undefined,
        promo_start: row.promo_start || undefined,
        promo_end: row.promo_end || undefined,
        slug: row.slug || undefined,
        meta_title: row.meta_title || undefined,
        meta_description: row.meta_description || undefined,
        created: row.created_at,
        updated: row.updated_at
    };
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
    listChildren
};
