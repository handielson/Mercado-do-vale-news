-- Create shopee_products table to track Shopee sync status per product
CREATE TABLE IF NOT EXISTS shopee_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL UNIQUE,           -- VPS product ID
  shopee_item_id bigint,                     -- Shopee item ID (null = not synced)
  shopee_category_id bigint,                 -- Shopee category ID
  shopee_category_name text,                 -- Shopee category display name
  shopee_attributes jsonb DEFAULT '[]',      -- Required attributes saved for re-sync
  shopee_price integer,                      -- Price in cents (null = use price_retail)
  status text DEFAULT 'not_synced',          -- 'active' | 'inactive' | 'not_synced'
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);
