-- =====================================================
-- CATALOG SECTIONS - Sistema de Seções Personalizáveis
-- =====================================================

-- Criar tabela de seções do catálogo
CREATE TABLE IF NOT EXISTS catalog_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    
    -- Identificação
    section_type TEXT NOT NULL, -- 'recent', 'featured', 'bestsellers', 'promotions', 'new', 'custom'
    title TEXT NOT NULL,
    subtitle TEXT,
    
    -- Configuração
    is_enabled BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    max_products INTEGER DEFAULT 8,
    
    -- Estilo
    layout_style TEXT DEFAULT 'grid', -- 'grid', 'carousel', 'list'
    show_view_all BOOLEAN DEFAULT true,
    view_all_url TEXT,
    
    -- Filtros (para seções customizadas)
    filter_categories UUID[],
    filter_brands TEXT[],
    filter_min_price DECIMAL(10,2),
    filter_max_price DECIMAL(10,2),
    filter_tags TEXT[],
    
    -- Ordenação
    sort_by TEXT DEFAULT 'created_at', -- 'created_at', 'sales_count', 'price', 'name', 'updated_at'
    sort_direction TEXT DEFAULT 'desc', -- 'asc', 'desc'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar campos em products para suportar seções
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_catalog_sections_user_id ON catalog_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_sections_enabled ON catalog_sections(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_catalog_sections_order ON catalog_sections(display_order);
CREATE INDEX IF NOT EXISTS idx_catalog_sections_type ON catalog_sections(section_type);

CREATE INDEX IF NOT EXISTS idx_products_sales_count ON products(sales_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_is_new ON products(is_new) WHERE is_new = true;
CREATE INDEX IF NOT EXISTS idx_products_discount ON products(discount_percentage) WHERE discount_percentage > 0;

-- Habilitar RLS
ALTER TABLE catalog_sections ENABLE ROW LEVEL SECURITY;

-- Policies para catalog_sections
CREATE POLICY catalog_sections_select_own 
ON catalog_sections FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY catalog_sections_insert_own 
ON catalog_sections FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY catalog_sections_update_own 
ON catalog_sections FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY catalog_sections_delete_own 
ON catalog_sections FOR DELETE 
USING (user_id = auth.uid());

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_catalog_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER catalog_sections_updated_at
    BEFORE UPDATE ON catalog_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_catalog_sections_updated_at();

-- Comentários
COMMENT ON TABLE catalog_sections IS 'Seções personalizáveis do catálogo (Mais Recentes, Destaques, etc.)';
COMMENT ON COLUMN catalog_sections.section_type IS 'Tipo da seção: recent, featured, bestsellers, promotions, new, custom';
COMMENT ON COLUMN catalog_sections.layout_style IS 'Estilo de exibição: grid, carousel, list';
COMMENT ON COLUMN catalog_sections.display_order IS 'Ordem de exibição na homepage (menor = primeiro)';
COMMENT ON COLUMN catalog_sections.max_products IS 'Quantidade máxima de produtos a exibir';

COMMENT ON COLUMN products.sales_count IS 'Contador de vendas do produto';
COMMENT ON COLUMN products.is_featured IS 'Produto em destaque';
COMMENT ON COLUMN products.is_new IS 'Produto marcado como novidade';
COMMENT ON COLUMN products.featured_until IS 'Data até quando o produto fica em destaque';
COMMENT ON COLUMN products.discount_percentage IS 'Porcentagem de desconto aplicada';

-- Criar seções padrão para novos usuários (opcional)
-- Isso pode ser feito via código quando o usuário se registra
