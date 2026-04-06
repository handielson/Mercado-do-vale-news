-- Add welcome_message_template column to catalog_settings
-- Used by MessagesPage to store the customizable WhatsApp welcome message template

ALTER TABLE catalog_settings
    ADD COLUMN IF NOT EXISTS welcome_message_template TEXT;
