import { vpsClient } from './vpsClient';
import type { BestQuote, ShoppingListItem, ShoppingListItemStatus, ShoppingListPurchase, ShoppingListQuote } from '../types/shopping-list';

const number = (value: unknown) => Number(value) || 0;

const normalizeItem = (item: any): ShoppingListItem => ({
  ...item,
  requested_quantity: number(item.requested_quantity),
  sales_quantity_today: number(item.sales_quantity_today),
  current_stock: number(item.current_stock),
  quotes: item.quotes || [],
});

export const getBestQuote = (quotes: ShoppingListQuote[] = []): BestQuote | null => {
  const valid = quotes.filter((quote) => quote.is_valid && number(quote.unit_price) > 0 && number(quote.quantity) > 0);
  if (!valid.length) return null;
  const quote = [...valid].sort((a, b) => number(a.unit_price) - number(b.unit_price) || a.quoted_at.localeCompare(b.quoted_at))[0];
  return { ...quote, unit_price: number(quote.unit_price), total_price: number(quote.unit_price) * number(quote.quantity) };
};

export const bestQuoteFromItem = (item: any): BestQuote | null => {
  if (!item.best_quote_id || !(number(item.best_unit_price) > 0)) return null;
  return {
    id: item.best_quote_id, shopping_list_item_id: item.id, supplier_name: item.best_supplier_name,
    purchase_location: item.best_purchase_location, unit_price: number(item.best_unit_price),
    quantity: number(item.best_quote_quantity), quoted_at: String(item.best_quoted_at || ''), is_valid: true,
    created_at: '', total_price: number(item.best_unit_price) * number(item.best_quote_quantity),
  };
};

export const shoppingListService = {
  async listItems(status?: ShoppingListItemStatus): Promise<ShoppingListItem[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const rows = await vpsClient.get<any[]>(`/shopping-list/items${query}`);
    return (rows || []).map(normalizeItem);
  },

  async getItem(id: string): Promise<ShoppingListItem> {
    const item = await vpsClient.get<any>(`/shopping-list/items/${id}`);
    return normalizeItem({ ...item, quotes: (item.quotes || []).map((quote: any) => ({ ...quote, unit_price: number(quote.unit_price), quantity: number(quote.quantity), is_valid: Boolean(quote.is_valid) })) });
  },

  async syncTodaySales() {
    return vpsClient.post<{ synchronized_items: number }>('/shopping-list/sync-daily-sales', {});
  },

  async addRegisteredProduct(input: { productId: string; quantity: number; notes?: string; operatorName?: string }) {
    return vpsClient.post<ShoppingListItem>('/shopping-list/items/registered', { product_id: input.productId, quantity: input.quantity, notes: input.notes, operator_name: input.operatorName });
  },

  async addLooseItem(input: { itemName: string; sku?: string; quantity: number; notes?: string; operatorName?: string }) {
    return vpsClient.post<ShoppingListItem>('/shopping-list/items/loose', { item_name: input.itemName, sku: input.sku, quantity: input.quantity, notes: input.notes, operator_name: input.operatorName });
  },

  async addQuote(itemId: string, input: { supplierName: string; purchaseLocation?: string; unitPrice: number; quantity: number; quotedAt: string; notes?: string; operatorName?: string }) {
    return vpsClient.post<ShoppingListQuote>(`/shopping-list/items/${itemId}/quotes`, { supplier_name: input.supplierName, purchase_location: input.purchaseLocation, unit_price: input.unitPrice, quantity: input.quantity, quoted_at: input.quotedAt, notes: input.notes, operator_name: input.operatorName });
  },

  async cancelItem(itemId: string, reason: string) { return vpsClient.post(`/shopping-list/items/${itemId}/cancel`, { reason }); },

  async confirmPurchase(itemId: string, input: { supplierName: string; purchaseLocation?: string; quantity: number; unitPrice: number; purchasedAt: string; notes?: string; operatorName: string }) {
    return vpsClient.post<ShoppingListPurchase>(`/shopping-list/items/${itemId}/purchase`, { supplier_name: input.supplierName, purchase_location: input.purchaseLocation, quantity: input.quantity, unit_price: input.unitPrice, purchased_at: input.purchasedAt, notes: input.notes, operator_name: input.operatorName });
  },

  async listQuotes(): Promise<ShoppingListItem[]> {
    const rows = await vpsClient.get<any[]>('/shopping-list/quotes');
    return (rows || []).map(normalizeItem);
  },

  async listPurchases(): Promise<ShoppingListPurchase[]> {
    const rows = await vpsClient.get<any[]>('/shopping-list/purchases');
    return (rows || []).map((purchase) => ({ ...purchase, unit_price: number(purchase.unit_price), quantity: number(purchase.quantity), item: { item_name: purchase.item_name, sku: purchase.sku } }));
  },
};
