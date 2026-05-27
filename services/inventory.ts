import { supabase } from './supabase';
import {
    StockMovement,
    StockAdjustmentInput,
    InventoryStats,
    InventoryFilters
} from '../types/inventory';
import { Product } from '../types/product';
import { vpsApiService } from './vpsApiService';

const INVENTORY_PRODUCT_SELECT = [
    'id',
    'name',
    'sku',
    'ean',
    'category_id',
    'price_cost',
    'price_retail',
    'price_reseller',
    'price_wholesale',
    'stock_quantity',
    'specs',
    'created_at'
].join(', ');

function normalizeStockQuantity(product: { stock_quantity?: number | string | null; specs?: Record<string, any> | null }): number {
    return Number(product.stock_quantity ?? product.specs?.stock_quantity ?? 0) || 0;
}

function escapeSearchTerm(value: string): string {
    return value.trim().replace(/[%_,]/g, '\\$&').toLowerCase();
}

function buildProductSearchFilter(searchTerm: string): string {
    return [
        `name.ilike.%${searchTerm}%`,
        `sku.ilike.%${searchTerm}%`,
        `ean.ilike.%${searchTerm}%`,
        `specs->>imei1.ilike.%${searchTerm}%`,
        `specs->>imei2.ilike.%${searchTerm}%`,
        `specs->>serial.ilike.%${searchTerm}%`
    ].join(',');
}

async function loadInventoryProducts(): Promise<Product[]> {
    const rows = await vpsApiService.getProducts({
        status: 'all',
        limit: 5000,
        noCache: true,
    });

    return (rows || []).map((p: any) => ({
        ...p,
        stock_quantity: normalizeStockQuantity(p)
    }));
}

function matchesSearch(product: Product, search: string): boolean {
    const term = escapeSearchTerm(search);
    const specs = (product as any).specs || {};
    return [
        product.name,
        product.sku,
        (product as any).ean,
        specs.imei1,
        specs.imei2,
        specs.serial
    ].some(value => String(value || '').toLowerCase().includes(term));
}

function applyInventoryFilters(products: Product[], filters: InventoryFilters = {}): Product[] {
    let result = [...products];

    if (filters.search) {
        result = result.filter(product => matchesSearch(product, filters.search!));
    }

    if (filters.category_id) {
        result = result.filter(product => product.category_id === filters.category_id);
    }

    if (filters.brand) {
        result = result.filter(product => (product as any).specs?.brand === filters.brand);
    }

    if (filters.status) {
        result = result.filter(product => (product as any).specs?.unit_status === filters.status);
    }

    if (filters.only_available) {
        result = result.filter(product => (product.stock_quantity || 0) > 0);
    }

    return result;
}

function sortInventoryProducts(products: Product[], filters: InventoryFilters = {}): Product[] {
    const sortBy = filters.sort_by || 'name';
    const sortOrder = filters.sort_order || 'asc';
    const direction = sortOrder === 'asc' ? 1 : -1;

    return [...products].sort((a, b) => {
        if (sortBy === 'quantity') {
            return ((a.stock_quantity || 0) - (b.stock_quantity || 0)) * direction;
        }
        if (sortBy === 'value') {
            const valueA = (a.stock_quantity || 0) * (a.price_cost || 0);
            const valueB = (b.stock_quantity || 0) * (b.price_cost || 0);
            return (valueA - valueB) * direction;
        }
        const aValue = String((a as any)[sortBy] || '');
        const bValue = String((b as any)[sortBy] || '');
        return aValue.localeCompare(bValue) * direction;
    });
}

/**
 * Inventory Service
 * Manages stock movements and inventory operations
 * 
 * ANTIGRAVITY PROTOCOL:
 * - All operations are company-scoped
 * - Stock movements are immutable (audit trail)
 * - Real-time stock updates
 */
class InventoryService {
    /**
     * Get inventory with filters
     */
    async getInventory(filters: InventoryFilters = {}): Promise<Product[]> {
        return sortInventoryProducts(applyInventoryFilters(await loadInventoryProducts(), filters), filters);
    }

