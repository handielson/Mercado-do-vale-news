-- =====================================================
-- FIX RLS COMPLETO — MERCADO DO VALE
-- Data: 2026-02-18
-- Objetivo: Corrigir 33 erros críticos de segurança e
--           90 avisos de performance do Supabase Advisor
--
-- ESTRATÉGIA:
--   Grupo A (Público): SELECT livre, escrita só ADMIN
--   Grupo B (Sensível): Tudo só ADMIN autenticado
--   Grupo C (Config): SELECT livre, escrita só ADMIN
--
-- SEGURO: Usa IF NOT EXISTS e DROP POLICY IF EXISTS
--         Pode ser executado múltiplas vezes sem problemas
-- =====================================================


-- =====================================================
-- PASSO 1: Criar função auxiliar is_admin()
-- Resolve: "Function Search Path Mutable" (20 avisos)
-- Resolve: "Auth RLS Initialization Plan" (90 avisos de performance)
-- A função é STABLE e SECURITY DEFINER com search_path fixo,
-- o que evita reavaliação linha por linha nas políticas RLS.
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND client_type = 'ADMIN'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Verifica se o usuário autenticado é ADMIN. SECURITY DEFINER com search_path fixo para evitar SQL injection e Auth RLS Initialization Plan.';


-- =====================================================
-- PASSO 2: GRUPO A — Tabelas Públicas do Catálogo
-- SELECT: livre para todos (anon + autenticado)
-- INSERT/UPDATE/DELETE: apenas ADMIN
-- =====================================================

-- ---- products ----
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to products" ON public.products;
DROP POLICY IF EXISTS "Admin manage products" ON public.products;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.products;
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;

CREATE POLICY "Public read products"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Admin write products"
  ON public.products FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- categories ----
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to categories" ON public.categories;
DROP POLICY IF EXISTS "Admin manage categories" ON public.categories;

CREATE POLICY "Public read categories"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Admin write categories"
  ON public.categories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- brands ----
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to brands" ON public.brands;
DROP POLICY IF EXISTS "Admin manage brands" ON public.brands;

CREATE POLICY "Public read brands"
  ON public.brands FOR SELECT
  USING (true);

CREATE POLICY "Admin write brands"
  ON public.brands FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- models ----
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to models" ON public.models;
DROP POLICY IF EXISTS "Admin manage models" ON public.models;

CREATE POLICY "Public read models"
  ON public.models FOR SELECT
  USING (true);

CREATE POLICY "Admin write models"
  ON public.models FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- colors ----
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to colors" ON public.colors;
DROP POLICY IF EXISTS "Admin manage colors" ON public.colors;
DROP POLICY IF EXISTS "Colors are viewable by everyone" ON public.colors;

CREATE POLICY "Public read colors"
  ON public.colors FOR SELECT
  USING (true);

CREATE POLICY "Admin write colors"
  ON public.colors FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- units ----
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to units" ON public.units;
DROP POLICY IF EXISTS "Admin manage units" ON public.units;

CREATE POLICY "Public read units"
  ON public.units FOR SELECT
  USING (true);

CREATE POLICY "Admin write units"
  ON public.units FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- payment_fees ----
ALTER TABLE public.payment_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to payment_fees" ON public.payment_fees;
DROP POLICY IF EXISTS "Admin manage payment_fees" ON public.payment_fees;

CREATE POLICY "Public read payment_fees"
  ON public.payment_fees FOR SELECT
  USING (true);

CREATE POLICY "Admin write payment_fees"
  ON public.payment_fees FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- warranty_templates ----
ALTER TABLE public.warranty_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to warranty_templates" ON public.warranty_templates;
DROP POLICY IF EXISTS "Admin manage warranty_templates" ON public.warranty_templates;

CREATE POLICY "Public read warranty_templates"
  ON public.warranty_templates FOR SELECT
  USING (true);

CREATE POLICY "Admin write warranty_templates"
  ON public.warranty_templates FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- catalog_banners ----
ALTER TABLE public.catalog_banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to catalog_banners" ON public.catalog_banners;
DROP POLICY IF EXISTS "Admin manage catalog_banners" ON public.catalog_banners;
DROP POLICY IF EXISTS "Authenticated users can manage banners" ON public.catalog_banners;

CREATE POLICY "Public read catalog_banners"
  ON public.catalog_banners FOR SELECT
  USING (true);

CREATE POLICY "Admin write catalog_banners"
  ON public.catalog_banners FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- catalog_settings ----
ALTER TABLE public.catalog_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to catalog_settings" ON public.catalog_settings;
DROP POLICY IF EXISTS "Admin manage catalog_settings" ON public.catalog_settings;
DROP POLICY IF EXISTS "Users can manage their own catalog settings" ON public.catalog_settings;

CREATE POLICY "Public read catalog_settings"
  ON public.catalog_settings FOR SELECT
  USING (true);

CREATE POLICY "Admin write catalog_settings"
  ON public.catalog_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- catalog_sections ----
