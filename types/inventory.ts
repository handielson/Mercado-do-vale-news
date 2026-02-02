/**
 * Inventory Types
 * Types for inventory management and stock control
 */

/**
 * Stock Movement Type
 */
export type StockMovementType = 'in' | 'out' | 'adjustment';

/**
 * Stock Movement Reason
 */
export type StockMovementReason =
    | 'purchase'      // Compra
    | 'sale'          // Venda
    | 'loss'          // Perda
    | 'donation'      // Doação
    | 'return'        // Devolução
    | 'inventory'     // Inventário/Ajuste manual
    | 'transfer';     // Transferência

/**
 * Unit Status
 * Status of individual serialized product unit
 */
export enum UnitStatus {
    AVAILABLE = 'available',        // 🟢 Disponível para venda
    RESERVED = 'reserved',          // 🟡 Reservado para cliente
    SOLD = 'sold',                  // 🔴 Vendido
    IN_MAINTENANCE = 'maintenance', // 🔵 Em manutenção
    DEFECTIVE = 'defective'         // ⚫ Defeituoso
}

/**
 * Stock Movement Interface
 * Represents a stock movement/adjustment
 */
export interface StockMovement {
    id: string;
    company_id: string;
    product_id: string;

    // Movement Details
    type: StockMovementType;
    quantity: number;
    previous_quantity: number;
    new_quantity: number;

    // Metadata
    reason: StockMovementReason;
    notes?: string;
    reference_id?: string;  // ID da venda/compra relacionada

    // Audit
    created_by: string;
    created_at: string;
}

/**
 * Stock Adjustment Input
 * Data required to adjust stock
 */
export interface StockAdjustmentInput {
    product_id: string;
    type: StockMovementType;
    quantity: number;
    reason: StockMovementReason;
    notes?: string;
    reference_id?: string;
}

/**
 * Serialized Unit
 * Individual unit of a serialized product
 */
export interface SerializedUnit {
    id: string;
    imei1?: string;
    imei2?: string;
    serial?: string;
    unit_status: UnitStatus;
    created_at: string;
    notes?: string;
}

/**
 * Inventory Group
 * Grouped view of products (serialized products grouped by specs)
 */
export interface InventoryGroup {
    // Identification
    product_key: string;          // Unique hash: brand+model+color+storage
    name: string;                 // Product name
    category_id: string;

    // Common specs
    brand: string;
    model: string;
    color?: string;
    storage?: string;
    ram?: string;

    // Counters
    total_units: number;          // Total units
    available: number;            // 🟢 Available
    reserved: number;             // 🟡 Reserved
    sold: number;                 // 🔴 Sold
    in_maintenance: number;       // 🔵 In maintenance
    defective: number;            // ⚫ Defective

    // Type
    is_serialized: boolean;       // true if has IMEI/Serial

    // Prices (average if variation exists)
    price_cost: number;
    price_retail: number;
    price_reseller: number;
    price_wholesale: number;

    // Individual units (only if serialized)
    units?: SerializedUnit[];
}

/**
 * Inventory Stats
 * Statistics about inventory
 */
export interface InventoryStats {
    // Totals
    total_products: number;        // Total groups
    total_units: number;           // Total individual units

    // By type
    serialized_groups: number;     // Serialized groups
    non_serialized_groups: number; // Non-serialized groups

    // By status (serialized only)
    available: number;             // 🟢
    reserved: number;              // 🟡
    sold: number;                  // 🔴
    in_maintenance: number;        // 🔵
    defective: number;             // ⚫

    // Legacy (for non-serialized)
    in_stock: number;              // Qty > 0
    low_stock: number;             // 1 <= Qty <= 10
    out_of_stock: number;          // Qty = 0
    not_tracked: number;           // track_inventory = false

    // Value
    total_value: number;           // Sum of (stock_quantity × price_cost) in cents
}

/**
 * Inventory Filter Options
 */
export interface InventoryFilters {
    search?: string;               // Search by name, SKU, EAN, IMEI1
    category_id?: string;
    brand?: string;
    status?: UnitStatus;           // Filter by unit status
    only_available?: boolean;      // Only with stock > 0
    only_serialized?: boolean;     // Show only serialized products
    only_non_serialized?: boolean; // Show only non-serialized products
    sort_by?: 'name' | 'sku' | 'quantity' | 'value';
    sort_order?: 'asc' | 'desc';
}

/**
 * Dynamic Column Definition
 * Defines which columns to show in inventory table
 */
export interface DynamicColumn {
    key: string;                // Campo do specs (ex: 'imei1', 'color')
    label: string;              // Label para exibir (ex: 'IMEI 1', 'Cor')
    visible: boolean;           // Se deve ser exibido
    priority: number;           // Ordem de exibição (menor = mais à esquerda)
}

/**
 * Inventory Table Config
 * Configuration for dynamic table columns
 */
export interface InventoryTableConfig {
    fixed_columns: string[];    // Colunas fixas sempre exibidas
    dynamic_columns: DynamicColumn[];  // Colunas dinâmicas baseadas em specs
}

/**
 * Future: Credit Card Pricing
 * Preparação para preços com cartão de crédito
 */
export interface CreditCardPricing {
    enabled: boolean;
    fee_percentage: number;     // Taxa do cartão (ex: 3.5%)
    price_retail_card?: number; // Preço varejo com cartão (centavos)
    // Revenda e Atacado NÃO permitem cartão
}
