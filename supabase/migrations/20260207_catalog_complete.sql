-- =====================================================
-- CATALOG SETTINGS - Migration Completa e Segura
-- =====================================================
-- Execute este SQL completo de uma vez

-- Criar tabela category_display_config (se não existir)
CREATE TABLE IF NOT EXISTS category_display_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    
    -- Ícone
    icon_type TEXT DEFAULT 'lucide',
    icon_name TEXT,
    icon_url TEXT,
    icon_emoji TEXT,
    
    -- Cores
    icon_color TEXT,
    background_color TEXT,
    active_color TEXT,
    
    -- Ordem e visibilidade
    display_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    -- Banner
    banner_image_url TEXT,
    banner_position TEXT DEFAULT 'center',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_category_config UNIQUE (category_id)
);

-- Adicionar colunas à catalog_settings (se não existirem)
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS catalog_description TEXT DEFAULT 'Confira nossos produtos disponíveis';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS catalog_subtitle TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS hide_zero_price BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS hide_inactive BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS min_stock_to_show INTEGER DEFAULT 0;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS hide_categories_no_stock BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_product_count BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_prices BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_old_price BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_discount_badge BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS price_format TEXT DEFAULT 'R$ 0,00';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_stock BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_stock_quantity BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_low_stock_warning BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_product_images BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS image_quality TEXT DEFAULT 'high';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_image_zoom BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_image_gallery BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS products_per_page INTEGER DEFAULT 12;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_infinite_scroll BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS default_sort TEXT DEFAULT 'recent';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_sort_options BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_filters BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_category_filter BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_brand_filter BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_price_filter BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_stock_filter BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_search BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS search_placeholder TEXT DEFAULT 'Buscar produtos...';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS layout_mode TEXT DEFAULT 'grid';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS grid_columns_mobile INTEGER DEFAULT 1;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS grid_columns_tablet INTEGER DEFAULT 2;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS grid_columns_desktop INTEGER DEFAULT 3;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS grid_columns_wide INTEGER DEFAULT 4;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS card_style TEXT DEFAULT 'modern';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'light';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#DC2626';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#3B82F6';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#10B981';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#F8FAFC';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS card_background TEXT DEFAULT '#FFFFFF';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS text_primary TEXT DEFAULT '#1E293B';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS text_secondary TEXT DEFAULT '#64748B';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS category_display_style TEXT DEFAULT 'icons';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS category_icon_size TEXT DEFAULT 'large';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_category_icons BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_category_images BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS category_layout TEXT DEFAULT 'horizontal';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_favorites BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_share BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_whatsapp_share BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_product_comparison BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_quick_view BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_related_products BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_new_badge BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS new_product_days INTEGER DEFAULT 30;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_featured_badge BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_out_of_stock_badge BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_low_stock_badge BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS meta_keywords TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS og_image TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_seo_friendly_urls BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_public_catalog BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS catalog_slug TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS require_login BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_qr_code BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS track_views BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS track_clicks BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS track_shares BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS google_analytics_id TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS notify_low_stock BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS notify_out_of_stock BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS notification_email TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS custom_css TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS custom_header_html TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS custom_footer_html TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_cache BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS cache_duration_minutes INTEGER DEFAULT 15;

-- Criar índices (se não existirem)
CREATE INDEX IF NOT EXISTS idx_category_display_category_id ON category_display_config(category_id);
CREATE INDEX IF NOT EXISTS idx_category_display_order ON category_display_config(display_order);
CREATE INDEX IF NOT EXISTS idx_category_display_visible ON category_display_config(is_visible);

-- Habilitar RLS
ALTER TABLE category_display_config ENABLE ROW LEVEL SECURITY;

-- Criar policies para category_display_config
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'category_display_config' 
        AND policyname = 'category_display_all'
    ) THEN
        CREATE POLICY category_display_all 
        ON category_display_config FOR ALL 
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- Adicionar constraint único para catalog_slug (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_catalog_slug'
    ) THEN
        ALTER TABLE catalog_settings ADD CONSTRAINT unique_catalog_slug UNIQUE (catalog_slug);
    END IF;
END $$;


-- Comentários
COMMENT ON TABLE category_display_config IS 'Configuração visual de categorias (ícones, cores, ordem)';
