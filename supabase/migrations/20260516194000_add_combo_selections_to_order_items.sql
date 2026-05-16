-- Persist selected combo components so paid online orders can deduct the real
-- component SKUs in Bling after payment confirmation.
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS combo_selections JSONB;
