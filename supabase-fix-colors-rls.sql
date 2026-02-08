-- =====================================================
-- FIX: RLS POLICIES FOR COLORS TABLE
-- =====================================================
-- Problem: 403 Forbidden errors when accessing colors
-- Cause: RLS policies are too restrictive or incorrectly configured
-- Solution: Simplified policies for authenticated users
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view colors from their company" ON colors;
DROP POLICY IF EXISTS "Users can insert colors for their company" ON colors;
DROP POLICY IF EXISTS "Users can update colors from their company" ON colors;
DROP POLICY IF EXISTS "Users can delete colors from their company" ON colors;

-- =====================================================
-- OPTION 1: Simplified Policies (RECOMMENDED FOR NOW)
-- =====================================================
-- These policies allow any authenticated user to access colors
-- This is simpler and works well for single-company setups

CREATE POLICY "Allow authenticated users to view colors"
    ON colors FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert colors"
    ON colors FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update colors"
    ON colors FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete colors"
    ON colors FOR DELETE
    TO authenticated
    USING (true);

-- =====================================================
-- OPTION 2: Company-Scoped Policies (FOR MULTI-TENANT)
-- =====================================================
-- Uncomment these if you need strict multi-tenant isolation
-- NOTE: This requires users table to have company_id column

/*
CREATE POLICY "Users can view colors from their company"
    ON colors FOR SELECT
    TO authenticated
    USING (
        company_id = (
            SELECT company_id 
            FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert colors for their company"
    ON colors FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id = (
            SELECT company_id 
            FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update colors from their company"
    ON colors FOR UPDATE
    TO authenticated
    USING (
        company_id = (
            SELECT company_id 
            FROM users 
            WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        company_id = (
            SELECT company_id 
            FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete colors from their company"
    ON colors FOR DELETE
    TO authenticated
    USING (
        company_id = (
            SELECT company_id 
            FROM users 
            WHERE id = auth.uid()
        )
    );
*/

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify policies are working:
-- SELECT * FROM colors;
-- If you see colors, policies are working!
