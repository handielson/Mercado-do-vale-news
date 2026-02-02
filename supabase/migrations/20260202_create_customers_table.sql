-- Migration: Create Customers Table
-- Date: 2026-02-02
-- Description: Creates customers table with RLS policies, indexes, and triggers

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Basic Info
    name TEXT NOT NULL,
    cpf_cnpj TEXT,
    email TEXT,
    phone TEXT,
    
    -- Address (JSONB for flexibility)
    address JSONB DEFAULT '{}'::jsonb,
    
    -- Custom Fields (integrates with custom_fields system)
    custom_data JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT customers_cpf_cnpj_unique UNIQUE (company_id, cpf_cnpj),
    CONSTRAINT customers_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL)
);

-- Indexes for performance
CREATE INDEX idx_customers_company_id ON customers(company_id);
CREATE INDEX idx_customers_cpf_cnpj ON customers(cpf_cnpj);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_name ON customers USING gin(to_tsvector('portuguese', name));
CREATE INDEX idx_customers_is_active ON customers(is_active);

-- RLS Policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see customers from their company
CREATE POLICY customers_select_policy ON customers
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM user_companies 
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Users can insert customers to their company
CREATE POLICY customers_insert_policy ON customers
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM user_companies 
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Users can update customers from their company
CREATE POLICY customers_update_policy ON customers
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM user_companies 
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Users can delete customers from their company
CREATE POLICY customers_delete_policy ON customers
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM user_companies 
            WHERE user_id = auth.uid()
        )
    );

-- Trigger: Update updated_at on change
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at_trigger
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_customers_updated_at();

-- Verify table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;
