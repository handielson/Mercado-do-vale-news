-- ============================================
-- MIGRATION: Add Customer Fields
-- ============================================
-- Data: 2026-02-02
-- Descrição: Adiciona campos de data de nascimento, tipo de cliente e redes sociais

-- Create ENUM type for customer type
DO $$ BEGIN
    CREATE TYPE customer_type_enum AS ENUM ('wholesale', 'resale', 'retail');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add customer_type field
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS customer_type customer_type_enum;

-- Add birth_date field
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Add social media fields
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS instagram TEXT;

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS facebook TEXT;

-- Add admin notes field
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_customers_birth_date ON customers(birth_date);

-- Comments
COMMENT ON COLUMN customers.birth_date IS 'Customer birth date for age calculation and birthday tracking';
COMMENT ON COLUMN customers.instagram IS 'Instagram username (without @)';
COMMENT ON COLUMN customers.facebook IS 'Facebook username or profile URL';
COMMENT ON COLUMN customers.admin_notes IS 'Internal admin notes - private information not shared with customer';
