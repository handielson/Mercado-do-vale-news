export type ShopeeLinkedLocalProduct = {
  id: string;
  sku?: string | null;
  parent_id?: string | null;
  shopee_item_id?: number | null;
};

export type ShopeeModelListRow = {
  model_id?: number | string | null;
  model_sku?: string | null;
  tier_index?: number[] | null;
  model_name?: string | null;
};

export type ShopeeVariationLinkMatch = {
  product_id: string;
  shopee_model_id: number;
  shopee_model_sku: string;
  shopee_model_name: string | null;
  shopee_tier_index: number[] | null;
};
