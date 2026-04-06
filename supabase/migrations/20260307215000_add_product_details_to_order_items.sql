-- Migration: add product_image_url and product_color to order_items
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS product_image_url TEXT,
    ADD COLUMN IF NOT EXISTS product_color TEXT;

-- Add delivery receipt template to company settings
ALTER TABLE company_settings
    ADD COLUMN IF NOT EXISTS delivery_receipt_template TEXT;
