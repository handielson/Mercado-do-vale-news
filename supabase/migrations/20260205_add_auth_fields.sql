-- Migration: Add Supabase Auth integration to customers table
-- Created: 2026-02-05
-- Description: Adds user_id and account_status fields to support Supabase Auth

-- ============================================================================
-- STEP 1: Add new columns
-- ============================================================================

-- Add user_id column (nullable, references auth.users)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add account_status column
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'pending' 
CHECK (account_status IN ('pending', 'active'));

-- ============================================================================
-- STEP 2: Update existing data
-- ============================================================================

-- Set all existing customers to 'pending' status
UPDATE customers 
SET account_status = 'pending' 
WHERE user_id IS NULL AND account_status IS NULL;

-- ============================================================================
-- STEP 3: Create constraints
-- ============================================================================

-- Ensure CPF is unique per company (if not already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'customers_cpf_company_unique'
    ) THEN
        ALTER TABLE customers 
        ADD CONSTRAINT customers_cpf_company_unique 
        UNIQUE (cpf_cnpj, company_id);
    END IF;
END $$;

-- Ensure user_id is unique (one auth.user = one customer)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'customers_user_id_unique'
    ) THEN
        ALTER TABLE customers 
        ADD CONSTRAINT customers_user_id_unique 
        UNIQUE (user_id);
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Create indexes for performance
-- ============================================================================

-- Index for CPF searches
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON customers(cpf_cnpj);

-- Index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id) 
WHERE user_id IS NOT NULL;

-- Index for account_status filtering
CREATE INDEX IF NOT EXISTS idx_customers_account_status ON customers(account_status);

-- ============================================================================
-- STEP 5: Configure Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own customer data" ON customers;
DROP POLICY IF EXISTS "Users can update own customer data" ON customers;
DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
DROP POLICY IF EXISTS "Admins can manage all customers" ON customers;

-- Policy: Users can view their own customer data
CREATE POLICY "Users can view own customer data"
ON customers FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can update their own customer data
CREATE POLICY "Users can update own customer data"
ON customers FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Admins can view all customers
-- Note: Adjust this based on your admin user structure
-- For now, we'll allow service_role to access everything
CREATE POLICY "Service role can view all customers"
ON customers FOR SELECT
USING (auth.jwt()->>'role' = 'service_role');

-- Policy: Admins can manage all customers
CREATE POLICY "Service role can manage all customers"
ON customers FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- STEP 6: Create recovery_codes table (optional, for WhatsApp recovery)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recovery_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cpf_cnpj text NOT NULL,
    code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- Index for CPF lookups
CREATE INDEX IF NOT EXISTS idx_recovery_codes_cpf ON recovery_codes(cpf_cnpj);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_recovery_codes_expires ON recovery_codes(expires_at);

-- Enable RLS
ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage recovery codes
CREATE POLICY "Service role can manage recovery codes"
ON recovery_codes FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- STEP 7: Add helpful comments
-- ============================================================================

COMMENT ON COLUMN customers.user_id IS 'Reference to auth.users - null if account not activated yet';
COMMENT ON COLUMN customers.account_status IS 'Account activation status: pending (not activated) or active (can login)';
COMMENT ON TABLE recovery_codes IS 'Temporary codes for password recovery via WhatsApp';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these queries to verify the migration:

-- 1. Check new columns exist
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'customers' 
-- AND column_name IN ('user_id', 'account_status');

-- 2. Check constraints
-- SELECT conname, contype 
-- FROM pg_constraint 
-- WHERE conrelid = 'customers'::regclass;

-- 3. Check indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'customers';

-- 4. Check RLS policies
-- SELECT policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'customers';
