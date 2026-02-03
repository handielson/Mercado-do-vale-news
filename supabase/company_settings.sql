-- =====================================================
-- COMPANY SETTINGS TABLE
-- Stores company information and configuration
-- =====================================================

-- Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Identification
  name TEXT NOT NULL, -- Nome Fantasia
  razao_social TEXT, -- Razão Social (nome oficial)
  cnpj TEXT,
  state_registration TEXT, -- IE - Inscrição Estadual
  cnae TEXT, -- CNAE Principal
  situacao_cadastral TEXT, -- Situação na Receita Federal
  data_abertura DATE, -- Data de abertura
  porte TEXT, -- Porte da empresa (MEI, ME, EPP, etc.)
  phone TEXT,
  email TEXT,
  logo TEXT, -- Base64 encoded image
  favicon TEXT, -- Base64 encoded image
  
  -- Address
  address_zip_code TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  address_lat DECIMAL(10, 8),
  address_lng DECIMAL(11, 8),
  
  -- Social Media
  social_instagram TEXT,
  social_facebook TEXT,
  social_youtube TEXT,
  social_website TEXT,
  google_reviews_link TEXT,
  
  -- Financial
  pix_key TEXT,
  pix_key_type TEXT CHECK (pix_key_type IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM')),
  bank_name TEXT,
  bank_agency TEXT,
  bank_account TEXT,
  
  -- Additional Info
  business_hours TEXT,
  description TEXT,
  internal_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id) -- One company settings per user
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_settings_user_id ON company_settings(user_id);

-- Enable Row Level Security
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see and modify their own company settings
CREATE POLICY "Users can view own company settings"
  ON company_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own company settings"
  ON company_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company settings"
  ON company_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own company settings"
  ON company_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_settings_updated_at();

-- Comments for documentation
COMMENT ON TABLE company_settings IS 'Stores company information and configuration for each user';
COMMENT ON COLUMN company_settings.logo IS 'Base64 encoded company logo image';
COMMENT ON COLUMN company_settings.favicon IS 'Base64 encoded favicon image (32x32 or 64x64px)';
COMMENT ON COLUMN company_settings.internal_notes IS 'Internal notes not visible to public';
