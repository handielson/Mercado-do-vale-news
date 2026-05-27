/**
 * Product Service (PDV)
 * Simplified search service for the Point of Sale screen.
 * Fonte primária: VPS MySQL (via vpsApiService).
 */

import { Product } from '../types/product';
import { vpsApiService } from './vpsApiService';

function asProduct(row: unknown): Product | null {
    if (!row || typeof row !== 'object') return null;
    return row as Product;
}

function isActiveProduct(product: Product | null): product is Product {
    if (!product) return false;
    const status = String((product as any).status || '').toLowerCase();
    const isActive = (product as any).is_active;
    return status === 'active' || isActive === true || isActive == null;
}

function productHasIdentifier(product: Product, identifier: string): boolean {
    const specs = (product as any).specs || {};
    const normalized = identifier.trim().toLowerCase();
    return [specs.imei1, specs.imei2, specs.serial, specs.serial_number]
        .filter(Boolean)
        .some((value) => String(value).trim().toLowerCase() === normalized);
}

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
    const data = await vpsApiService.getProductById(id, true);
    return asProduct(data);
};

/**
 * Get product by SKU
 */
export const getProductBySku = async (sku: string): Promise<Product | null> => {
    const normalizedSku = sku.trim().toLowerCase();
    if (!normalizedSku) return null;

    const products = await vpsApiService.getProducts({
        sku: sku.trim(),
        status: 'active',
        limit: 5,
        noCache: true,
    });

    const exact = (products || [])
        .map(asProduct)
        .find((product) => isActiveProduct(product) && product.sku?.trim().toLowerCase() === normalizedSku);

    return exact || null;
};

/**
 * Get product by IMEI (searches both imei1 and imei2)
 */
export const getProductByImei = async (imei: string): Promise<Product | null> => {
    const normalizedImei = imei.trim();
    if (!normalizedImei) return null;

    const products = await vpsApiService.getProducts({
        search: normalizedImei,
        status: 'active',
        limit: 10,
        noCache: true,
    });

    const exact = (products || [])
        .map(asProduct)
        .find((product) => isActiveProduct(product) && productHasIdentifier(product, normalizedImei));

    return exact || null;
};

/**
 * Get product by barcode (EAN)
 */
export const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
    const normalizedBarcode = barcode.trim();
    if (!normalizedBarcode) return null;

    const products = await vpsApiService.getProductByEan(normalizedBarcode);
    return (products || [])
        .map(asProduct)
        .find(isActiveProduct) || null;
};
