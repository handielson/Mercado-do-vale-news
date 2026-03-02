-- =====================================================
-- CATALOG SETTINGS - Sistema Completo de Configuração
-- =====================================================

-- Tabela principal de configurações do catálogo
CREATE TABLE IF NOT EXISTS catalog_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    
    -- ==================== INFORMAÇÕES GERAIS ====================
    catalog_name TEXT DEFAULT 'Catálogo de Produtos',
    catalog_description TEXT DEFAULT 'Confira nossos produtos disponíveis',
    catalog_subtitle TEXT,
    welcome_message TEXT,
    
    -- ==================== REGRAS DE EXIBIÇÃO ====================
    -- Produtos
    hide_out_of_stock BOOLEAN DEFAULT false, -- Ocultar produtos sem estoque
    hide_zero_price BOOLEAN DEFAULT false,   -- Ocultar produtos com preço zero
    hide_inactive BOOLEAN DEFAULT true,      -- Ocultar produtos inativos
    min_stock_to_show INTEGER DEFAULT 0,     -- Estoque mínimo para exibir
    
    -- Categorias
    hide_empty_categories BOOLEAN DEFAULT true, -- Ocultar categorias sem produtos
    hide_categories_no_stock BOOLEAN DEFAULT false, -- Ocultar categorias sem estoque
    show_product_count BOOLEAN DEFAULT true,  -- Mostrar contador de produtos
    
    -- Preços
    show_prices BOOLEAN DEFAULT true,         -- Mostrar preços
    show_old_price BOOLEAN DEFAULT true,      -- Mostrar preço antigo (promoção)
    show_discount_badge BOOLEAN DEFAULT true, -- Mostrar badge de desconto
    price_format TEXT DEFAULT 'R$ 0,00',      -- Formato do preço
    
    -- Estoque
    show_stock BOOLEAN DEFAULT true,          -- Mostrar informação de estoque
    show_stock_quantity BOOLEAN DEFAULT false, -- Mostrar quantidade exata
    low_stock_threshold INTEGER DEFAULT 5,    -- Limite para "estoque baixo"
    show_low_stock_warning BOOLEAN DEFAULT true, -- Avisar estoque baixo
    
    -- Imagens
    show_product_images BOOLEAN DEFAULT true,
    image_quality TEXT DEFAULT 'high', -- 'low', 'medium', 'high'
    enable_image_zoom BOOLEAN DEFAULT true,
    show_image_gallery BOOLEAN DEFAULT true,
    
    -- ==================== PAGINAÇÃO E ORDENAÇÃO ====================
    products_per_page INTEGER DEFAULT 12,
    enable_infinite_scroll BOOLEAN DEFAULT false,
    default_sort TEXT DEFAULT 'recent', -- 'recent', 'name', 'price_asc', 'price_desc', 'popular'
    enable_sort_options BOOLEAN DEFAULT true,
    
    -- ==================== FILTROS ====================
    show_filters BOOLEAN DEFAULT true,
    show_category_filter BOOLEAN DEFAULT true,
    show_brand_filter BOOLEAN DEFAULT true,
    show_price_filter BOOLEAN DEFAULT true,
    show_stock_filter BOOLEAN DEFAULT true,
    enable_search BOOLEAN DEFAULT true,
    search_placeholder TEXT DEFAULT 'Buscar produtos...',
    
    -- ==================== LAYOUT ====================
    layout_mode TEXT DEFAULT 'grid', -- 'grid', 'list', 'both'
    grid_columns_mobile INTEGER DEFAULT 1,
    grid_columns_tablet INTEGER DEFAULT 2,
    grid_columns_desktop INTEGER DEFAULT 3,
    grid_columns_wide INTEGER DEFAULT 4,
    card_style TEXT DEFAULT 'modern', -- 'modern', 'classic', 'minimal'
    
    -- ==================== TEMA E CORES ====================
    theme_mode TEXT DEFAULT 'light', -- 'light', 'dark', 'auto'
    primary_color TEXT DEFAULT '#DC2626', -- Vermelho (categoria ativa)
    secondary_color TEXT DEFAULT '#3B82F6', -- Azul
    accent_color TEXT DEFAULT '#10B981', -- Verde (sucesso)
    background_color TEXT DEFAULT '#F8FAFC',
    card_background TEXT DEFAULT '#FFFFFF',
    text_primary TEXT DEFAULT '#1E293B',
    text_secondary TEXT DEFAULT '#64748B',
    
    -- ==================== CATEGORIAS - VISUAL ====================
    category_display_style TEXT DEFAULT 'icons', -- 'icons', 'images', 'text'
    category_icon_size TEXT DEFAULT 'large', -- 'small', 'medium', 'large'
    show_category_icons BOOLEAN DEFAULT true,
    show_category_images BOOLEAN DEFAULT false,
    category_layout TEXT DEFAULT 'horizontal', -- 'horizontal', 'grid', 'sidebar'
    
    -- ==================== FUNCIONALIDADES ====================
    enable_favorites BOOLEAN DEFAULT true,
    enable_share BOOLEAN DEFAULT true,
    enable_whatsapp_share BOOLEAN DEFAULT true,
    enable_product_comparison BOOLEAN DEFAULT false,
    enable_quick_view BOOLEAN DEFAULT false,
    show_related_products BOOLEAN DEFAULT false,
    
    -- ==================== BADGES E INDICADORES ====================
    show_new_badge BOOLEAN DEFAULT true,
    new_product_days INTEGER DEFAULT 30, -- Dias para considerar "novo"
    show_featured_badge BOOLEAN DEFAULT true,
    show_out_of_stock_badge BOOLEAN DEFAULT true,
    show_low_stock_badge BOOLEAN DEFAULT true,
    
    -- ==================== SEO ====================
    meta_title TEXT,
    meta_description TEXT,
    meta_keywords TEXT,
    og_image TEXT, -- Open Graph image
    enable_seo_friendly_urls BOOLEAN DEFAULT true,
    
    -- ==================== COMPARTILHAMENTO ====================
    enable_public_catalog BOOLEAN DEFAULT true,
    catalog_slug TEXT UNIQUE, -- URL amigável: /catalog/nome-da-loja
    require_login BOOLEAN DEFAULT false,
    enable_qr_code BOOLEAN DEFAULT true,
    
    -- ==================== ANALYTICS ====================
    track_views BOOLEAN DEFAULT true,
    track_clicks BOOLEAN DEFAULT true,
    track_shares BOOLEAN DEFAULT true,
    google_analytics_id TEXT,
    
    -- ==================== NOTIFICAÇÕES ====================
    notify_low_stock BOOLEAN DEFAULT false,
    notify_out_of_stock BOOLEAN DEFAULT false,
    notification_email TEXT,
    
    -- ==================== AVANÇADO ====================
    custom_css TEXT, -- CSS customizado
    custom_header_html TEXT,
    custom_footer_html TEXT,
    enable_cache BOOLEAN DEFAULT true,
    cache_duration_minutes INTEGER DEFAULT 15,
    
    -- ==================== TIMESTAMPS ====================
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: Um usuário tem apenas uma configuração
    CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Tabela de configuração de ícones/imagens de categorias
