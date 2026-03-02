-- =====================================================
-- SOLUÇÃO SIMPLES: Recriar a tabela catalog_settings
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- 1. BACKUP: Se você tem dados, eles serão perdidos. 
-- Se quiser manter, comente a linha DROP TABLE abaixo

DROP TABLE IF EXISTS catalog_settings CASCADE;

-- 2. CRIAR TABELA COMPLETA
CREATE TABLE catalog_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    
    -- Informações Gerais
    catalog_name TEXT DEFAULT 'Catálogo de Produtos',
    catalog_description TEXT DEFAULT 'Confira nossos produtos disponíveis',
    catalog_subtitle TEXT,
    welcome_message TEXT,
    
    -- Regras de Exibição - Produtos
    hide_out_of_stock BOOLEAN DEFAULT false,
    hide_zero_price BOOLEAN DEFAULT false,
    hide_inactive BOOLEAN DEFAULT true,
    min_stock_to_show INTEGER DEFAULT 0,
    
    -- Regras de Exibição - Categorias
    hide_empty_categories BOOLEAN DEFAULT true,
    hide_categories_no_stock BOOLEAN DEFAULT false,
    show_product_count BOOLEAN DEFAULT true,
    
    -- Preços
    show_prices BOOLEAN DEFAULT true,
    show_old_price BOOLEAN DEFAULT true,
    show_discount_badge BOOLEAN DEFAULT true,
    price_format TEXT DEFAULT 'R$ 0,00',
    
    -- Estoque
    show_stock BOOLEAN DEFAULT true,
    show_stock_quantity BOOLEAN DEFAULT false,
    low_stock_threshold INTEGER DEFAULT 5,
    show_low_stock_warning BOOLEAN DEFAULT true,
    
    -- Imagens
    show_product_images BOOLEAN DEFAULT true,
    image_quality TEXT DEFAULT 'high',
    enable_image_zoom BOOLEAN DEFAULT true,
    show_image_gallery BOOLEAN DEFAULT true,
    
    -- Paginação
    products_per_page INTEGER DEFAULT 12,
    enable_infinite_scroll BOOLEAN DEFAULT false,
    default_sort TEXT DEFAULT 'recent',
    enable_sort_options BOOLEAN DEFAULT true,
    
    -- Filtros
    show_filters BOOLEAN DEFAULT true,
    show_category_filter BOOLEAN DEFAULT true,
    show_brand_filter BOOLEAN DEFAULT true,
    show_price_filter BOOLEAN DEFAULT true,
    show_stock_filter BOOLEAN DEFAULT true,
    enable_search BOOLEAN DEFAULT true,
    search_placeholder TEXT DEFAULT 'Buscar produtos...',
    
    -- Layout
    layout_mode TEXT DEFAULT 'grid',
    grid_columns_mobile INTEGER DEFAULT 1,
    grid_columns_tablet INTEGER DEFAULT 2,
    grid_columns_desktop INTEGER DEFAULT 3,
    grid_columns_wide INTEGER DEFAULT 4,
    card_style TEXT DEFAULT 'modern',
    
    -- Tema
    theme_mode TEXT DEFAULT 'light',
    primary_color TEXT DEFAULT '#DC2626',
    secondary_color TEXT DEFAULT '#3B82F6',
    accent_color TEXT DEFAULT '#10B981',
    background_color TEXT DEFAULT '#F8FAFC',
    card_background TEXT DEFAULT '#FFFFFF',
    text_primary TEXT DEFAULT '#1E293B',
    text_secondary TEXT DEFAULT '#64748B',
    
    -- Categorias - Visual
    category_display_style TEXT DEFAULT 'icons',
    category_icon_size TEXT DEFAULT 'large',
    show_category_icons BOOLEAN DEFAULT true,
    show_category_images BOOLEAN DEFAULT false,
    category_layout TEXT DEFAULT 'horizontal',
    
    -- Funcionalidades
    enable_favorites BOOLEAN DEFAULT true,
    enable_share BOOLEAN DEFAULT true,
    enable_whatsapp_share BOOLEAN DEFAULT true,
    enable_product_comparison BOOLEAN DEFAULT false,
    enable_quick_view BOOLEAN DEFAULT false,
    show_related_products BOOLEAN DEFAULT false,
    
    -- Badges
    show_new_badge BOOLEAN DEFAULT true,
    new_product_days INTEGER DEFAULT 30,
    show_featured_badge BOOLEAN DEFAULT true,
    show_out_of_stock_badge BOOLEAN DEFAULT true,
    show_low_stock_badge BOOLEAN DEFAULT true,
    
    -- SEO
    meta_title TEXT,
    meta_description TEXT,
    meta_keywords TEXT,
    og_image TEXT,
    enable_seo_friendly_urls BOOLEAN DEFAULT true,
    
    -- Compartilhamento
    enable_public_catalog BOOLEAN DEFAULT true,
    catalog_slug TEXT,
    require_login BOOLEAN DEFAULT false,
    enable_qr_code BOOLEAN DEFAULT true,
    
    -- Analytics
    track_views BOOLEAN DEFAULT true,
    track_clicks BOOLEAN DEFAULT true,
    track_shares BOOLEAN DEFAULT true,
    google_analytics_id TEXT,
    
    -- Notificações
    notify_low_stock BOOLEAN DEFAULT false,
    notify_out_of_stock BOOLEAN DEFAULT false,
    notification_email TEXT,
    
    -- Avançado
    custom_css TEXT,
    custom_header_html TEXT,
    custom_footer_html TEXT,
    enable_cache BOOLEAN DEFAULT true,
    cache_duration_minutes INTEGER DEFAULT 15,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- 3. CRIAR ÍNDICE
CREATE INDEX idx_catalog_settings_user_id ON catalog_settings(user_id);

-- 4. HABILITAR RLS
ALTER TABLE catalog_settings ENABLE ROW LEVEL SECURITY;

-- 5. CRIAR POLICY (permite tudo para facilitar)
CREATE POLICY catalog_settings_all 
ON catalog_settings FOR ALL 
USING (true)
WITH CHECK (true);

-- 6. COMENTÁRIOS
COMMENT ON TABLE catalog_settings IS 'Configurações completas do catálogo por usuário';
COMMENT ON COLUMN catalog_settings.user_id IS 'ID do usuário dono das configurações';

-- PRONTO! Agora teste salvar as configurações no admin.
