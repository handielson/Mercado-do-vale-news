-- Create payment_fees table for managing payment method fees
-- Supports debit, PIX, and credit card installments (1x-18x)

CREATE TABLE IF NOT EXISTS payment_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL, -- 'debit', 'pix', 'credit'
    installments INTEGER NOT NULL DEFAULT 1, -- 1 for debit/pix, 1-18 for credit
    operator_name TEXT, -- Payment operator name (e.g., PagSeguro, Mercado Pago)
    operator_fee DECIMAL(5,2) NOT NULL, -- Real operator fee (%)
    applied_fee DECIMAL(5,2) NOT NULL, -- Fee passed to customer (%)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_payment_method_installments UNIQUE (company_id, payment_method, installments),
    CONSTRAINT valid_operator_fee CHECK (operator_fee >= 0 AND operator_fee <= 100),
    CONSTRAINT valid_applied_fee CHECK (applied_fee >= 0 AND applied_fee <= 100),
    CONSTRAINT applied_greater_than_operator CHECK (applied_fee >= operator_fee)
);

-- Enable RLS
ALTER TABLE payment_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company's payment fees"
    ON payment_fees FOR SELECT
    USING (company_id = get_company_id());

CREATE POLICY "Users can insert their company's payment fees"
    ON payment_fees FOR INSERT
    WITH CHECK (company_id = get_company_id());

CREATE POLICY "Users can update their company's payment fees"
    ON payment_fees FOR UPDATE
    USING (company_id = get_company_id());

CREATE POLICY "Users can delete their company's payment fees"
    ON payment_fees FOR DELETE
    USING (company_id = get_company_id());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_fees_company ON payment_fees(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_fees_method ON payment_fees(payment_method, installments);

-- Comment
COMMENT ON TABLE payment_fees IS 'Stores payment method fees (operator and applied) for different payment methods and installments';
