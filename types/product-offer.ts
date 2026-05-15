export type ProductOfferType = 'quantity_kit' | 'product_combo';

export type ProductOfferShopeeStrategy = 'variation' | 'separate_item';

export type ProductOfferVisibility = 'visible' | 'hidden';

export interface ProductOfferComponent {
  product_id: string;
  quantity: number;
  sku?: string | null;
  name?: string | null;
  bling_id?: number | null;
}

export interface ProductOfferProductLike {
  id: string;
  sku?: string | null;
  name?: string | null;
  stock_quantity?: number | null;
  price_retail?: number | null;
  price_reseller?: number | null;
  price_wholesale?: number | null;
  bling_id?: number | null;
}

export interface ProductOfferDraft {
  offer_type: ProductOfferType;
  base_product_id?: string | null;
  name: string;
  sku: string;
  price_retail: number;
  price_reseller: number;
  price_wholesale: number;
  status: 'active' | 'inactive';
  offer_visibility: ProductOfferVisibility;
  shopee_strategy: ProductOfferShopeeStrategy;
  components: ProductOfferComponent[];
}
