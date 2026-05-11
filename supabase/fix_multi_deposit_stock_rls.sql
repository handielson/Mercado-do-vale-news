-- Hotfix RLS for multi-deposit stock after production migration.
-- Allows the existing admin profile model (profiles.company_id) in addition to app_metadata/user_companies.

DROP POLICY IF EXISTS "Users can view their company stock deposits" ON stock_deposits;
CREATE POLICY "Users can view their company stock deposits"
  ON stock_deposits FOR SELECT
  TO authenticated
  USING (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their company stock deposits" ON stock_deposits;
CREATE POLICY "Users can insert their company stock deposits"
  ON stock_deposits FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their company stock deposits" ON stock_deposits;
CREATE POLICY "Users can update their company stock deposits"
  ON stock_deposits FOR UPDATE
  TO authenticated
  USING (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  )
  WITH CHECK (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view their company stock locations" ON stock_locations;
CREATE POLICY "Users can view their company stock locations"
  ON stock_locations FOR SELECT
  TO authenticated
  USING (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their company stock locations" ON stock_locations;
CREATE POLICY "Users can insert their company stock locations"
  ON stock_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their company stock locations" ON stock_locations;
CREATE POLICY "Users can update their company stock locations"
  ON stock_locations FOR UPDATE
  TO authenticated
  USING (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  )
  WITH CHECK (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view their company product stock locations" ON product_stock_locations;
CREATE POLICY "Users can view their company product stock locations"
  ON product_stock_locations FOR SELECT
  TO authenticated
  USING (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their company product stock locations" ON product_stock_locations;
CREATE POLICY "Users can insert their company product stock locations"
  ON product_stock_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their company product stock locations" ON product_stock_locations;
CREATE POLICY "Users can update their company product stock locations"
  ON product_stock_locations FOR UPDATE
  TO authenticated
  USING (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  )
  WITH CHECK (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view their company stock location movements" ON stock_location_movements;
CREATE POLICY "Users can view their company stock location movements"
  ON stock_location_movements FOR SELECT
  TO authenticated
  USING (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their company stock location movements" ON stock_location_movements;
CREATE POLICY "Users can insert their company stock location movements"
  ON stock_location_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    OR company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
    OR company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
  );

CREATE OR REPLACE VIEW stock_location_divergences AS
SELECT
  p.company_id,
  p.id AS product_id,
  p.name AS product_name,
  p.sku,
  COALESCE(p.stock_quantity, 0) AS product_stock_quantity,
  COALESCE(SUM(psl.quantity), 0)::INTEGER AS location_stock_quantity,
  (COALESCE(SUM(psl.quantity), 0)::INTEGER - COALESCE(p.stock_quantity, 0)) AS difference
FROM products p
LEFT JOIN product_stock_locations psl ON psl.product_id = p.id
WHERE
  p.company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
  OR p.company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
  OR p.company_id IN (SELECT user_companies.company_id FROM user_companies WHERE user_companies.user_id = auth.uid())
GROUP BY p.company_id, p.id, p.name, p.sku, p.stock_quantity;

ALTER VIEW stock_location_divergences SET (security_invoker = on);

NOTIFY pgrst, 'reload schema';
