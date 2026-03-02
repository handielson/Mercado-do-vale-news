-- Create customer_type_requests table for upgrade requests
CREATE TABLE IF NOT EXISTS customer_type_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  requested_type text NOT NULL CHECK (requested_type IN ('wholesale', 'resale')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_type_requests_customer ON customer_type_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_type_requests_status ON customer_type_requests(status);
CREATE INDEX IF NOT EXISTS idx_customer_type_requests_created ON customer_type_requests(created_at DESC);

-- Enable RLS
ALTER TABLE customer_type_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Customers can view their own requests
CREATE POLICY "Customers can view own requests"
  ON customer_type_requests FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    )
  );

-- Customers can create their own requests
CREATE POLICY "Customers can create own requests"
  ON customer_type_requests FOR INSERT
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    )
  );

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
  ON customer_type_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.client_type = 'ADMIN'
    )
  );

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update requests"
  ON customer_type_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.client_type = 'ADMIN'
    )
  );

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_customer_type_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_customer_type_requests_updated_at
  BEFORE UPDATE ON customer_type_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_type_requests_updated_at();
