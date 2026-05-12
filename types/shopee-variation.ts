export type ShopeeVariationDimensionKey = 'color' | 'model' | 'size' | 'ram' | 'storage';

export interface ShopeeVariationProduct {
  id: string;
  name: string;
  sku?: string | null;
  parent_id?: string | null;
  bling_id?: number | string | null;
  bling_parent_id?: number | string | null;
  is_parent?: boolean | number | null;
  price_retail?: number | null;
  stock_quantity?: number | null;
  track_inventory?: boolean | null;
  images?: any[];
  eans?: string[] | null;
  specs?: Record<string, any> | null;
}

export interface ShopeeVariationGroup {
  id: string;
  parent: ShopeeVariationProduct;
  children: ShopeeVariationProduct[];
}

export interface ShopeeVariationDimension {
  name: string;
  key: ShopeeVariationDimensionKey;
  options: string[];
}

export interface ShopeeVariationValidationIssue {
  productId?: string;
  field: string;
  message: string;
}

export interface ShopeeVariationValidationResult {
  ok: boolean;
  blockers: ShopeeVariationValidationIssue[];
  warnings: ShopeeVariationValidationIssue[];
}

export interface ShopeeVariationBuildContext {
  imageIdsByProductId: Record<string, string>;
  stockByProductId?: Record<string, number>;
}

export interface ShopeeVariationPayloadParts {
  tier_variation: Array<{
    name: string;
    option_list: Array<{ option: string; image?: { image_id: string } }>;
  }>;
  model_list: Array<Record<string, any>>;
}
