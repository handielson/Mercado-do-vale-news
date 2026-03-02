-- =====================================================
-- CATALOG SETTINGS - Versão Simplificada para Debug
-- =====================================================

-- PASSO 1: Criar apenas a tabela catalog_settings
CREATE TABLE IF NOT EXISTS catalog_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    
    -- Configurações básicas
    catalog_name TEXT DEFAULT 'Catálogo de Produtos',
    hide_out_of_stock BOOLEAN DEFAULT false,
    hide_empty_categories BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- PASSO 2: Criar tabela category_display_config
CREATE TABLE IF NOT EXISTS category_display_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    
    icon_type TEXT DEFAULT 'lucide',
    icon_name TEXT,
    display_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_category_config UNIQUE (category_id)
);

-- PASSO 3: Criar índices
CREATE INDEX IF NOT EXISTS idx_catalog_settings_user_id ON catalog_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_category_display_category_id ON category_display_config(category_id);

-- PASSO 4: Habilitar RLS
ALTER TABLE catalog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_display_config ENABLE ROW LEVEL SECURITY;

-- PASSO 5: Criar policies simples
CREATE POLICY catalog_settings_all 
ON catalog_settings FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY category_display_all 
ON category_display_config FOR ALL 
USING (true)
WITH CHECK (true);

-- Comentários
COMMENT ON TABLE catalog_settings IS 'Configurações do catálogo';
COMMENT ON TABLE category_display_config IS 'Configuração de ícones de categorias';
