-- Drop existing bad policy
DROP POLICY IF EXISTS "cashback_settings_admin" ON cashback_settings;

-- Emulate a policy that specifically allows UPDATE as well
CREATE POLICY "cashback_settings_admin_all" ON cashback_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
