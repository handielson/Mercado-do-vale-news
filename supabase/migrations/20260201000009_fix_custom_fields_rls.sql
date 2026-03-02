-- Fix RLS Policy for Custom Fields
-- Allow public read access for development

-- Drop existing SELECT policy
DROP POLICY IF EXISTS custom_fields_select_policy ON custom_fields;

-- Create new policy allowing public read access
CREATE POLICY custom_fields_select_policy ON custom_fields
    FOR SELECT
    USING (true);  -- Allow everyone to read

-- Drop existing INSERT policy
DROP POLICY IF EXISTS custom_fields_insert_policy ON custom_fields;

-- Create new policy allowing public insert
CREATE POLICY custom_fields_insert_policy ON custom_fields
    FOR INSERT
    WITH CHECK (true);  -- Allow everyone to insert

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS custom_fields_update_policy ON custom_fields;

-- Create new policy allowing public update
CREATE POLICY custom_fields_update_policy ON custom_fields
    FOR UPDATE
    USING (true);  -- Allow everyone to update

-- Drop existing DELETE policy
DROP POLICY IF EXISTS custom_fields_delete_policy ON custom_fields;

-- Create new policy allowing public delete (non-system fields only)
CREATE POLICY custom_fields_delete_policy ON custom_fields
    FOR DELETE
    USING (is_system = false);  -- Allow delete of non-system fields only