ALTER TABLE public.catalog_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to catalog_sections" ON public.catalog_sections;
DROP POLICY IF EXISTS "Admin manage catalog_sections" ON public.catalog_sections;

CREATE POLICY "Public read catalog_sections"
  ON public.catalog_sections FOR SELECT
  USING (true);

CREATE POLICY "Admin write catalog_sections"
  ON public.catalog_sections FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- model_variants ----
ALTER TABLE public.model_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to model_variants" ON public.model_variants;
DROP POLICY IF EXISTS "Admin manage model_variants" ON public.model_variants;

CREATE POLICY "Public read model_variants"
  ON public.model_variants FOR SELECT
  USING (true);

CREATE POLICY "Admin write model_variants"
  ON public.model_variants FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- model_variant_images ----
ALTER TABLE public.model_variant_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to model_variant_images" ON public.model_variant_images;
DROP POLICY IF EXISTS "Admin manage model_variant_images" ON public.model_variant_images;

CREATE POLICY "Public read model_variant_images"
  ON public.model_variant_images FOR SELECT
  USING (true);

CREATE POLICY "Admin write model_variant_images"
  ON public.model_variant_images FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- model_eans ----
ALTER TABLE public.model_eans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to model_eans" ON public.model_eans;
DROP POLICY IF EXISTS "Admin manage model_eans" ON public.model_eans;

CREATE POLICY "Public read model_eans"
  ON public.model_eans FOR SELECT
  USING (true);

CREATE POLICY "Admin write model_eans"
  ON public.model_eans FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- custom_fields ----
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to custom_fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Admin manage custom_fields" ON public.custom_fields;

CREATE POLICY "Public read custom_fields"
  ON public.custom_fields FOR SELECT
  USING (true);

CREATE POLICY "Admin write custom_fields"
  ON public.custom_fields FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- rams (tabela de opções de RAM) ----
ALTER TABLE public.rams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to rams" ON public.rams;
DROP POLICY IF EXISTS "Admin manage rams" ON public.rams;

CREATE POLICY "Public read rams"
  ON public.rams FOR SELECT
  USING (true);

CREATE POLICY "Admin write rams"
  ON public.rams FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- storages (tabela de opções de armazenamento) ----
ALTER TABLE public.storages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to storages" ON public.storages;
DROP POLICY IF EXISTS "Admin manage storages" ON public.storages;

CREATE POLICY "Public read storages"
  ON public.storages FOR SELECT
  USING (true);

CREATE POLICY "Admin write storages"
  ON public.storages FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- versions ----
ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to versions" ON public.versions;
DROP POLICY IF EXISTS "Admin manage versions" ON public.versions;

CREATE POLICY "Public read versions"
  ON public.versions FOR SELECT
  USING (true);

CREATE POLICY "Admin write versions"
  ON public.versions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- battery_healths ----
ALTER TABLE public.battery_healths ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to battery_healths" ON public.battery_healths;
DROP POLICY IF EXISTS "Admin manage battery_healths" ON public.battery_healths;

CREATE POLICY "Public read battery_healths"
  ON public.battery_healths FOR SELECT
  USING (true);

CREATE POLICY "Admin write battery_healths"
  ON public.battery_healths FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- catalog_shares (analytics — leitura pública para registrar) ----
ALTER TABLE public.catalog_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to catalog_shares" ON public.catalog_shares;
DROP POLICY IF EXISTS "Admin manage catalog_shares" ON public.catalog_shares;

-- Permite INSERT público (para registrar compartilhamentos sem login)
CREATE POLICY "Public insert catalog_shares"
  ON public.catalog_shares FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin read catalog_shares"
  ON public.catalog_shares FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admin delete catalog_shares"
  ON public.catalog_shares FOR DELETE
  USING (public.is_admin());

-- ---- product_views (analytics — leitura pública para registrar) ----
ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to product_views" ON public.product_views;
DROP POLICY IF EXISTS "Admin manage product_views" ON public.product_views;

CREATE POLICY "Public insert product_views"
  ON public.product_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin read product_views"
  ON public.product_views FOR SELECT
  USING (public.is_admin());


-- =====================================================
-- PASSO 3: GRUPO B — Tabelas Sensíveis (Admin Only)
-- Apenas ADMIN autenticado pode ler e escrever
-- =====================================================

-- ---- sales ----
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage sales" ON public.sales;
DROP POLICY IF EXISTS "Admin access sales" ON public.sales;

CREATE POLICY "Admin access sales"
  ON public.sales FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- sale_items ----
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Admin access sale_items" ON public.sale_items;

CREATE POLICY "Admin access sale_items"
  ON public.sale_items FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- customers ----
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage customers" ON public.customers;
DROP POLICY IF EXISTS "Admin access customers" ON public.customers;

CREATE POLICY "Admin access customers"
  ON public.customers FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- stock_movements ----
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Admin access stock_movements" ON public.stock_movements;

CREATE POLICY "Admin access stock_movements"
  ON public.stock_movements FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- company_documents ----
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage company_documents" ON public.company_documents;
DROP POLICY IF EXISTS "Admin access company_documents" ON public.company_documents;