    /**
     * Get inventory grouped by product model
     * Serialized products (with IMEI/Serial) are grouped by brand+model+color+storage
     * Non-serialized products show as individual groups
     */
    async getInventoryGrouped(filters: InventoryFilters = {}): Promise<import('../types/inventory').InventoryGroup[]> {
        const products = applyInventoryFilters(await loadInventoryProducts(), filters);

        // Group products
        const groups = new Map<string, import('../types/inventory').InventoryGroup>();

        products.forEach(product => {
            const isSerialized = !!(
                product.specs?.imei1 ||
                product.specs?.imei2 ||
                product.specs?.serial
            );

            // Create group key
            let groupKey: string;
            if (isSerialized) {
                // Group by brand+model+color+storage
                groupKey = [
                    product.specs?.brand,
                    product.specs?.model,
                    product.specs?.color,
                    product.specs?.storage
                ].filter(Boolean).join('|').toLowerCase();
            } else {
                // Non-serialized: each product is its own group
                groupKey = product.id;
            }

            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    product_key: groupKey,
                    name: product.name,
                    category_id: product.category_id,
                    brand: product.specs?.brand || '',
                    model: product.specs?.model || '',
                    color: product.specs?.color,
                    storage: product.specs?.storage,
                    ram: product.specs?.ram,
                    total_units: 0,
                    available: 0,
                    reserved: 0,
                    sold: 0,
                    in_maintenance: 0,
                    defective: 0,
                    is_serialized: isSerialized,
                    price_cost: product.price_cost,
                    price_retail: product.price_retail,
                    price_reseller: product.price_reseller,
                    price_wholesale: product.price_wholesale,
                    units: isSerialized ? [] : undefined
                });
            }

            const group = groups.get(groupKey)!;
            const stockQuantity = Math.max(0, normalizeStockQuantity(product));

            // Count by status
            const status = product.specs?.unit_status || 'available';
            group.total_units += isSerialized ? 1 : stockQuantity;

            switch (status) {
                case 'available': group.available += isSerialized ? 1 : stockQuantity; break;
                case 'reserved': group.reserved += isSerialized ? 1 : stockQuantity; break;
                case 'sold': group.sold += isSerialized ? 1 : stockQuantity; break;
                case 'maintenance': group.in_maintenance += isSerialized ? 1 : stockQuantity; break;
                case 'defective': group.defective += isSerialized ? 1 : stockQuantity; break;
            }

