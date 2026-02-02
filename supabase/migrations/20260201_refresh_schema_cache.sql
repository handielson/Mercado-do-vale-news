-- Verify and refresh Supabase schema cache
-- Run this to fix "Could not find column in schema cache" errors

-- 1. First, verify the columns actually exist
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('status', 'track_inventory', 'stock_quantity')
ORDER BY column_name;

-- 2. If columns exist, force Supabase to refresh its schema cache
NOTIFY pgrst, 'reload schema';

-- 3. Alternative: Restart PostgREST (Supabase's API layer)
-- This forces a complete schema reload
SELECT pg_notify('pgrst', 'reload config');