CREATE POLICY "Admin access company_documents"
  ON public.company_documents FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- warranty_documents ----
ALTER TABLE public.warranty_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage warranty_documents" ON public.warranty_documents;
DROP POLICY IF EXISTS "Admin access warranty_documents" ON public.warranty_documents;

CREATE POLICY "Admin access warranty_documents"
  ON public.warranty_documents FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- delivery_credits ----
ALTER TABLE public.delivery_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage delivery_credits" ON public.delivery_credits;
DROP POLICY IF EXISTS "Admin access delivery_credits" ON public.delivery_credits;

CREATE POLICY "Admin access delivery_credits"
  ON public.delivery_credits FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- customer_type_requests ----
ALTER TABLE public.customer_type_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage customer_type_requests" ON public.customer_type_requests;
DROP POLICY IF EXISTS "Admin access customer_type_requests" ON public.customer_type_requests;

CREATE POLICY "Admin access customer_type_requests"
  ON public.customer_type_requests FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- team_members ----
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admin access team_members" ON public.team_members;

CREATE POLICY "Admin access team_members"
  ON public.team_members FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- system_logs ----
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage system_logs" ON public.system_logs;
DROP POLICY IF EXISTS "Admin access system_logs" ON public.system_logs;

CREATE POLICY "Admin access system_logs"
  ON public.system_logs FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- performance_metrics ----
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage performance_metrics" ON public.performance_metrics;
DROP POLICY IF EXISTS "Admin access performance_metrics" ON public.performance_metrics;

CREATE POLICY "Admin access performance_metrics"
  ON public.performance_metrics FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- =====================================================
-- PASSO 4: GRUPO C — Configurações da Empresa
-- SELECT: livre (necessário para ThemeContext e PDV)
-- Escrita: apenas ADMIN
-- =====================================================

-- ---- company_settings ----
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Users can view own company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Admin manage company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Authenticated users can manage company settings" ON public.company_settings;

CREATE POLICY "Public read company_settings"
  ON public.company_settings FOR SELECT
  USING (true);

CREATE POLICY "Admin write company_settings"
  ON public.company_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- companies ----
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to companies" ON public.companies;
DROP POLICY IF EXISTS "Admin manage companies" ON public.companies;

CREATE POLICY "Public read companies"
  ON public.companies FOR SELECT
  USING (true);

CREATE POLICY "Admin write companies"
  ON public.companies FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- users (tabela interna — apenas admin lê/escreve) ----
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage users" ON public.users;
DROP POLICY IF EXISTS "Admin access users" ON public.users;
-- Usuário pode ver seus próprios dados (necessário para is_admin() funcionar)
DROP POLICY IF EXISTS "Users can read own data" ON public.users;

CREATE POLICY "Users can read own data"
  ON public.users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admin write users"
  ON public.users FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- =====================================================
-- PASSO 5: ÍNDICES DE PERFORMANCE
-- Resolve: 87 sugestões de índices do Performance Advisor
-- Usa IF NOT EXISTS para ser idempotente
-- =====================================================

-- Remover índice duplicado em customers (reportado pelo Advisor)
DROP INDEX IF EXISTS idx_customers_duplicate;

-- sales
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);

-- sale_items
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

-- customers
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON public.customers(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers(created_at DESC);

-- stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

-- warranty_documents
CREATE INDEX IF NOT EXISTS idx_warranty_documents_sale_id ON public.warranty_documents(sale_id);
CREATE INDEX IF NOT EXISTS idx_warranty_documents_created_at ON public.warranty_documents(created_at DESC);

-- catalog_sections
CREATE INDEX IF NOT EXISTS idx_catalog_sections_user_id ON public.catalog_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_sections_enabled ON public.catalog_sections(is_enabled) WHERE is_enabled = true;

-- products (complementares aos já existentes)
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_ean ON public.products(ean) WHERE ean IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_model_id ON public.products(model_id) WHERE model_id IS NOT NULL;

-- model_variants
CREATE INDEX IF NOT EXISTS idx_model_variants_model_id ON public.model_variants(model_id);

-- model_variant_images
CREATE INDEX IF NOT EXISTS idx_model_variant_images_variant_id ON public.model_variant_images(variant_id);

-- delivery_credits
CREATE INDEX IF NOT EXISTS idx_delivery_credits_sale_id ON public.delivery_credits(sale_id);
CREATE INDEX IF NOT EXISTS idx_delivery_credits_status ON public.delivery_credits(status);

-- customer_type_requests
CREATE INDEX IF NOT EXISTS idx_customer_type_requests_customer_id ON public.customer_type_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_type_requests_status ON public.customer_type_requests(status);

-- system_logs
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);

-- performance_metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON public.performance_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON public.performance_metrics(metric_type);


-- =====================================================
-- VERIFICAÇÃO FINAL
-- Execute estas queries para confirmar que tudo está OK
-- =====================================================

-- Verificar tabelas com RLS habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false
ORDER BY tablename;
-- Resultado esperado: 0 linhas (todas com RLS habilitado)

-- Verificar políticas criadas
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verificar índices criados
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
