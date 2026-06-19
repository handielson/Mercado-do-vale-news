export type StockDepositType = 'store' | 'warehouse' | 'support' | 'transit' | 'other';

export type StockLocationMovementType =
  | 'in'
  | 'out'
  | 'adjustment'
  | 'transfer'
  | 'reservation'
  | 'release_reservation'
  | 'sale'
  | 'cancel'
  | 'sync';

export interface StockDeposit {
  id: string;
  company_id: string;
  name: string;
  code: string;
  type: StockDepositType;
  cep?: string | null;
  address?: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type StockPathDeactivationTarget = 'deposit' | 'location';

export interface StockPathDeactivationItem {
  product_id: string;
  product_name: string;
  sku?: string | null;
  deposit_id: string;
  deposit_name: string | null;
  location_id: string;
  location_name: string | null;
  quantity: number;
  reserved_quantity: number;
}

export interface StockPathDeactivationCheck {
  target_type: StockPathDeactivationTarget;
  target_id: string;
  can_deactivate: boolean;
  pending_items: StockPathDeactivationItem[];
}

export interface StockDepositInput {
  name: string;
  code?: string;
  type?: StockDepositType;
  cep?: string | null;
  address?: string | null;
  is_default?: boolean;
}

export interface StockDepositUpdateInput {
  name: string;
  code?: string;
  type?: StockDepositType;
  cep?: string | null;
  address?: string | null;
  is_default?: boolean;
}

export interface StockLocation {
  id: string;
  company_id: string;
  deposit_id: string;
  name: string;
  code: string;
  description?: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockLocationInput {
  deposit_id: string;
  name: string;
  code?: string;
  description?: string | null;
  is_default?: boolean;
}

export interface StockLocationUpdateInput {
  deposit_id: string;
  name: string;
  code?: string;
  description?: string | null;
  is_default?: boolean;
}

export interface ProductStockLocation {
  id: string;
  company_id: string;
  product_id: string;
  deposit_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
  created_at: string;
  updated_at: string;
  deposit?: StockDeposit | null;
  location?: StockLocation | null;
}

export interface StockLocationMovement {
  id: string;
  company_id: string;
  product_id: string;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
    ean?: string | null;
    specs?: Record<string, unknown> | null;
  } | null;
  from_deposit_id?: string | null;
  from_location_id?: string | null;
  to_deposit_id?: string | null;
  to_location_id?: string | null;
  quantity: number;
  movement_type: StockLocationMovementType;
  reason: string;
  reference_type?: string | null;
  reference_id?: string | null;
  previous_from_quantity?: number | null;
  new_from_quantity?: number | null;
  previous_to_quantity?: number | null;
  new_to_quantity?: number | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface StockLocationMovementInput {
  product_id: string;
  from_deposit_id?: string | null;
  from_location_id?: string | null;
  to_deposit_id?: string | null;
  to_location_id?: string | null;
  quantity: number;
  movement_type: StockLocationMovementType;
  reason: string;
  reference_type?: string | null;
  reference_id?: string | null;
  previous_from_quantity?: number | null;
  new_from_quantity?: number | null;
  previous_to_quantity?: number | null;
  new_to_quantity?: number | null;
  notes?: string | null;
}

export interface StockLocationMovementFilters {
  productId?: string;
  locationId?: string;
  movementType?: StockLocationMovementType;
  referenceType?: string;
  referenceId?: string;
  limit?: number;
}

export interface StockLocationAdjustmentInput {
  product_id: string;
  deposit_id: string;
  location_id: string;
  quantity: number;
  reason: string;
  notes?: string | null;
}

export interface StockLocationTransferInput {
  product_id: string;
  from_deposit_id: string;
  from_location_id: string;
  to_deposit_id: string;
  to_location_id: string;
  quantity: number;
  reason: string;
  notes?: string | null;
}

export interface StockLocationEntryInput {
  product_id: string;
  deposit_id: string;
  location_id: string;
  quantity: number;
  reason: string;
  notes?: string | null;
}

export interface StockLocationPriorityDecrementInput {
  product_id: string;
  quantity: number;
  reason: string;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
}

export interface StockLocationPriorityDecrementResult {
  stock_location_id: string;
  deposit_id: string;
  location_id: string;
  deposit_name?: string | null;
  deposit_code?: string | null;
  deposit_type?: StockDepositType | null;
  deposit_is_default?: boolean;
  location_name?: string | null;
  location_code?: string | null;
  location_is_default?: boolean;
  quantity_decremented: number;
  previous_quantity: number;
  new_quantity: number;
}

export interface StockLocationPriorityReservationInput {
  product_id: string;
  quantity: number;
  reason: string;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
}

export interface StockLocationPriorityReservationResult {
  stock_location_id: string;
  deposit_id: string;
  location_id: string;
  quantity_reserved: number;
  previous_reserved_quantity: number;
  new_reserved_quantity: number;
}

export interface StockLocationOrderReservationInput {
  order_id: string;
  reason: string;
  notes?: string | null;
}

export interface StockLocationOrderReservationResult {
  reservation_movement_id: string;
  product_id: string;
  deposit_id: string;
  location_id: string;
  quantity_processed: number;
  previous_quantity: number;
  new_quantity: number;
  previous_reserved_quantity: number;
  new_reserved_quantity: number;
}

export interface StockLocationSaleRestoreInput {
  sale_id: string;
  reason: string;
  notes?: string | null;
}

export interface StockLocationSaleRestoreResult {
  sale_movement_id: string;
  product_id: string;
  deposit_id: string;
  location_id: string;
  quantity_restored: number;
  previous_quantity: number;
  new_quantity: number;
}

export interface StockLocationOrderRestoreInput {
  order_id: string;
  reason: string;
  notes?: string | null;
}

export interface StockLocationOrderRestoreResult {
  order_movement_id: string;
  product_id: string;
  deposit_id: string;
  location_id: string;
  quantity_restored: number;
  previous_quantity: number;
  new_quantity: number;
}

export interface StockLocationDivergence {
  company_id: string;
  product_id: string;
  product_name: string;
  sku?: string | null;
  product_stock_quantity: number;
  location_stock_quantity: number;
  difference: number;
}

export interface StockLocationProductSearchResult {
  id: string;
  name: string;
  sku?: string | null;
  ean?: string | null;
  stock_quantity: number;
  images?: string[] | null;
}

export interface LocationContentItem {
  product_id: string;
  product_name: string;
  sku: string | null;
  ean: string | null;
  product_image: string | null;
  total_stock: number;        // estoque total do produto (somando todos os locais)
  quantity: number;           // físico neste local
  reserved_quantity: number;  // reservado neste local
  available: number;          // quantity - reserved_quantity
  deposit_id?: string;
  deposit_name: string | null;
  location_id?: string;
  location_name: string | null;
  specs?: Record<string, any> | null;  // pra montar variação a partir de cor/RAM/etc.
}
