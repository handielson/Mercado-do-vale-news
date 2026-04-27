/**
 * Product Service (PDV)
 * Simplified search service for the Point of Sale screen.
 * Fonte primária: VPS MySQL (via vpsApiService).
 * Supabase: backup apenas.
 */

import { supabase } from './supabase';
import { Product } from '../types/product';
import { vpsApiService } from './vpsApiService';

// Cache global de companyId em ./companyContext (lê VITE_COMPANY_ID, fallback Supabase).
import { getCompanyId } from './companyContext';

/**
 * Search products by multiple criteria.
 * Usa a VPS como fonte primária (MySQL).
 * Busca: name, sku, ean, model_id, slug
 */
export const searchProducts = async (searchTerm: string): Promise<Product[]> => {
    if (!searchTerm.trim()) return [];

    const term = searchTerm.trim();

    const results = await vpsApiService.getProducts({
        search: term,
        status: 'active',
        limit: 50,
        compact: true,
        noCache: true,
    });

    if (!results) throw new Error('Falha ao buscar produtos na VPS');
    return results as Product[];
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
