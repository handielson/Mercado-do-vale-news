-- Temporary: Disable RLS on customers table for testing
-- This will allow us to test if RLS is causing the infinite loop

ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- To re-enable later, run:
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
