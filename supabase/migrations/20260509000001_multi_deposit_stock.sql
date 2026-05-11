-- Multi-deposit stock structure
-- Date: 2026-05-09
-- Safe phase: additive tables, default location backfill and divergence view.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS stock_deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'warehouse' CHECK (type IN ('store', 'warehouse', 'support', 'transit', 'other')),
  cep TEXT,
  address TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_stock_deposits_company_id ON stock_deposits(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_deposits_active ON stock_deposits(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_stock_deposits_default ON stock_deposits(company_id, is_default) WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS update_stock_deposits_updated_at ON stock_deposits;
CREATE TRIGGER update_stock_deposits_updated_at
  BEFORE UPDATE ON stock_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE stock_deposits ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE IF NOT EXISTS stock_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  deposit_id UUID NOT NULL REFERENCES stock_deposits(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deposit_id, code)
);

CREATE INDEX IF NOT EXISTS idx_stock_locations_company_id ON stock_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_locations_deposit_id ON stock_locations(deposit_id);
CREATE INDEX IF NOT EXISTS idx_stock_locations_active ON stock_locations(deposit_id, is_active);
CREATE INDEX IF NOT EXISTS idx_stock_locations_default ON stock_locations(deposit_id, is_default) WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS update_stock_locations_updated_at ON stock_locations;
CREATE TRIGGER update_stock_locations_updated_at
  BEFORE UPDATE ON stock_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE IF NOT EXISTS product_stock_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  deposit_id UUID NOT NULL REFERENCES stock_deposits(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, deposit_id, location_id),
  CONSTRAINT product_stock_locations_reserved_within_quantity CHECK (reserved_quantity <= quantity)
);

