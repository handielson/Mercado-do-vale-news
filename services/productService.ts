/**
 * Product Service (PDV)
 * Simplified search service for the Point of Sale screen.
 * Uses company_id filter explicitly for clarity (RLS also enforces this).
 */

import { supabase } from './supabase';
import { Product } from '../types/product';

const COMPANY_SLUG = 'mercado-do-vale';

async function getCompanyId(): Promise<string> {
    const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', COMPANY_SLUG)
        .single();

    if (error) throw new Error(`Failed to get company: ${error.message}`);
    return data.id;
}

/**
 * Search products by multiple criteria within the company.
 * Searches: name, sku, serial, imei1, imei2
 */
export const searchProducts = async (searchTerm: string): Promise<Product[]> => {
    if (!searchTerm.trim()) return [];

    const term = searchTerm.trim().toLowerCase();
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .or(`name.ilike.%${term}%,sku.ilike.%${term}%,specs->>serial.ilike.%${term}%,specs->>imei1.ilike.%${term}%,specs->>imei2.ilike.%${term}%`)
        .order('name', { ascending: true })
        .limit(20);

    if (error) throw new Error(`Failed to search products: ${error.message}`);
    return data || [];
};

/**
 * Get product by ID
 */
export const getProductById = async (id: string): Promise<Product | null> => {
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
    return data;
};

/**
 * Get product by SKU
 */
export const getProductBySku = async (sku: string): Promise<Product | null> => {
    const companyId = await getCompanyId();
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('sku', sku)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch product by SKU: ${error.message}`);
    }
    return data;
};

/**
 * Get product by IMEI (searches both imei1 and imei2)
 */
export const getProductByImei = async (imei: string): Promise<Product | null> => {
    const companyId = await getCompanyId();
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .or(`specs->>imei1.eq.${imei},specs->>imei2.eq.${imei}`)
        .eq('is_active', true)
        .limit(1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch product by IMEI: ${error.message}`);
    }
    return data;
};

/**
 * Get product by barcode (EAN)
 */
export const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
    const companyId = await getCompanyId();
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .contains('eans', [barcode])
        .eq('is_active', true)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch product by barcode: ${error.message}`);
    }
    return data;
};
