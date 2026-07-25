export type ShoppingListItemStatus = 'pending' | 'quoted' | 'purchased' | 'cancelled';
export type ShoppingListItemSource = 'daily_sales' | 'manual_product' | 'manual_item';

export interface ShoppingListQuote {
  id: string;
  shopping_list_item_id: string;
  supplier_name: string;
  purchase_location?: string | null;
  unit_price: number;
  quantity: number;
  quoted_at: string;
  notes?: string | null;
  is_valid: boolean;
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  product_id?: string | null;
  source_key?: string | null;
  source_type: ShoppingListItemSource;
  item_name: string;
  sku?: string | null;
  requested_quantity: number;
  sales_quantity_today: number;
  current_stock: number;
  status: ShoppingListItemStatus;
  notes?: string | null;
  cancelled_reason?: string | null;
  created_at: string;
  updated_at: string;
  quotes?: ShoppingListQuote[];
}

export interface ShoppingListPurchase {
  id: string;
  shopping_list_item_id: string;
  supplier_name: string;
  purchase_location?: string | null;
  quantity: number;
  unit_price: number;
  purchased_at: string;
  notes?: string | null;
  operator_name: string;
  created_at: string;
  item?: Pick<ShoppingListItem, 'item_name' | 'sku'>;
}

export interface BestQuote extends ShoppingListQuote {
  total_price: number;
}
