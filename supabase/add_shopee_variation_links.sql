ALTER TABLE public.shopee_products
ADD COLUMN IF NOT EXISTS shopee_model_id bigint,
ADD COLUMN IF NOT EXISTS shopee_model_sku text,
ADD COLUMN IF NOT EXISTS shopee_model_name text,
ADD COLUMN IF NOT EXISTS shopee_tier_index jsonb;

CREATE INDEX IF NOT EXISTS idx_shopee_products_item_model
ON public.shopee_products (shopee_item_id, shopee_model_id)
WHERE shopee_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shopee_products_model_sku
ON public.shopee_products (shopee_model_sku)
WHERE shopee_model_sku IS NOT NULL;
