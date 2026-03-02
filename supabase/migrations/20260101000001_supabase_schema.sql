-- ============================================
-- Mercado do Vale - Supabase Database Schema
-- Multi-Tenant SaaS Architecture
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TABLE: companies (Tenants)
-- ============================================

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free', -- free, pro, enterprise
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, cancelled
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: user_companies (User-Company Relationship)
-- ============================================

CREATE TABLE user_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX idx_user_companies_user_id ON user_companies(user_id);
CREATE INDEX idx_user_companies_company_id ON user_companies(company_id);

-- ============================================
-- TABLE: categories
-- ============================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, slug)
);

CREATE INDEX idx_categories_company_id ON categories(company_id);

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company categories"
  ON categories FOR SELECT
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can insert categories for their company"
  ON categories FOR INSERT
  WITH CHECK (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can update their company categories"
  ON categories FOR UPDATE
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can delete their company categories"
  ON categories FOR DELETE
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

-- ============================================
-- TABLE: brands
-- ============================================

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, slug)
);

CREATE INDEX idx_brands_company_id ON brands(company_id);

CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS for brands
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company brands"
  ON brands FOR SELECT
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can insert brands for their company"
  ON brands FOR INSERT
  WITH CHECK (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can update their company brands"
  ON brands FOR UPDATE
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can delete their company brands"
  ON brands FOR DELETE
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

-- ============================================
-- TABLE: models
-- ============================================

CREATE TABLE models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, brand_id, slug)
);

CREATE INDEX idx_models_company_id ON models(company_id);
CREATE INDEX idx_models_brand_id ON models(brand_id);

CREATE TRIGGER update_models_updated_at
  BEFORE UPDATE ON models
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS for models
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company models"
  ON models FOR SELECT
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can insert models for their company"
  ON models FOR INSERT
  WITH CHECK (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can update their company models"
  ON models FOR UPDATE
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can delete their company models"
  ON models FOR DELETE
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

-- ============================================
-- TABLE: products
-- ============================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  model_id UUID REFERENCES models(id) ON DELETE SET NULL,
  
  -- Basic Info
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  ean TEXT,
  alternative_eans TEXT[] DEFAULT '{}',
  
  -- Specifications (stored as JSONB for flexibility)
  specs JSONB DEFAULT '{}',
  
  -- Pricing (stored as INTEGER CENTS to avoid floating point issues)
  price_cost INTEGER,
  price_retail INTEGER,
  price_reseller INTEGER,
  price_wholesale INTEGER,
  
  -- Fiscal
  ncm TEXT,
  cest TEXT,
  origin TEXT,
  
  -- Logistics
  weight_kg DECIMAL(10,3),
  dimensions JSONB,
  stock_quantity INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, ean)
);

CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_model_id ON products(model_id);
CREATE INDEX idx_products_ean ON products(ean);

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS for products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company products"
  ON products FOR SELECT
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can insert products for their company"
  ON products FOR INSERT
  WITH CHECK (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can update their company products"
  ON products FOR UPDATE
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can delete their company products"
  ON products FOR DELETE
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

-- ============================================
-- TABLE: units (Inventory)
-- ============================================

CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Identifiers
  imei_1 TEXT,
  imei_2 TEXT,
  serial TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'available', -- available, sold, reserved, defective
  
  -- Internal Notes
  internal_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_units_company_id ON units(company_id);
CREATE INDEX idx_units_product_id ON units(product_id);
CREATE INDEX idx_units_imei_1 ON units(imei_1);
CREATE INDEX idx_units_serial ON units(serial);

CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS for units
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company units"
  ON units FOR SELECT
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can insert units for their company"
  ON units FOR INSERT
  WITH CHECK (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can update their company units"
  ON units FOR UPDATE
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can delete their company units"
  ON units FOR DELETE
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================

-- Create a test company
INSERT INTO companies (name, slug, plan, status)
VALUES ('Mercado do Vale', 'mercado-do-vale', 'pro', 'active');
