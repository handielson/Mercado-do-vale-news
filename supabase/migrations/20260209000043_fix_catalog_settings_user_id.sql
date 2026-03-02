-- =====================================================
-- FIX COMPLETO: Adicionar TODAS as colunas faltantes
-- =====================================================

-- 1. Adicionar user_id
ALTER TABLE catalog_settings 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. Adicionar TODAS as colunas de configuração
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS catalog_name TEXT DEFAULT 'Catálogo de Produtos';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS catalog_description TEXT DEFAULT 'Confira nossos produtos disponíveis';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS catalog_subtitle TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS welcome_message TEXT;

-- Regras de exibição - Produtos
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS hide_zero_price BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS hide_inactive BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS min_stock_to_show INTEGER DEFAULT 0;

-- Regras de exibição - Categorias
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS hide_categories_no_stock BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_product_count BOOLEAN DEFAULT true;

-- Preços
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_prices BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_old_price BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_discount_badge BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS price_format TEXT DEFAULT 'R$ 0,00';

-- Estoque
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_stock BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_stock_quantity BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_low_stock_warning BOOLEAN DEFAULT true;

-- Imagens
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_product_images BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS image_quality TEXT DEFAULT 'high';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_image_zoom BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_image_gallery BOOLEAN DEFAULT true;

-- Paginação
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS products_per_page INTEGER DEFAULT 12;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_infinite_scroll BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS default_sort TEXT DEFAULT 'recent';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_sort_options BOOLEAN DEFAULT true;

-- Filtros
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_filters BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_category_filter BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_brand_filter BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_price_filter BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_stock_filter BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_search BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS search_placeholder TEXT DEFAULT 'Buscar produtos...';

-- Layout
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS layout_mode TEXT DEFAULT 'grid';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS grid_columns_mobile INTEGER DEFAULT 1;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS grid_columns_tablet INTEGER DEFAULT 2;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS grid_columns_desktop INTEGER DEFAULT 3;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS grid_columns_wide INTEGER DEFAULT 4;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS card_style TEXT DEFAULT 'modern';

-- Tema
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'light';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#DC2626';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#3B82F6';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#10B981';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#F8FAFC';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS card_background TEXT DEFAULT '#FFFFFF';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS text_primary TEXT DEFAULT '#1E293B';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS text_secondary TEXT DEFAULT '#64748B';

-- Categorias - Visual
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS category_display_style TEXT DEFAULT 'icons';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS category_icon_size TEXT DEFAULT 'large';
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_category_icons BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_category_images BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS category_layout TEXT DEFAULT 'horizontal';

-- Funcionalidades
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_favorites BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_share BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_whatsapp_share BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_product_comparison BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_quick_view BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_related_products BOOLEAN DEFAULT false;

-- Badges
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_new_badge BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS new_product_days INTEGER DEFAULT 30;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_featured_badge BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_out_of_stock_badge BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS show_low_stock_badge BOOLEAN DEFAULT true;

-- SEO
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS meta_keywords TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS og_image TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_seo_friendly_urls BOOLEAN DEFAULT true;

-- Compartilhamento
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_public_catalog BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS catalog_slug TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS require_login BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_qr_code BOOLEAN DEFAULT true;

-- Analytics
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS track_views BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS track_clicks BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS track_shares BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS google_analytics_id TEXT;

-- Notificações
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS notify_low_stock BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS notify_out_of_stock BOOLEAN DEFAULT false;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS notification_email TEXT;

-- Avançado
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS custom_css TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS custom_header_html TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS custom_footer_html TEXT;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS enable_cache BOOLEAN DEFAULT true;
ALTER TABLE catalog_settings ADD COLUMN IF NOT EXISTS cache_duration_minutes INTEGER DEFAULT 15;

-- 3. Criar índice e constraint
CREATE INDEX IF NOT EXISTS idx_catalog_settings_user_id ON catalog_settings(user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_user_settings'
    ) THEN
        ALTER TABLE catalog_settings 
        ADD CONSTRAINT unique_user_settings UNIQUE (user_id);
    END IF;
END $$;

-- 4. Comentários
COMMENT ON TABLE catalog_settings IS 'Configurações completas do catálogo por usuário';
COMMENT ON COLUMN catalog_settings.user_id IS 'ID do usuário dono das configurações';
COMMENT ON COLUMN catalog_settings.catalog_name IS 'Nome do catálogo';
