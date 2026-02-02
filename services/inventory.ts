import { supabase } from './supabase';
import {
    StockMovement,
    StockAdjustmentInput,
    InventoryStats,
    InventoryFilters
} from '../types/inventory';
import { Product } from '../types/product';

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
        let query = supabase
            .from('products')
            .select('*');
        // Note: Not filtering by track_inventory since it doesn't exist in online DB
        // All products are considered for inventory

        // Search filter (name, SKU, EAN, IMEI1)
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            query = query.or(`
                name.ilike.%${searchTerm}%,
                sku.ilike.%${searchTerm}%,
                specs->>imei1.ilike.%${searchTerm}%
            `);
        }

        // Category filter
        if (filters.category_id) {
            query = query.eq('category_id', filters.category_id);
        }

        // Brand filter (from specs)
        if (filters.brand) {
            query = query.eq('specs->>brand', filters.brand);
        }

        // Only available in stock (check specs->stock_quantity)
        if (filters.only_available) {
            // This will need to be handled in post-processing since we can't easily filter JSONB numbers
            // For now, we'll fetch all and filter in memory
        }

        // Sorting
        const sortBy = filters.sort_by || 'name';
        const sortOrder = filters.sort_order || 'asc';

        if (sortBy === 'quantity' || sortBy === 'value') {
            // Can't sort by JSONB fields directly, will sort in memory
            query = query.order('name', { ascending: true });
        } else {
            query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching inventory:', error);
            throw error;
        }

        let products = (data || []).map(p => ({
            ...p,
            stock_quantity: parseInt(p.specs?.stock_quantity || '0', 10)
        }));

        // Post-process filters
        if (filters.only_available) {
            products = products.filter(p => (p.stock_quantity || 0) > 0);
        }

        // Post-process sorting
        if (sortBy === 'quantity') {
            products.sort((a, b) => {
                const qtyA = a.stock_quantity || 0;
                const qtyB = b.stock_quantity || 0;
                return sortOrder === 'asc' ? qtyA - qtyB : qtyB - qtyA;
            });
        } else if (sortBy === 'value') {
            products.sort((a, b) => {
                const valueA = (a.stock_quantity || 0) * (a.price_cost || 0);
                const valueB = (b.stock_quantity || 0) * (b.price_cost || 0);
                return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
            });
        }

        return products;
    }

    /**
     * Get inventory grouped by product model
     * Serialized products (with IMEI/Serial) are grouped by brand+model+color+storage
     * Non-serialized products show as individual groups
     */
    async getInventoryGrouped(filters: InventoryFilters = {}): Promise<import('../types/inventory').InventoryGroup[]> {
        let query = supabase
            .from('products')
            .select('*');

        // Apply filters
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            query = query.or(`
                name.ilike.%${searchTerm}%,
                sku.ilike.%${searchTerm}%,
                specs->>imei1.ilike.%${searchTerm}%,
                specs->>imei2.ilike.%${searchTerm}%,
                specs->>serial.ilike.%${searchTerm}%
            `);
        }

        if (filters.category_id) {
            query = query.eq('category_id', filters.category_id);
        }

        if (filters.brand) {
            query = query.eq('specs->>brand', filters.brand);
        }

        if (filters.status) {
            query = query.eq('unit_status', filters.status);
        }

        const { data: products, error } = await query;

        if (error) {
            console.error('Error fetching inventory for grouping:', error);
            throw error;
        }

        // Group products
        const groups = new Map<string, import('../types/inventory').InventoryGroup>();

        products?.forEach(product => {
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

            // Count by status
            const status = product.unit_status || 'available';
            group.total_units++;

            switch (status) {
                case 'available': group.available++; break;
                case 'reserved': group.reserved++; break;
                case 'sold': group.sold++; break;
                case 'maintenance': group.in_maintenance++; break;
                case 'defective': group.defective++; break;
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
        const { data: products, error } = await supabase
            .from('products')
            .select('specs, price_cost, unit_status');

        if (error) {
            console.error('Error fetching inventory stats:', error);
            throw error;
        }

        const stats: InventoryStats = {
            total_products: products?.length || 0,
            total_units: products?.length || 0,
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

        products?.forEach(product => {
            const isSerialized = !!(
                product.specs?.imei1 ||
                product.specs?.imei2 ||
                product.specs?.serial
            );

            if (isSerialized) {
                stats.serialized_groups++;

                // Count by status
                const status = product.unit_status || 'available';
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

                const qty = parseInt(product.specs?.stock_quantity || '0', 10);

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
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('stock_quantity, track_inventory')
            .eq('id', adjustment.product_id)
            .single();

        if (fetchError || !product) {
            throw new Error('Product not found');
        }

        if (!product.track_inventory) {
            throw new Error('Product does not track inventory');
        }

        const previousQty = product.stock_quantity || 0;
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
        const { data, error } = await supabase
            .from('products')
            .select('*');

        if (error) {
            console.error('Error fetching low stock products:', error);
            throw error;
        }

        // Filter and sort in memory since stock_quantity is in specs
        const products = (data || [])
            .map(p => ({
                ...p,
                stock_quantity: parseInt(p.specs?.stock_quantity || '0', 10)
            }))
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
        const { data, error } = await supabase
            .from('products')
            .select('specs');

        if (error) {
            console.error('Error fetching brands:', error);
            return [];
        }

        const brands = [...new Set(data?.map(p => p.specs?.brand).filter(Boolean))];
        return brands.sort();
    }
}

export const inventoryService = new InventoryService();
