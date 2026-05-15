ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS offer_type text,
ADD COLUMN IF NOT EXISTS offer_parent_product_id uuid,
ADD COLUMN IF NOT EXISTS offer_visibility text DEFAULT 'visible',
ADD COLUMN IF NOT EXISTS shopee_strategy text DEFAULT 'variation',
ADD COLUMN IF NOT EXISTS shopee_offer_status text,
ADD COLUMN IF NOT EXISTS shopee_offer_error text;

CREATE INDEX IF NOT EXISTS idx_products_offer_parent
ON public.products (offer_parent_product_id)
WHERE offer_parent_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_offer_type
ON public.products (offer_type)
WHERE offer_type IS NOT NULL;