            // Add to units list if serialized
            if (isSerialized && group.units) {
                group.units.push({
                    id: product.id,
                    imei1: product.specs?.imei1,
                    imei2: product.specs?.imei2,
                    serial: product.specs?.serial,
                    unit_status: status as import('../types/inventory').UnitStatus,
                    created_at: product.created_at,
                    notes: product.specs?.notes
                });
            }
        });

        let result = Array.from(groups.values());

        // Apply post-filters
        if (filters.only_serialized) {
            result = result.filter(g => g.is_serialized);
        }
        if (filters.only_non_serialized) {
            result = result.filter(g => !g.is_serialized);
        }
        if (filters.only_available) {
            result = result.filter(g => g.available > 0);
        }

        // Sort
        const sortBy = filters.sort_by || 'name';
        const sortOrder = filters.sort_order || 'asc';

        result.sort((a, b) => {
            let compareValue = 0;

            switch (sortBy) {
                case 'name':
                    compareValue = a.name.localeCompare(b.name);
                    break;
                case 'quantity':
                    compareValue = a.total_units - b.total_units;
                    break;
                case 'value':
                    const valueA = a.total_units * a.price_cost;
                    const valueB = b.total_units * b.price_cost;
                    compareValue = valueA - valueB;
                    break;
            }

            return sortOrder === 'asc' ? compareValue : -compareValue;
        });

        return result;
    }

    /**
     * Get inventory statistics
     */
    async getStats(): Promise<InventoryStats> {
        const products = await loadInventoryProducts();

        const stats: InventoryStats = {
            total_products: products.length,
            total_units: 0,
            serialized_groups: 0,
            non_serialized_groups: 0,
            available: 0,
            reserved: 0,
            sold: 0,
            in_maintenance: 0,
            defective: 0,
            in_stock: 0,
            low_stock: 0,
            out_of_stock: 0,
            not_tracked: 0,
            total_value: 0
        };

        products.forEach(product => {
            const isSerialized = !!(
                product.specs?.imei1 ||
                product.specs?.imei2 ||
                product.specs?.serial
            );

            if (isSerialized) {
                stats.serialized_groups++;
                stats.total_units++;

                // Count by status
                const status = product.specs?.unit_status || 'available';
                switch (status) {
                    case 'available': stats.available++; break;
                    case 'reserved': stats.reserved++; break;
                    case 'sold': stats.sold++; break;
                    case 'maintenance': stats.in_maintenance++; break;
                    case 'defective': stats.defective++; break;
                }

                // Value (only available units)
                if (status === 'available') {
                    stats.total_value += product.price_cost || 0;
                }
            } else {
                stats.non_serialized_groups++;

                const qty = Math.max(0, normalizeStockQuantity(product));
                stats.total_units += qty;

                if (qty === 0) {
                    stats.out_of_stock++;
                } else if (qty <= 10) {
                    stats.low_stock++;
                } else {
                    stats.in_stock++;
                }

                // Calculate total value (quantity × cost)
                stats.total_value += qty * (product.price_cost || 0);
            }
        });

        return stats;
    }

    /**
     * Adjust stock for a product
     */
    async adjustStock(adjustment: StockAdjustmentInput): Promise<void> {
        // Get current product
        const product = await vpsApiService.getProductById(adjustment.product_id, true);

        if (!product) {
            throw new Error('Product not found');
        }

        const previousQty = normalizeStockQuantity(product);
        let newQty = previousQty;

        // Calculate new quantity based on type
        switch (adjustment.type) {
            case 'in':
                newQty = previousQty + adjustment.quantity;
                break;
            case 'out':
                newQty = Math.max(0, previousQty - adjustment.quantity);
                break;
            case 'adjustment':
                newQty = adjustment.quantity; // Direct set
                break;
        }

        // Start transaction
        const { data: user } = await supabase.auth.getUser();
        const userId = user?.user?.id;

        // Get company_id from user
        const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', userId)
            .single();

        if (!userData?.company_id) {
            throw new Error('User company not found');
        }

        // Update product stock
        const { error: updateError } = await supabase
            .from('products')
            .update({ stock_quantity: newQty })
            .eq('id', adjustment.product_id);

        if (updateError) {
            throw updateError;
        }

        // Record movement
        const movement: Partial<StockMovement> = {
            company_id: userData.company_id,
            product_id: adjustment.product_id,
            type: adjustment.type,
            quantity: adjustment.quantity,
            previous_quantity: previousQty,
            new_quantity: newQty,
            reason: adjustment.reason,
            notes: adjustment.notes,
            reference_id: adjustment.reference_id,
            created_by: userId
        };

        const { error: movementError } = await supabase
            .from('stock_movements')
            .insert(movement);

        if (movementError) {
            console.error('Error recording stock movement:', movementError);
            // Rollback product update
            await supabase
                .from('products')
                .update({ stock_quantity: previousQty })
                .eq('id', adjustment.product_id);
            throw movementError;
        }
    }

    /**
     * Get stock movement history for a product
     */
    async getMovements(productId: string, limit: number = 50): Promise<StockMovement[]> {
        const { data, error } = await supabase
            .from('stock_movements')
            .select('*')
            .eq('product_id', productId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching stock movements:', error);
            throw error;
        }

        return data || [];
    }

    /**
     * Get products with low stock
     */
    async getLowStockProducts(threshold: number = 10): Promise<Product[]> {
        // Filter and sort in memory because low-stock thresholds are dynamic.
        const products = (await loadInventoryProducts())
            .filter(p => {
                const qty = p.stock_quantity || 0;
                return qty > 0 && qty <= threshold;
            })
            .sort((a, b) => (a.stock_quantity || 0) - (b.stock_quantity || 0));

        return products;
    }

    /**
     * Get all unique brands from inventory
     */
    async getBrands(): Promise<string[]> {
        const products = await loadInventoryProducts();
        const brands = [...new Set(products.map(p => (p as any).specs?.brand).filter(Boolean))];
        return brands.sort();
    }
}

export const inventoryService = new InventoryService();
