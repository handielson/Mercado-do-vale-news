-- Migration: Create stock_movements table
-- Description: Track all stock movements (in, out, adjustments)
-- Date: 2026-02-01

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Movement Details
    type VARCHAR(20) NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    previous_quantity INTEGER NOT NULL CHECK (previous_quantity >= 0),
    new_quantity INTEGER NOT NULL CHECK (new_quantity >= 0),
    
    -- Metadata
    reason VARCHAR(20) NOT NULL CHECK (reason IN ('purchase', 'sale', 'loss', 'donation', 'return', 'inventory', 'transfer')),
    notes TEXT,
    reference_id UUID, -- ID da venda/compra relacionada (nullable)
    
    -- Audit Trail
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_movement CHECK (
        (type = 'in' AND new_quantity = previous_quantity + quantity) OR
        (type = 'out' AND new_quantity = previous_quantity - quantity) OR
        (type = 'adjustment')
    )
);

-- Create indexes for performance
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_company ON stock_movements(company_id);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX idx_stock_movements_type ON stock_movements(type);

-- Add RLS (Row Level Security) policies
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see movements from their company
CREATE POLICY stock_movements_select_policy ON stock_movements
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- Policy: Users can insert movements for their company
CREATE POLICY stock_movements_insert_policy ON stock_movements
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- Policy: Users cannot update or delete movements (audit trail)
-- Movements are immutable for audit purposes

-- Add comment
COMMENT ON TABLE stock_movements IS 'Tracks all stock movements for audit and inventory control';
COMMENT ON COLUMN stock_movements.type IS 'Type of movement: in (entrada), out (saída), adjustment (ajuste)';
COMMENT ON COLUMN stock_movements.reason IS 'Reason for movement: purchase, sale, loss, donation, return, inventory, transfer';
COMMENT ON COLUMN stock_movements.reference_id IS 'Optional reference to related transaction (sale, purchase order, etc)';
