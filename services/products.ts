import { Product, ProductInput } from '../types/product';
import { ProductStatus } from '../utils/field-standards';
import { supabase } from './supabase';

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

    const { data, error } = await supabase
        .from('products')
        .insert({
            company_id: companyId,
            category_id: input.category_id,
            brand_id: input.brand_id || null,
            model_id: input.model_id || null,
            name: input.name,
            sku: input.sku || null,
            description: input.description || null,
            ean: input.ean || null,
            alternative_eans: input.alternative_eans || [],
            specs: input.specs || {},
            price_cost: input.price_cost || null,
            price_retail: input.price_retail || null,
            price_reseller: input.price_reseller || null,
            price_wholesale: input.price_wholesale || null,
            ncm: input.ncm || null,
            cest: input.cest || null,
            origin: input.origin || null,
            weight_kg: input.weight_kg || null,
            dimensions: input.dimensions || null,
            stock_quantity: input.stock_quantity || 0
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create product: ${error.message}`);

    return transformFromDB(data);
}

/**
 * Update existing product
 */
async function update(id: string, input: ProductInput): Promise<Product> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('products')
        .update({
            category_id: input.category_id,
            brand_id: input.brand_id || null,
            model_id: input.model_id || null,
            name: input.name,
            sku: input.sku || null,
            description: input.description || null,
            ean: input.ean || null,
            alternative_eans: input.alternative_eans || [],
            specs: input.specs || {},
            price_cost: input.price_cost || null,
            price_retail: input.price_retail || null,
            price_reseller: input.price_reseller || null,
            price_wholesale: input.price_wholesale || null,
            ncm: input.ncm || null,
            cest: input.cest || null,
            origin: input.origin || null,
            weight_kg: input.weight_kg || null,
            dimensions: input.dimensions || null,
            stock_quantity: input.stock_quantity || 0
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update product: ${error.message}`);

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
 * Transform database row to Product type
 */
function transformFromDB(row: any): Product {
    return {
        id: row.id,
        category_id: row.category_id,
        brand_id: row.brand_id,
        model_id: row.model_id,
        brand: '', // Will be populated by join in future
        model: '', // Will be populated by join in future
        name: row.name,
        sku: row.sku,
        description: row.description,
        ean: row.ean,
        eans: row.alternative_eans || [],
        alternative_eans: row.alternative_eans || [],
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
        images: [], // Will be handled by storage in future
        status: ProductStatus.ACTIVE,
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
    searchByEAN
};
