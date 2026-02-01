-- ============================================
-- TEMPORARY: Disable RLS for Testing
-- Run this in Supabase SQL Editor
-- ============================================

-- Disable RLS on all tables temporarily
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE models DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE units DISABLE ROW LEVEL SECURITY;

-- Note: We'll re-enable RLS after implementing proper authentication