CREATE TABLE IF NOT EXISTS category_display_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    
    -- Ícone
    icon_type TEXT DEFAULT 'lucide', -- 'lucide', 'custom', 'emoji'
    icon_name TEXT, -- Nome do ícone Lucide (ex: 'Smartphone')
    icon_url TEXT,  -- URL da imagem customizada
    icon_emoji TEXT, -- Emoji (ex: '📱')
    
    -- Cores
    icon_color TEXT,
    background_color TEXT,
    active_color TEXT,
    
    -- Ordem e visibilidade
    display_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    -- Imagem de banner (opcional)
    banner_image_url TEXT,
    banner_position TEXT DEFAULT 'center', -- 'top', 'center', 'bottom'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: Uma categoria tem apenas uma configuração
    CONSTRAINT unique_category_config UNIQUE (category_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_catalog_settings_user_id ON catalog_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_category_display_category_id ON category_display_config(category_id);
CREATE INDEX IF NOT EXISTS idx_category_display_order ON category_display_config(display_order);
CREATE INDEX IF NOT EXISTS idx_category_display_visible ON category_display_config(is_visible);

-- RLS Policies
ALTER TABLE catalog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_display_config ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver suas próprias configurações
CREATE POLICY catalog_settings_select_own 
ON catalog_settings FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Usuários podem inserir suas próprias configurações
CREATE POLICY catalog_settings_insert_own 
ON catalog_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Usuários podem atualizar suas próprias configurações
CREATE POLICY catalog_settings_update_own 
ON catalog_settings FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy: Todos podem ver configurações de categorias (para o catálogo público)
CREATE POLICY category_display_select_all 
ON category_display_config FOR SELECT 
USING (true);

-- Policy: Apenas usuários autenticados podem modificar configurações de categorias
CREATE POLICY category_display_modify_auth 
ON category_display_config FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_catalog_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER catalog_settings_updated_at
BEFORE UPDATE ON catalog_settings
FOR EACH ROW
EXECUTE FUNCTION update_catalog_settings_updated_at();

CREATE TRIGGER category_display_updated_at
BEFORE UPDATE ON category_display_config
FOR EACH ROW
EXECUTE FUNCTION update_catalog_settings_updated_at();

-- Inserir configuração padrão para usuários existentes (opcional)
-- INSERT INTO catalog_settings (user_id)
-- SELECT id FROM auth.users
-- ON CONFLICT (user_id) DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE catalog_settings IS 'Configurações completas do catálogo por usuário';
COMMENT ON TABLE category_display_config IS 'Configuração visual de categorias (ícones, cores, ordem)';
COMMENT ON COLUMN catalog_settings.hide_out_of_stock IS 'Ocultar produtos sem estoque no catálogo';
COMMENT ON COLUMN catalog_settings.hide_empty_categories IS 'Ocultar categorias que não possuem produtos';
COMMENT ON COLUMN catalog_settings.hide_categories_no_stock IS 'Ocultar categorias onde todos os produtos estão sem estoque';
