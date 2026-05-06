-- Security Advisor fixes (2026-05-05)
-- Endereça os 6 alertas ERROR do Supabase Advisor:
--  - rls_disabled_in_public: instagram_schedule, webhook_logs, legacy_sales_pending, shopee_products
--  - policy_exists_rls_disabled: instagram_schedule (policies criadas mas RLS off)
--  - security_definer_view: ai_product_catalog_view

-- 1. instagram_schedule — policies já existem; só ligar RLS
ALTER TABLE public.instagram_schedule ENABLE ROW LEVEL SECURITY;

-- 2. webhook_logs — append-only por webhooks (service_role bypassa RLS).
--    Admin lê pelo BlingPage com sessão autenticada.
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read webhook_logs" ON public.webhook_logs;
CREATE POLICY "Authenticated can read webhook_logs"
  ON public.webhook_logs FOR SELECT
  TO authenticated
  USING (true);

-- 3. legacy_sales_pending — staging do import legacy; só admin via UI autenticada
ALTER TABLE public.legacy_sales_pending ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can manage legacy_sales_pending" ON public.legacy_sales_pending;
CREATE POLICY "Authenticated can manage legacy_sales_pending"
  ON public.legacy_sales_pending FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. shopee_products — anon lê item_id pro link no card; admin gerencia o sync
ALTER TABLE public.shopee_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can read shopee_products" ON public.shopee_products;
CREATE POLICY "Anon can read shopee_products"
  ON public.shopee_products FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated can manage shopee_products" ON public.shopee_products;
CREATE POLICY "Authenticated can manage shopee_products"
  ON public.shopee_products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. ai_product_catalog_view — DEFINER → INVOKER pra respeitar RLS de quem chama
ALTER VIEW public.ai_product_catalog_view SET (security_invoker = on);