CREATE INDEX IF NOT EXISTS idx_product_stock_locations_company_id ON product_stock_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_locations_product_id ON product_stock_locations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_locations_deposit_id ON product_stock_locations(deposit_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_locations_location_id ON product_stock_locations(location_id);

DROP TRIGGER IF EXISTS update_product_stock_locations_updated_at ON product_stock_locations;
CREATE TRIGGER update_product_stock_locations_updated_at
  BEFORE UPDATE ON product_stock_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE product_stock_locations ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE IF NOT EXISTS stock_location_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  from_deposit_id UUID REFERENCES stock_deposits(id) ON DELETE SET NULL,
  from_location_id UUID REFERENCES stock_locations(id) ON DELETE SET NULL,
  to_deposit_id UUID REFERENCES stock_deposits(id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES stock_locations(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'in',
    'out',
    'adjustment',
    'transfer',
    'reservation',
    'release_reservation',
    'sale',
    'cancel',
    'sync'
  )),
  reason TEXT NOT NULL DEFAULT 'inventory',
  reference_type TEXT,
  reference_id UUID,
  previous_from_quantity INTEGER CHECK (previous_from_quantity IS NULL OR previous_from_quantity >= 0),
  new_from_quantity INTEGER CHECK (new_from_quantity IS NULL OR new_from_quantity >= 0),
  previous_to_quantity INTEGER CHECK (previous_to_quantity IS NULL OR previous_to_quantity >= 0),
  new_to_quantity INTEGER CHECK (new_to_quantity IS NULL OR new_to_quantity >= 0),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_location_movements_company_id ON stock_location_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_location_movements_product_id ON stock_location_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_location_movements_created_at ON stock_location_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_location_movements_reference ON stock_location_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_location_movements_from_location ON stock_location_movements(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_location_movements_to_location ON stock_location_movements(to_location_id);

ALTER TABLE stock_location_movements ENABLE ROW LEVEL SECURITY;

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

CREATE OR REPLACE FUNCTION ensure_default_stock_location(target_company_id UUID)
RETURNS TABLE(deposit_id UUID, location_id UUID)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  default_deposit_id UUID;
  default_location_id UUID;
BEGIN
  INSERT INTO stock_deposits (company_id, name, code, type, is_default, is_active)
  VALUES (target_company_id, 'Loja Principal', 'LOJA-PRINCIPAL', 'store', TRUE, TRUE)
  ON CONFLICT (company_id, code)
  DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    is_default = TRUE,
    is_active = TRUE,
    updated_at = NOW()
  RETURNING id INTO default_deposit_id;

  INSERT INTO stock_locations (company_id, deposit_id, name, code, description, is_default, is_active)
  VALUES (
    target_company_id,
    default_deposit_id,
    'Estoque Geral',
    'ESTOQUE-GERAL',
    'Local padrao criado automaticamente para migracao inicial de estoque.',
    TRUE,
    TRUE
  )
  ON CONFLICT ON CONSTRAINT stock_locations_deposit_id_code_key
  DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_default = TRUE,
    is_active = TRUE,
    updated_at = NOW()
  RETURNING id INTO default_location_id;

  RETURN QUERY SELECT default_deposit_id, default_location_id;
END;
$$;

SELECT ensure_default_stock_location(id)
FROM companies;

CREATE OR REPLACE FUNCTION recalculate_product_stock_from_locations(target_product_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_stock_quantity INTEGER;
BEGIN
  SELECT COALESCE(SUM(quantity), 0)::INTEGER
  INTO new_stock_quantity
  FROM product_stock_locations
  WHERE product_id = target_product_id;

  UPDATE products
  SET
    stock_quantity = new_stock_quantity,
    updated_at = NOW()
  WHERE id = target_product_id;

  RETURN new_stock_quantity;
END;
$$;

CREATE OR REPLACE FUNCTION adjust_product_stock_location(
  target_product_id UUID,
  target_deposit_id UUID,
  target_location_id UUID,
  target_quantity INTEGER,
  adjustment_reason TEXT,
  adjustment_notes TEXT DEFAULT NULL,
  actor_id UUID DEFAULT NULL
)
RETURNS product_stock_locations
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_company_id UUID;
  current_row product_stock_locations%ROWTYPE;
  updated_row product_stock_locations%ROWTYPE;
  current_quantity INTEGER := 0;
  current_reserved_quantity INTEGER := 0;
BEGIN
  IF target_quantity < 0 THEN
    RAISE EXCEPTION 'A quantidade ajustada nao pode ser negativa.';
  END IF;

  IF COALESCE(TRIM(adjustment_reason), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo do ajuste.';
  END IF;

  SELECT company_id
  INTO target_company_id
  FROM products
  WHERE id = target_product_id;

  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Produto nao encontrado para ajuste de estoque.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM stock_deposits
    WHERE id = target_deposit_id
      AND company_id = target_company_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Deposito invalido para este produto.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM stock_locations
    WHERE id = target_location_id
      AND deposit_id = target_deposit_id
      AND company_id = target_company_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Local invalido para este deposito.';
  END IF;

  SELECT *
  INTO current_row
  FROM product_stock_locations
  WHERE product_id = target_product_id
    AND deposit_id = target_deposit_id
    AND location_id = target_location_id
  FOR UPDATE;

  IF FOUND THEN
    current_quantity := current_row.quantity;
    current_reserved_quantity := current_row.reserved_quantity;
  END IF;

  IF target_quantity < current_reserved_quantity THEN
    RAISE EXCEPTION 'A quantidade ajustada nao pode ficar menor que o saldo reservado atual.';
  END IF;

  IF target_quantity = current_quantity THEN
    RAISE EXCEPTION 'A quantidade ajustada precisa ser diferente da quantidade atual.';
  END IF;

  INSERT INTO product_stock_locations (
    company_id,
    product_id,
    deposit_id,
    location_id,
    quantity,
    reserved_quantity
  )
  VALUES (
    target_company_id,
    target_product_id,
    target_deposit_id,
    target_location_id,
    target_quantity,
    current_reserved_quantity
  )
  ON CONFLICT (product_id, deposit_id, location_id)
  DO UPDATE SET
    quantity = EXCLUDED.quantity,
    reserved_quantity = EXCLUDED.reserved_quantity,
    updated_at = NOW()
  RETURNING * INTO updated_row;

  INSERT INTO stock_location_movements (
    company_id,
    product_id,
    from_deposit_id,
    from_location_id,
    to_deposit_id,
    to_location_id,
    quantity,
    movement_type,
    reason,
    reference_type,
    previous_from_quantity,
    new_from_quantity,
    previous_to_quantity,
    new_to_quantity,
    notes,
    created_by
  )
  VALUES (
    target_company_id,
    target_product_id,
    target_deposit_id,
    target_location_id,
    target_deposit_id,
    target_location_id,
    ABS(target_quantity - current_quantity),
    'adjustment',
    adjustment_reason,
    'manual_adjustment',
    current_quantity,
    target_quantity,
    current_quantity,
    target_quantity,
    adjustment_notes,
    actor_id
  );

  PERFORM recalculate_product_stock_from_locations(target_product_id);

  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION restore_product_stock_from_sale_movements(
  p_sale_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  sale_movement_id UUID,
  product_id UUID,
  deposit_id UUID,
  location_id UUID,
  quantity_restored INTEGER,
  previous_quantity INTEGER,
  new_quantity INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sale_movement RECORD;
  stock_row product_stock_locations%ROWTYPE;
  restored_row product_stock_locations%ROWTYPE;
  current_quantity INTEGER := 0;
  current_reserved_quantity INTEGER := 0;
  restored_any BOOLEAN := FALSE;
BEGIN
  IF p_sale_id IS NULL THEN
    RAISE EXCEPTION 'sale_required';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM stock_location_movements slm
    WHERE slm.reference_type = 'sale_restore'
      AND slm.reference_id = p_sale_id
      AND slm.movement_type = 'cancel'
  ) THEN
    RETURN;
  END IF;

  FOR sale_movement IN
    SELECT *
    FROM stock_location_movements slm
    WHERE slm.reference_type = 'sale'
      AND slm.reference_id = p_sale_id
      AND slm.movement_type = 'sale'
      AND slm.from_deposit_id IS NOT NULL
      AND slm.from_location_id IS NOT NULL
    ORDER BY slm.created_at ASC, slm.id ASC
    FOR UPDATE
  LOOP
    restored_any := TRUE;
    current_quantity := 0;
    current_reserved_quantity := 0;

    SELECT *
    INTO stock_row
    FROM product_stock_locations psl
    WHERE psl.product_id = sale_movement.product_id
      AND psl.deposit_id = sale_movement.from_deposit_id
      AND psl.location_id = sale_movement.from_location_id
    FOR UPDATE;

    IF FOUND THEN
      current_quantity := stock_row.quantity;
      current_reserved_quantity := stock_row.reserved_quantity;
    END IF;

    INSERT INTO product_stock_locations (
      company_id,
      product_id,
      deposit_id,
      location_id,
      quantity,
      reserved_quantity
    )
    VALUES (
      sale_movement.company_id,
      sale_movement.product_id,
      sale_movement.from_deposit_id,
      sale_movement.from_location_id,
      current_quantity + sale_movement.quantity,
      current_reserved_quantity
    )
    ON CONFLICT (product_id, deposit_id, location_id)
    DO UPDATE SET
      quantity = product_stock_locations.quantity + sale_movement.quantity,
      reserved_quantity = product_stock_locations.reserved_quantity,
      updated_at = NOW()
    RETURNING * INTO restored_row;

    INSERT INTO stock_location_movements (
      company_id,
      product_id,
      from_deposit_id,
      from_location_id,
      to_deposit_id,
      to_location_id,
      quantity,
      movement_type,
      reason,
      reference_type,
      reference_id,
      previous_from_quantity,
      new_from_quantity,
      previous_to_quantity,
      new_to_quantity,
      notes,
      created_by
    )
    VALUES (
      sale_movement.company_id,
      sale_movement.product_id,
      NULL,
      NULL,
      sale_movement.from_deposit_id,
      sale_movement.from_location_id,
      sale_movement.quantity,
      'cancel',
      p_reason,
      'sale_restore',
      p_sale_id,
      NULL,
      NULL,
      current_quantity,
      restored_row.quantity,
      p_notes,
      auth.uid()
    );

    PERFORM recalculate_product_stock_from_locations(sale_movement.product_id);

    sale_movement_id := sale_movement.id;
    product_id := sale_movement.product_id;
    deposit_id := sale_movement.from_deposit_id;
    location_id := sale_movement.from_location_id;
    quantity_restored := sale_movement.quantity;
    previous_quantity := current_quantity;
    new_quantity := restored_row.quantity;
    RETURN NEXT;
  END LOOP;

  IF NOT restored_any THEN
    RAISE EXCEPTION 'sale_location_movements_not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION restore_product_stock_from_order_movements(
  p_order_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  order_movement_id UUID,
  product_id UUID,
  deposit_id UUID,
  location_id UUID,
  quantity_restored INTEGER,
  previous_quantity INTEGER,
  new_quantity INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  order_movement RECORD;
  stock_row product_stock_locations%ROWTYPE;
  restored_row product_stock_locations%ROWTYPE;
  current_quantity INTEGER := 0;
  current_reserved_quantity INTEGER := 0;
  restored_any BOOLEAN := FALSE;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_required';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM stock_location_movements slm
    WHERE slm.reference_type = 'order_restore'
      AND slm.reference_id = p_order_id
      AND slm.movement_type = 'cancel'
  ) THEN
    RETURN;
  END IF;

  FOR order_movement IN
    SELECT *
    FROM stock_location_movements slm
    WHERE slm.reference_type = 'order'
      AND slm.reference_id = p_order_id
      AND slm.movement_type = 'sale'
      AND slm.from_deposit_id IS NOT NULL
      AND slm.from_location_id IS NOT NULL
    ORDER BY slm.created_at ASC, slm.id ASC
    FOR UPDATE
  LOOP
    restored_any := TRUE;
    current_quantity := 0;
    current_reserved_quantity := 0;

    SELECT *
    INTO stock_row
    FROM product_stock_locations psl
    WHERE psl.product_id = order_movement.product_id
      AND psl.deposit_id = order_movement.from_deposit_id
      AND psl.location_id = order_movement.from_location_id
    FOR UPDATE;

    IF FOUND THEN
      current_quantity := stock_row.quantity;
      current_reserved_quantity := stock_row.reserved_quantity;
    END IF;

    INSERT INTO product_stock_locations (
      company_id,
      product_id,
      deposit_id,
      location_id,
      quantity,
      reserved_quantity
    )
    VALUES (
      order_movement.company_id,
      order_movement.product_id,
      order_movement.from_deposit_id,
      order_movement.from_location_id,
      current_quantity + order_movement.quantity,
      current_reserved_quantity
    )
    ON CONFLICT (product_id, deposit_id, location_id)
    DO UPDATE SET
      quantity = product_stock_locations.quantity + order_movement.quantity,
      reserved_quantity = product_stock_locations.reserved_quantity,
      updated_at = NOW()
    RETURNING * INTO restored_row;

    INSERT INTO stock_location_movements (
      company_id,
      product_id,
      from_deposit_id,
      from_location_id,
      to_deposit_id,
      to_location_id,
      quantity,
      movement_type,
      reason,
      reference_type,
      reference_id,
      previous_from_quantity,
      new_from_quantity,
      previous_to_quantity,
      new_to_quantity,
      notes,
      created_by
    )
    VALUES (
      order_movement.company_id,
      order_movement.product_id,
      NULL,
      NULL,
      order_movement.from_deposit_id,
      order_movement.from_location_id,
      order_movement.quantity,
      'cancel',
      p_reason,
      'order_restore',
      p_order_id,
      NULL,
      NULL,
      current_quantity,
      restored_row.quantity,
      p_notes,
      auth.uid()
    );

    PERFORM recalculate_product_stock_from_locations(order_movement.product_id);

    order_movement_id := order_movement.id;
    product_id := order_movement.product_id;
    deposit_id := order_movement.from_deposit_id;
    location_id := order_movement.from_location_id;
    quantity_restored := order_movement.quantity;
    previous_quantity := current_quantity;
    new_quantity := restored_row.quantity;
    RETURN NEXT;
  END LOOP;

  IF NOT restored_any THEN
    RAISE EXCEPTION 'order_location_movements_not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION add_product_stock_location(
  target_product_id UUID,
  target_deposit_id UUID,
  target_location_id UUID,
  entry_quantity INTEGER,
  entry_reason TEXT,
  entry_notes TEXT DEFAULT NULL,
  actor_id UUID DEFAULT NULL
)
RETURNS product_stock_locations
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_company_id UUID;
  current_row product_stock_locations%ROWTYPE;
  updated_row product_stock_locations%ROWTYPE;
  current_quantity INTEGER := 0;
  current_reserved_quantity INTEGER := 0;
BEGIN
  IF entry_quantity <= 0 THEN
    RAISE EXCEPTION 'A quantidade de entrada precisa ser maior que zero.';
  END IF;

  IF COALESCE(TRIM(entry_reason), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo da entrada.';
  END IF;

  SELECT company_id
  INTO target_company_id
  FROM products
  WHERE id = target_product_id;

  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Produto nao encontrado para entrada de estoque.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM stock_deposits
    WHERE id = target_deposit_id
      AND company_id = target_company_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Deposito invalido para este produto.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM stock_locations
    WHERE id = target_location_id
      AND deposit_id = target_deposit_id
      AND company_id = target_company_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Local invalido para este deposito.';
  END IF;

  SELECT *
  INTO current_row
  FROM product_stock_locations
  WHERE product_id = target_product_id
    AND deposit_id = target_deposit_id
    AND location_id = target_location_id
  FOR UPDATE;

  IF FOUND THEN
    current_quantity := current_row.quantity;
    current_reserved_quantity := current_row.reserved_quantity;
  END IF;

  INSERT INTO product_stock_locations (
    company_id,
    product_id,
    deposit_id,
    location_id,
    quantity,
    reserved_quantity
  )
  VALUES (
    target_company_id,
    target_product_id,
    target_deposit_id,
    target_location_id,
    current_quantity + entry_quantity,
    current_reserved_quantity
  )
  ON CONFLICT (product_id, deposit_id, location_id)
  DO UPDATE SET
    quantity = product_stock_locations.quantity + EXCLUDED.quantity - current_quantity,
    reserved_quantity = product_stock_locations.reserved_quantity,
    updated_at = NOW()
  RETURNING * INTO updated_row;

  INSERT INTO stock_location_movements (
    company_id,
    product_id,
    from_deposit_id,
    from_location_id,
    to_deposit_id,
    to_location_id,
    quantity,
    movement_type,
    reason,
    reference_type,
    previous_from_quantity,
    new_from_quantity,
    previous_to_quantity,
    new_to_quantity,
    notes,
    created_by
  )
  VALUES (
    target_company_id,
    target_product_id,
    NULL,
    NULL,
    target_deposit_id,
    target_location_id,
    entry_quantity,
    'in',
    entry_reason,
    'stock_entry',
    NULL,
    NULL,
    current_quantity,
    updated_row.quantity,
    entry_notes,
    actor_id
  );

  PERFORM recalculate_product_stock_from_locations(target_product_id);

  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION transfer_product_stock_location(
  target_product_id UUID,
  from_deposit_id UUID,
  from_location_id UUID,
  to_deposit_id UUID,
  to_location_id UUID,
  transfer_quantity INTEGER,
  transfer_reason TEXT,
  transfer_notes TEXT DEFAULT NULL,
  actor_id UUID DEFAULT NULL
)
RETURNS SETOF product_stock_locations
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_company_id UUID;
  source_deposit_id ALIAS FOR $2;
  source_location_id ALIAS FOR $3;
  target_deposit_id ALIAS FOR $4;
  target_location_id ALIAS FOR $5;
  source_row product_stock_locations%ROWTYPE;
  target_row product_stock_locations%ROWTYPE;
  source_quantity INTEGER := 0;
  source_reserved_quantity INTEGER := 0;
  target_quantity INTEGER := 0;
  target_reserved_quantity INTEGER := 0;
  from_available_quantity INTEGER := 0;
BEGIN
  IF transfer_quantity <= 0 THEN
    RAISE EXCEPTION 'A quantidade transferida precisa ser maior que zero.';
  END IF;

  IF COALESCE(TRIM(transfer_reason), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo da transferencia.';
  END IF;

  IF source_location_id = target_location_id THEN
    RAISE EXCEPTION 'A origem e destino precisam ser diferentes.';
  END IF;

  SELECT company_id
  INTO target_company_id
  FROM products
  WHERE id = target_product_id;

  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Produto nao encontrado para transferencia de estoque.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM stock_locations sl
    WHERE sl.id = source_location_id
      AND sl.deposit_id = source_deposit_id
      AND sl.company_id = target_company_id
      AND sl.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Local de origem invalido para este produto.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM stock_locations sl
    WHERE sl.id = target_location_id
      AND sl.deposit_id = target_deposit_id
      AND sl.company_id = target_company_id
      AND sl.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Local de destino invalido para este produto.';
  END IF;

  SELECT *
  INTO source_row
  FROM product_stock_locations psl
  WHERE psl.product_id = target_product_id
    AND psl.deposit_id = source_deposit_id
    AND psl.location_id = source_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nao ha saldo cadastrado no local de origem.';
  END IF;

  source_quantity := source_row.quantity;
  source_reserved_quantity := source_row.reserved_quantity;
  from_available_quantity := source_quantity - source_reserved_quantity;

  IF transfer_quantity > from_available_quantity THEN
    RAISE EXCEPTION 'A quantidade transferida excede o saldo disponivel na origem.';
  END IF;

  SELECT *
  INTO target_row
  FROM product_stock_locations psl
  WHERE psl.product_id = target_product_id
    AND psl.deposit_id = target_deposit_id
    AND psl.location_id = target_location_id
  FOR UPDATE;

  IF FOUND THEN
    target_quantity := target_row.quantity;
    target_reserved_quantity := target_row.reserved_quantity;
  END IF;

  UPDATE product_stock_locations
  SET
    quantity = source_quantity - transfer_quantity,
    reserved_quantity = source_reserved_quantity,
    updated_at = NOW()
  WHERE id = source_row.id;

  INSERT INTO product_stock_locations (
    company_id,
    product_id,
    deposit_id,
    location_id,
    quantity,
    reserved_quantity
  )
  VALUES (
    target_company_id,
    target_product_id,
    target_deposit_id,
    target_location_id,
    target_quantity + transfer_quantity,
    target_reserved_quantity
  )
  ON CONFLICT (product_id, deposit_id, location_id)
  DO UPDATE SET
    quantity = product_stock_locations.quantity + transfer_quantity,
    reserved_quantity = product_stock_locations.reserved_quantity,
    updated_at = NOW();

  INSERT INTO stock_location_movements (
    company_id,
    product_id,
    from_deposit_id,
    from_location_id,
    to_deposit_id,
    to_location_id,
    quantity,
    movement_type,
    reason,
    reference_type,
    previous_from_quantity,
    new_from_quantity,
    previous_to_quantity,
    new_to_quantity,
    notes,
    created_by
  )
  VALUES (
    target_company_id,
    target_product_id,
    source_deposit_id,
    source_location_id,
    target_deposit_id,
    target_location_id,
    transfer_quantity,
    'transfer',
    transfer_reason,
    'manual_transfer',
    source_quantity,
    source_quantity - transfer_quantity,
    target_quantity,
    target_quantity + transfer_quantity,
    transfer_notes,
    actor_id
  );

  RETURN QUERY
  SELECT *
  FROM product_stock_locations psl
  WHERE psl.product_id = target_product_id
    AND (
      psl.location_id = source_location_id
      OR psl.location_id = target_location_id
    )
  ORDER BY psl.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION reserve_product_stock_by_priority(
  p_product_id UUID,
  p_quantity INTEGER,
  p_reason TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  stock_location_id UUID,
  deposit_id UUID,
  location_id UUID,
  quantity_reserved INTEGER,
  previous_reserved_quantity INTEGER,
  new_reserved_quantity INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  stock_row RECORD;
  remaining_quantity INTEGER;
  available_quantity INTEGER;
  reserve_quantity INTEGER;
  total_available INTEGER := 0;
BEGIN
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'product_required';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  FOR stock_row IN
    SELECT
      psl.id AS stock_location_id,
      psl.company_id,
      psl.product_id,
      psl.deposit_id,
      psl.location_id,
      psl.quantity,
      psl.reserved_quantity,
      sd.is_default AS is_default_deposit,
      sd.name AS deposit_name,
      sl.is_default AS is_default_location,
      sl.name AS location_name
    FROM product_stock_locations psl
    JOIN stock_deposits sd ON sd.id = psl.deposit_id
    JOIN stock_locations sl ON sl.id = psl.location_id
    WHERE psl.product_id = p_product_id
      AND sd.is_active = TRUE
      AND sl.is_active = TRUE
    ORDER BY
      sd.is_default DESC,
      sd.name ASC,
      sl.is_default DESC,
      sl.name ASC
    FOR UPDATE OF psl
  LOOP
    total_available := total_available + GREATEST(stock_row.quantity - stock_row.reserved_quantity, 0);
  END LOOP;

  IF total_available < p_quantity THEN
    RAISE EXCEPTION 'insufficient_stock_by_location';
  END IF;

  remaining_quantity := p_quantity;

  FOR stock_row IN
    SELECT
      psl.id AS stock_location_id,
      psl.company_id,
      psl.product_id,
      psl.deposit_id,
      psl.location_id,
      psl.quantity,
      psl.reserved_quantity,
      sd.is_default AS is_default_deposit,
      sd.name AS deposit_name,
      sl.is_default AS is_default_location,
      sl.name AS location_name
    FROM product_stock_locations psl
    JOIN stock_deposits sd ON sd.id = psl.deposit_id
    JOIN stock_locations sl ON sl.id = psl.location_id
    WHERE psl.product_id = p_product_id
      AND sd.is_active = TRUE
      AND sl.is_active = TRUE
    ORDER BY
      sd.is_default DESC,
      sd.name ASC,
      sl.is_default DESC,
      sl.name ASC
    FOR UPDATE OF psl
  LOOP
    EXIT WHEN remaining_quantity <= 0;

    available_quantity := GREATEST(stock_row.quantity - stock_row.reserved_quantity, 0);
    CONTINUE WHEN available_quantity <= 0;

    reserve_quantity := LEAST(available_quantity, remaining_quantity);

    UPDATE product_stock_locations psl
    SET reserved_quantity = stock_row.reserved_quantity + reserve_quantity,
        updated_at = NOW()
    WHERE psl.id = stock_row.stock_location_id;

    INSERT INTO stock_location_movements (
      company_id,
      product_id,
      from_deposit_id,
      from_location_id,
      quantity,
      movement_type,
      reason,
      reference_type,
      reference_id,
      previous_from_quantity,
      new_from_quantity,
      notes,
      created_by
    )
    VALUES (
      stock_row.company_id,
      p_product_id,
      stock_row.deposit_id,
      stock_row.location_id,
      reserve_quantity,
      'reservation',
      trim(p_reason),
      p_reference_type,
      p_reference_id,
      stock_row.reserved_quantity,
      stock_row.reserved_quantity + reserve_quantity,
      NULLIF(trim(COALESCE(p_notes, '')), ''),
      auth.uid()
    );

    stock_location_id := stock_row.stock_location_id;
    deposit_id := stock_row.deposit_id;
    location_id := stock_row.location_id;
    quantity_reserved := reserve_quantity;
    previous_reserved_quantity := stock_row.reserved_quantity;
    new_reserved_quantity := stock_row.reserved_quantity + reserve_quantity;
    RETURN NEXT;

    remaining_quantity := remaining_quantity - reserve_quantity;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION consume_order_stock_reservations(
  p_order_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  reservation_movement_id UUID,
  product_id UUID,
  deposit_id UUID,
  location_id UUID,
  quantity_processed INTEGER,
  previous_quantity INTEGER,
  new_quantity INTEGER,
  previous_reserved_quantity INTEGER,
  new_reserved_quantity INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  reservation_movement RECORD;
  stock_row product_stock_locations%ROWTYPE;
  processed_any BOOLEAN := FALSE;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_required';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM stock_location_movements slm
    WHERE slm.reference_type = 'order'
      AND slm.reference_id = p_order_id
      AND slm.movement_type = 'sale'
  ) THEN
    RETURN;
  END IF;

  FOR reservation_movement IN
    SELECT *
    FROM stock_location_movements slm
    WHERE slm.reference_type = 'order_reservation'
      AND slm.reference_id = p_order_id
      AND slm.movement_type = 'reservation'
      AND slm.from_deposit_id IS NOT NULL
      AND slm.from_location_id IS NOT NULL
    ORDER BY slm.created_at ASC, slm.id ASC
    FOR UPDATE
  LOOP
    processed_any := TRUE;

    SELECT *
    INTO stock_row
    FROM product_stock_locations psl
    WHERE psl.product_id = reservation_movement.product_id
      AND psl.deposit_id = reservation_movement.from_deposit_id
      AND psl.location_id = reservation_movement.from_location_id
    FOR UPDATE;

    IF NOT FOUND
      OR stock_row.quantity < reservation_movement.quantity
      OR stock_row.reserved_quantity < reservation_movement.quantity
    THEN
      RAISE EXCEPTION 'order_reservation_stock_inconsistent';
    END IF;

    UPDATE product_stock_locations psl
    SET quantity = stock_row.quantity - reservation_movement.quantity,
        reserved_quantity = stock_row.reserved_quantity - reservation_movement.quantity,
        updated_at = NOW()
    WHERE psl.id = stock_row.id;

    INSERT INTO stock_location_movements (
      company_id,
      product_id,
      from_deposit_id,
      from_location_id,
      quantity,
      movement_type,
      reason,
      reference_type,
      reference_id,
      previous_from_quantity,
      new_from_quantity,
      notes,
      created_by
    )
    VALUES (
      reservation_movement.company_id,
      reservation_movement.product_id,
      reservation_movement.from_deposit_id,
      reservation_movement.from_location_id,
      reservation_movement.quantity,
      'sale',
      trim(p_reason),
      'order',
      p_order_id,
      stock_row.quantity,
      stock_row.quantity - reservation_movement.quantity,
      NULLIF(trim(COALESCE(p_notes, '')), ''),
      auth.uid()
    );

    PERFORM recalculate_product_stock_from_locations(reservation_movement.product_id);

    reservation_movement_id := reservation_movement.id;
    product_id := reservation_movement.product_id;
    deposit_id := reservation_movement.from_deposit_id;
    location_id := reservation_movement.from_location_id;
    quantity_processed := reservation_movement.quantity;
    previous_quantity := stock_row.quantity;
    new_quantity := stock_row.quantity - reservation_movement.quantity;
    previous_reserved_quantity := stock_row.reserved_quantity;
    new_reserved_quantity := stock_row.reserved_quantity - reservation_movement.quantity;
    RETURN NEXT;
  END LOOP;

  IF NOT processed_any THEN
    RAISE EXCEPTION 'order_reservations_not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION release_order_stock_reservations(
  p_order_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  reservation_movement_id UUID,
  product_id UUID,
  deposit_id UUID,
  location_id UUID,
  quantity_processed INTEGER,
  previous_quantity INTEGER,
  new_quantity INTEGER,
  previous_reserved_quantity INTEGER,
  new_reserved_quantity INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  reservation_movement RECORD;
  stock_row product_stock_locations%ROWTYPE;
  processed_any BOOLEAN := FALSE;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_required';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM stock_location_movements slm
    WHERE slm.reference_type = 'order_release'
      AND slm.reference_id = p_order_id
      AND slm.movement_type = 'release_reservation'
  ) OR EXISTS (
    SELECT 1
    FROM stock_location_movements slm
    WHERE slm.reference_type = 'order'
      AND slm.reference_id = p_order_id
      AND slm.movement_type = 'sale'
  ) THEN
    RETURN;
  END IF;

  FOR reservation_movement IN
    SELECT *
    FROM stock_location_movements slm
    WHERE slm.reference_type = 'order_reservation'
      AND slm.reference_id = p_order_id
      AND slm.movement_type = 'reservation'
      AND slm.from_deposit_id IS NOT NULL
      AND slm.from_location_id IS NOT NULL
    ORDER BY slm.created_at ASC, slm.id ASC
    FOR UPDATE
  LOOP
    processed_any := TRUE;

    SELECT *
    INTO stock_row
    FROM product_stock_locations psl
    WHERE psl.product_id = reservation_movement.product_id
      AND psl.deposit_id = reservation_movement.from_deposit_id
      AND psl.location_id = reservation_movement.from_location_id
    FOR UPDATE;

    IF NOT FOUND OR stock_row.reserved_quantity < reservation_movement.quantity THEN
      RAISE EXCEPTION 'order_reservation_stock_inconsistent';
    END IF;

    UPDATE product_stock_locations psl
    SET reserved_quantity = stock_row.reserved_quantity - reservation_movement.quantity,
        updated_at = NOW()
    WHERE psl.id = stock_row.id;

    INSERT INTO stock_location_movements (
      company_id,
      product_id,
      from_deposit_id,
      from_location_id,
      quantity,
      movement_type,
      reason,
      reference_type,
      reference_id,
      previous_from_quantity,
      new_from_quantity,
      notes,
      created_by
    )
    VALUES (
      reservation_movement.company_id,
      reservation_movement.product_id,
      reservation_movement.from_deposit_id,
      reservation_movement.from_location_id,
      reservation_movement.quantity,
      'release_reservation',
      trim(p_reason),
      'order_release',
      p_order_id,
      stock_row.reserved_quantity,
      stock_row.reserved_quantity - reservation_movement.quantity,
      NULLIF(trim(COALESCE(p_notes, '')), ''),
      auth.uid()
    );

    reservation_movement_id := reservation_movement.id;
    product_id := reservation_movement.product_id;
    deposit_id := reservation_movement.from_deposit_id;
    location_id := reservation_movement.from_location_id;
    quantity_processed := reservation_movement.quantity;
    previous_quantity := stock_row.quantity;
    new_quantity := stock_row.quantity;
    previous_reserved_quantity := stock_row.reserved_quantity;
    new_reserved_quantity := stock_row.reserved_quantity - reservation_movement.quantity;
    RETURN NEXT;
  END LOOP;

  IF NOT processed_any THEN
    RAISE EXCEPTION 'order_reservations_not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_product_stock_by_priority(
  p_product_id UUID,
  p_quantity INTEGER,
  p_reason TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  stock_location_id UUID,
  deposit_id UUID,
  location_id UUID,
  quantity_decremented INTEGER,
  previous_quantity INTEGER,
  new_quantity INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  stock_row RECORD;
  remaining_quantity INTEGER;
  available_quantity INTEGER;
  decrement_quantity INTEGER;
  total_available INTEGER := 0;
BEGIN
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'product_required';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS priority_stock_rows (
    stock_location_id UUID,
    company_id UUID,
    product_id UUID,
    deposit_id UUID,
    location_id UUID,
    quantity INTEGER,
    reserved_quantity INTEGER,
    is_default_deposit BOOLEAN,
    deposit_name TEXT,
    is_default_location BOOLEAN,
    location_name TEXT
  ) ON COMMIT DROP;

  TRUNCATE priority_stock_rows;

  FOR stock_row IN
    SELECT
      psl.id AS stock_location_id,
      psl.company_id,
      psl.product_id,
      psl.deposit_id,
      psl.location_id,
      psl.quantity,
      psl.reserved_quantity,
      sd.is_default AS is_default_deposit,
      sd.name AS deposit_name,
      sl.is_default AS is_default_location,
      sl.name AS location_name
    FROM product_stock_locations psl
    JOIN stock_deposits sd ON sd.id = psl.deposit_id
    JOIN stock_locations sl ON sl.id = psl.location_id
    WHERE psl.product_id = p_product_id
      AND sd.is_active = TRUE
      AND sl.is_active = TRUE
    ORDER BY
      sd.is_default DESC,
      sd.name ASC,
      sl.is_default DESC,
      sl.name ASC
    FOR UPDATE OF psl
  LOOP
    INSERT INTO priority_stock_rows (
      stock_location_id,
      company_id,
      product_id,
      deposit_id,
      location_id,
      quantity,
      reserved_quantity,
      is_default_deposit,
      deposit_name,
      is_default_location,
      location_name
    )
    VALUES (
      stock_row.stock_location_id,
      stock_row.company_id,
      stock_row.product_id,
      stock_row.deposit_id,
      stock_row.location_id,
      stock_row.quantity,
      stock_row.reserved_quantity,
      stock_row.is_default_deposit,
      stock_row.deposit_name,
      stock_row.is_default_location,
      stock_row.location_name
    );

    total_available := total_available + GREATEST(stock_row.quantity - stock_row.reserved_quantity, 0);
  END LOOP;

  IF total_available < p_quantity THEN
    RAISE EXCEPTION 'insufficient_stock_by_location';
  END IF;

  remaining_quantity := p_quantity;

  FOR stock_row IN
    SELECT *
    FROM priority_stock_rows psr
    ORDER BY
      psr.is_default_deposit DESC,
      psr.deposit_name ASC,
      psr.is_default_location DESC,
      psr.location_name ASC
  LOOP
    EXIT WHEN remaining_quantity <= 0;

    available_quantity := GREATEST(stock_row.quantity - stock_row.reserved_quantity, 0);
    CONTINUE WHEN available_quantity <= 0;

    decrement_quantity := LEAST(available_quantity, remaining_quantity);

    UPDATE product_stock_locations psl
    SET quantity = stock_row.quantity - decrement_quantity,
        updated_at = NOW()
    WHERE psl.id = stock_row.stock_location_id;

    INSERT INTO stock_location_movements (
      company_id,
      product_id,
      from_deposit_id,
      from_location_id,
      quantity,
      movement_type,
      reason,
      reference_type,
      reference_id,
      previous_from_quantity,
      new_from_quantity,
      notes,
      created_by
    )
    VALUES (
      stock_row.company_id,
      p_product_id,
      stock_row.deposit_id,
      stock_row.location_id,
      decrement_quantity,
      'sale',
      trim(p_reason),
      p_reference_type,
      p_reference_id,
      stock_row.quantity,
      stock_row.quantity - decrement_quantity,
      NULLIF(trim(COALESCE(p_notes, '')), ''),
      auth.uid()
    );

    stock_location_id := stock_row.stock_location_id;
    deposit_id := stock_row.deposit_id;
    location_id := stock_row.location_id;
    quantity_decremented := decrement_quantity;
    previous_quantity := stock_row.quantity;
    new_quantity := stock_row.quantity - decrement_quantity;
    RETURN NEXT;

    remaining_quantity := remaining_quantity - decrement_quantity;
  END LOOP;

  PERFORM recalculate_product_stock_from_locations(p_product_id);
END;
$$;

WITH default_locations AS (
  SELECT
    d.company_id,
    d.id AS deposit_id,
    l.id AS location_id
  FROM stock_deposits d
  JOIN stock_locations l ON l.deposit_id = d.id
  WHERE d.code = 'LOJA-PRINCIPAL'
    AND l.code = 'ESTOQUE-GERAL'
)
INSERT INTO product_stock_locations (
  company_id,
  product_id,
  deposit_id,
  location_id,
  quantity,
  reserved_quantity
)
SELECT
  p.company_id,
  p.id,
  dl.deposit_id,
  dl.location_id,
  COALESCE(p.stock_quantity, 0),
  0
FROM products p
JOIN default_locations dl ON dl.company_id = p.company_id
WHERE COALESCE(p.stock_quantity, 0) > 0
ON CONFLICT (product_id, deposit_id, location_id)
DO UPDATE SET
  quantity = EXCLUDED.quantity,
  updated_at = NOW();

INSERT INTO stock_location_movements (
  company_id,
  product_id,
  to_deposit_id,
  to_location_id,
  quantity,
  movement_type,
  reason,
  reference_type,
  previous_to_quantity,
  new_to_quantity,
  notes
)
SELECT
  psl.company_id,
  psl.product_id,
  psl.deposit_id,
  psl.location_id,
  psl.quantity,
  'sync',
  'inventory',
  'initial_migration',
  0,
  psl.quantity,
  'Saldo inicial migrado de products.stock_quantity para Loja Principal / Estoque Geral.'
FROM product_stock_locations psl
WHERE psl.quantity > 0
  AND NOT EXISTS (
    SELECT 1
    FROM stock_location_movements existing
    WHERE existing.product_id = psl.product_id
      AND existing.reference_type = 'initial_migration'
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

COMMENT ON TABLE stock_deposits IS 'Depositos, lojas e pontos fisicos usados para organizar estoque interno.';
COMMENT ON TABLE stock_locations IS 'Locais internos dentro de cada deposito, como balcao, prateleira, armario ou caixa.';
COMMENT ON TABLE product_stock_locations IS 'Saldo interno de produtos comuns por deposito/local.';
COMMENT ON TABLE stock_location_movements IS 'Historico imutavel de movimentacoes de estoque por deposito/local.';
COMMENT ON VIEW stock_location_divergences IS 'Conferencia entre products.stock_quantity e a soma dos saldos internos por local.';
