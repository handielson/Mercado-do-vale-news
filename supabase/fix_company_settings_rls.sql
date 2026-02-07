-- =====================================================
-- FIX COMPANY_SETTINGS RLS FOR PUBLIC ACCESS
-- Allow public read access to company branding/theme
-- =====================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own company settings" ON company_settings;

-- Create new policy that allows public read access
-- This is needed for ThemeContext to load company branding without authentication
CREATE POLICY "Public can view company settings"
  ON company_settings
  FOR SELECT
  USING (true); -- Allow anyone to read

-- Keep write policies restricted to authenticated users
-- (INSERT, UPDATE, DELETE policies remain unchanged)

COMMENT ON POLICY "Public can view company settings" ON company_settings IS 
  'Allows public access to company branding and theme settings for ThemeContext';
