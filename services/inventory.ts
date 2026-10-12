import { getCurrentAuthUserId } from './authSession';
import {
    StockMovement,
    StockAdjustmentInput,
    InventoryStats,
    InventoryFilters
} from '../types/inventory';
import { Product } from '../types/product';
import { vpsApiService } from './vpsApiService';
import { vpsClient } from './vpsClient';
import { getCompanyId } from './companyContext';
import { buildInventoryCategoryRows } from '../utils/inventoryCategoryReport.mjs';
import { getEffectiveRetailPrice } from '../utils/promoPrice';

interface TableDataResponse<T> {
    rows?: T[];
}

interface UserCompanyRow {
    id?: string;
    company_id?: string | null;
}

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

function createLocalId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function loadStockMovementRows(): Promise<StockMovement[]> {
    const allRows: StockMovement[] = [];
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse<StockMovement>>(
            `/table-data/stock_movements?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return allRows;
}

async function loadUserCompanyId(userId?: string): Promise<string | null> {
    if (!userId) return null;
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse<UserCompanyRow>>(
            `/table-data/users?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        const user = rows.find(row => String(row.id || '') === String(userId));
        if (user) return user.company_id ? String(user.company_id) : null;
        if (rows.length < pageSize) break;
    }

    return null;
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

async function loadInventoryProducts(categoryId?: string): Promise<Product[]> {
    const rows: Product[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
        const page = await vpsApiService.getProducts({
            status: 'all', category: categoryId, compact: true,
            limit: pageSize, offset, noCache: true,
        });
        if (!Array.isArray(page)) throw new Error('Não foi possível carregar o estoque completo.');
        rows.push(...page);
        if (page.length < pageSize) break;
    }

    return (rows || []).map((p: any) => ({
        ...p,
        stock_quantity: normalizeStockQuantity(p)
    }));
}

function inventoryUnitStatus(status: string): string {
    return status === 'rma' ? 'maintenance' : status === 'scrapped' ? 'defective' : status;
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
        result = result.filter(product => {
            const units = (product as any).inventory_units;
            if (Array.isArray(units) && units.length) {
                return units.some(unit => inventoryUnitStatus(unit.status) === filters.status);
            }
            const status = product.specs?.unit_status || (normalizeStockQuantity(product) > 0 ? 'available' : undefined);
            return status === filters.status;
        });
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
    async getCategoryStockReport(categoryId: string, categoryIds = [categoryId]) {
        if (!categoryId) throw new Error('Selecione uma categoria.');
        const companyId = await getCompanyId();
        const units = await vpsClient.get<any[]>(`/units?company_id=${encodeURIComponent(companyId)}&status=all&_t=${Date.now()}`);
        if (!Array.isArray(units)) throw new Error('Resposta inválida de unidades.');
        const products: Product[] = [];
        const pageSize = 500;
        for (let offset = 0; ; offset += pageSize) {
            const query = new URLSearchParams({ category: categoryIds.join(','), status: 'all', compact: 'true',
                limit: String(pageSize), offset: String(offset), _t: String(Date.now()) });
            const page = await vpsClient.get<Product[]>(`/products?${query}`);
            if (!Array.isArray(page)) throw new Error('Resposta inválida de produtos.');
            products.push(...page);
            if (page.length < pageSize) break;
        }
        return buildInventoryCategoryRows(products.map(product => ({ ...product,
            report_sale_price: product.price_retail == null && product.price_promo == null
                ? null : getEffectiveRetailPrice(product),
        })), units, categoryIds);
    }

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
        const companyId = await getCompanyId();
        const [allProducts, units] = await Promise.all([
            loadInventoryProducts(filters.category_id),
            vpsClient.get<any[]>(`/units?company_id=${encodeURIComponent(companyId)}&status=all&_t=${Date.now()}`),
        ]);
        if (!Array.isArray(units)) throw new Error('Resposta inválida de unidades.');
        const unitsByProduct = new Map<string, any[]>();
        for (const unit of units) {
            const list = unitsByProduct.get(unit.product_id) || [];
            list.push(unit);
            unitsByProduct.set(unit.product_id, list);
        }
        const products = applyInventoryFilters(allProducts.map(product => {
            const productUnits = unitsByProduct.get(product.id);
            return productUnits ? { ...product, inventory_units: productUnits,
                stock_quantity: productUnits.filter(unit => unit.status === 'available').length } : product;
        }), filters);

        // Group products
        const groups = new Map<string, import('../types/inventory').InventoryGroup>();

        products.forEach(product => {
            const unitHistory: any[] | undefined = (product as any).inventory_units;
            const matchingUnits = unitHistory?.filter(unit => !filters.status || inventoryUnitStatus(unit.status) === filters.status);
            const isSerialized = !!(
                unitHistory?.length ||
                product.specs?.imei1 ||
                product.specs?.imei2 ||
                product.specs?.serial
            );

            // Create group key
            let groupKey: string;
            if (unitHistory?.length) {
                groupKey = product.id;
            } else if (isSerialized) {
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

            if (unitHistory?.length) {
                for (const unit of matchingUnits || []) {
                    group.total_units++;
                    switch (unit.status) {
                        case 'available': group.available++; break;
                        case 'reserved': group.reserved++; break;
                        case 'sold': group.sold++; break;
                        case 'rma': case 'maintenance': group.in_maintenance++; break;
                        case 'scrapped': case 'defective': group.defective++; break;
                    }
                    group.units!.push({ id: unit.id, imei1: unit.imei_1, imei2: unit.imei_2,
                        serial: unit.serial, unit_status: inventoryUnitStatus(unit.status) as import('../types/inventory').UnitStatus, created_at: unit.created_at,
                        notes: unit.internal_notes });
                }
                return;
            }

            // Count by status
            const status = product.specs?.unit_status || 'available';
            group.total_units += isSerialized && status !== 'available' ? 1 : stockQuantity;

            switch (status) {
                case 'available': group.available += stockQuantity; break;
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
        const userId = await getCurrentAuthUserId();

        const companyId = await loadUserCompanyId(userId);

        if (!companyId) {
            throw new Error('User company not found');
        }

        const updated = await vpsApiService.updateProduct(adjustment.product_id, {
            ...product,
            stock_quantity: newQty
        });

        if (!updated) {
            throw new Error('Failed to update product stock on VPS');
        }

        // Record movement
        const movement: Partial<StockMovement> = {
            id: createLocalId(),
            company_id: companyId,
            product_id: adjustment.product_id,
            type: adjustment.type,
            quantity: adjustment.quantity,
            previous_quantity: previousQty,
            new_quantity: newQty,
            reason: adjustment.reason,
            notes: adjustment.notes,
            reference_id: adjustment.reference_id,
            created_by: userId || '',
            created_at: new Date().toISOString()
        };

        try {
            await vpsClient.post<StockMovement>('/table-data/stock_movements', movement);
        } catch (movementError) {
            console.error('Error recording stock movement:', movementError);
            // Rollback product update
            await vpsApiService.updateProduct(adjustment.product_id, {
                ...product,
                stock_quantity: previousQty
            });
            throw movementError;
        }
    }

    /**
     * Get stock movement history for a product
     */
    async getMovements(productId: string, limit: number = 50): Promise<StockMovement[]> {
        const rows = await loadStockMovementRows();
        return rows
            .filter(row => String(row.product_id || '') === String(productId))
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
            .slice(0, limit);
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
