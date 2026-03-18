-- Add Frenet shipping fields to shipping_settings
ALTER TABLE shipping_settings
    ADD COLUMN IF NOT EXISTS frenet_token TEXT,
    ADD COLUMN IF NOT EXISTS frenet_enabled BOOLEAN DEFAULT FALSE;
