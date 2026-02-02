-- ============================================
-- MIGRATION: Create Customers Table (FINAL VERSION)
-- ============================================
-- Data: 2026-02-02
-- Descrição: Tabela completa de clientes sem campos customizados

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop table if exists (CUIDADO: só use em desenvolvimento!)
-- DROP TABLE IF EXISTS customers CASCADE;

-- ============================================
-- Create customers table
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Dados Básicos
    name TEXT NOT NULL,
    cpf_cnpj TEXT,
    
    -- Contato
    email TEXT,
    phone TEXT,
    
    -- Endereço (JSONB para flexibilidade)
    address JSONB DEFAULT '{}'::jsonb,
    
    -- Dados Customizados (para campos extras no futuro)
    custom_data JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_customer_per_company UNIQUE (company_id, cpf_cnpj)
);

-- ============================================
-- Índices para performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_cpf_cnpj ON customers(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS customers_select_policy ON customers;
DROP POLICY IF EXISTS customers_insert_policy ON customers;
DROP POLICY IF EXISTS customers_update_policy ON customers;
DROP POLICY IF EXISTS customers_delete_policy ON customers;

-- Create policies (público por enquanto, ajustar depois)
CREATE POLICY customers_select_policy ON customers
    FOR SELECT USING (true);

CREATE POLICY customers_insert_policy ON customers
    FOR INSERT WITH CHECK (true);

CREATE POLICY customers_update_policy ON customers
    FOR UPDATE USING (true);

CREATE POLICY customers_delete_policy ON customers
    FOR DELETE USING (true);

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE customers IS 'Customer management table';
COMMENT ON COLUMN customers.address IS 'Address stored as JSONB: {street, number, complement, neighborhood, city, state, zipCode}';
COMMENT ON COLUMN customers.custom_data IS 'Custom fields stored as JSONB for flexibility';

-- ============================================
-- Verificação
-- ============================================
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

-- Contar clientes
SELECT COUNT(*) as total_customers FROM customers;
