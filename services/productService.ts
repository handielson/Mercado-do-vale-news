/**
 * Product Service
 * Service for searching and managing products
 */

import { supabase } from './supabase';
import { Product } from '../types/product';

/**
 * Search products by multiple criteria
 * Searches in: name, sku, eans (array), imei1, imei2
 */
export const searchProducts = async (searchTerm: string): Promise<Product[]> => {
    try {
        if (!searchTerm.trim()) {
            return [];
        }

        const term = searchTerm.trim().toLowerCase();
        console.log('🔍 Buscando produtos com termo:', term);

        // Build query with OR conditions - apenas name e sku
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
            .order('name', { ascending: true })
            .limit(20);

        if (error) {
            console.error('❌ Erro na busca principal:', error);
            throw error;
        }

        console.log('✅ Resultados da busca principal:', data?.length || 0);
        if (data && data.length > 0) {
            console.log('📦 Primeiro produto encontrado:', data[0].name);
        }

        // Retornar resultados
        return data || [];
    } catch (error) {
        console.error('❌ Error searching products:', error);
        throw error;
    }
};

/**
 * Get product by ID
 */
export const getProductById = async (id: string): Promise<Product | null> => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching product:', error);
        throw error;
    }
};

/**
 * Get product by SKU
 */
export const getProductBySku = async (sku: string): Promise<Product | null> => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('sku', sku)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }
        return data;
    } catch (error) {
        console.error('Error fetching product by SKU:', error);
        throw error;
    }
};

/**
 * Get product by IMEI (searches both imei1 and imei2)
 */
export const getProductByImei = async (imei: string): Promise<Product | null> => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .or(`imei1.eq.${imei},imei2.eq.${imei}`)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }
        return data;
    } catch (error) {
        console.error('Error fetching product by IMEI:', error);
        throw error;
    }
};

/**
 * Get product by barcode (EAN)
 */
export const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .contains('eans', [barcode])
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }
        return data;
    } catch (error) {
        console.error('Error fetching product by barcode:', error);
        throw error;
    }
};
