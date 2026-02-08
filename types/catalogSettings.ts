export interface CatalogSettings {
    id?: string;
    user_id?: string;

    // ==================== INFORMAÇÕES GERAIS ====================
    catalog_name: string;
    catalog_description: string;
    catalog_subtitle?: string;
    welcome_message?: string;

    // ==================== REGRAS DE EXIBIÇÃO ====================
    // Produtos
    hide_out_of_stock: boolean;        // Ocultar produtos sem estoque
    hide_zero_price: boolean;          // Ocultar produtos com preço zero
    hide_inactive: boolean;            // Ocultar produtos inativos
    min_stock_to_show: number;         // Estoque mínimo para exibir

    // Categorias
    hide_empty_categories: boolean;    // Ocultar categorias sem produtos
    hide_categories_no_stock: boolean; // Ocultar categorias sem estoque
    show_product_count: boolean;       // Mostrar contador de produtos

    // Preços
    show_prices: boolean;              // Mostrar preços
    show_old_price: boolean;           // Mostrar preço antigo (promoção)
    show_discount_badge: boolean;      // Mostrar badge de desconto
    price_format: string;              // Formato do preço

    // Estoque
    show_stock: boolean;               // Mostrar informação de estoque
    show_stock_quantity: boolean;      // Mostrar quantidade exata
    low_stock_threshold: number;       // Limite para "estoque baixo"
    show_low_stock_warning: boolean;   // Avisar estoque baixo

    // Imagens
    show_product_images: boolean;
    image_quality: 'low' | 'medium' | 'high';
    enable_image_zoom: boolean;
    show_image_gallery: boolean;

    // ==================== PAGINAÇÃO E ORDENAÇÃO ====================
    products_per_page: number;
    enable_infinite_scroll: boolean;
    default_sort: 'recent' | 'name' | 'price_asc' | 'price_desc' | 'popular';
    enable_sort_options: boolean;

    // ==================== FILTROS ====================
    show_filters: boolean;
    show_category_filter: boolean;
    show_brand_filter: boolean;
    show_price_filter: boolean;
    show_stock_filter: boolean;
    enable_search: boolean;
    search_placeholder: string;

    // ==================== LAYOUT ====================
    layout_mode: 'grid' | 'list' | 'both';
    grid_columns_mobile: number;
    grid_columns_tablet: number;
    grid_columns_desktop: number;
    grid_columns_wide: number;
    card_style: 'modern' | 'classic' | 'minimal';

    // ==================== TEMA E CORES ====================
    theme_mode: 'light' | 'dark' | 'auto';
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    background_color: string;
    card_background: string;
    text_primary: string;
    text_secondary: string;

    // ==================== CATEGORIAS - VISUAL ====================
    category_display_style: 'icons' | 'images' | 'text';
    category_icon_size: 'small' | 'medium' | 'large';
    show_category_icons: boolean;
    show_category_images: boolean;
    category_layout: 'horizontal' | 'grid' | 'sidebar';

    // ==================== FUNCIONALIDADES ====================
    enable_favorites: boolean;
    enable_share: boolean;
    enable_whatsapp_share: boolean;
    enable_product_comparison: boolean;
    enable_quick_view: boolean;
    show_related_products: boolean;

    // ==================== BADGES E INDICADORES ====================
    show_new_badge: boolean;
    new_product_days: number;
    show_featured_badge: boolean;
    show_out_of_stock_badge: boolean;
    show_low_stock_badge: boolean;

    // ==================== SEO ====================
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string;
    og_image?: string;
    enable_seo_friendly_urls: boolean;

    // ==================== COMPARTILHAMENTO ====================
    enable_public_catalog: boolean;
    catalog_slug?: string;
    require_login: boolean;
    enable_qr_code: boolean;

    // ==================== ANALYTICS ====================
    track_views: boolean;
    track_clicks: boolean;
    track_shares: boolean;
    google_analytics_id?: string;

    // ==================== NOTIFICAÇÕES ====================
    notify_low_stock: boolean;
    notify_out_of_stock: boolean;
    notification_email?: string;

    // ==================== AVANÇADO ====================
    custom_css?: string;
    custom_header_html?: string;
    custom_footer_html?: string;
    enable_cache: boolean;
    cache_duration_minutes: number;

    // Timestamps
    created_at?: string;
    updated_at?: string;
}

export interface CategoryDisplayConfig {
    id?: string;
    category_id: string;

    // Ícone
    icon_type: 'lucide' | 'custom' | 'emoji';
    icon_name?: string;  // Nome do ícone Lucide
    icon_url?: string;   // URL da imagem customizada
    icon_emoji?: string; // Emoji

    // Cores
    icon_color?: string;
    background_color?: string;
    active_color?: string;

    // Ordem e visibilidade
    display_order: number;
    is_visible: boolean;
    is_featured: boolean;

    // Imagem de banner
    banner_image_url?: string;
    banner_position?: 'top' | 'center' | 'bottom';

    // Timestamps
    created_at?: string;
    updated_at?: string;
}

// Valores padrão
export const DEFAULT_CATALOG_SETTINGS: Partial<CatalogSettings> = {
    catalog_name: 'Catálogo de Produtos',
    catalog_description: 'Confira nossos produtos disponíveis',

    // Regras de exibição
    hide_out_of_stock: false,
    hide_zero_price: false,
    hide_inactive: true,
    min_stock_to_show: 0,

    hide_empty_categories: true,
    hide_categories_no_stock: false,
    show_product_count: true,

    show_prices: true,
    show_old_price: true,
    show_discount_badge: true,
    price_format: 'R$ 0,00',

    show_stock: true,
    show_stock_quantity: false,
    low_stock_threshold: 5,
    show_low_stock_warning: true,

    show_product_images: true,
    image_quality: 'high',
    enable_image_zoom: true,
    show_image_gallery: true,

    // Paginação
    products_per_page: 12,
    enable_infinite_scroll: false,
    default_sort: 'recent',
    enable_sort_options: true,

    // Filtros
    show_filters: true,
    show_category_filter: true,
    show_brand_filter: true,
    show_price_filter: true,
    show_stock_filter: true,
    enable_search: true,
    search_placeholder: 'Buscar produtos...',

    // Layout
    layout_mode: 'grid',
    grid_columns_mobile: 1,
    grid_columns_tablet: 2,
    grid_columns_desktop: 3,
    grid_columns_wide: 4,
    card_style: 'modern',

    // Tema
    theme_mode: 'light',
    primary_color: '#DC2626',
    secondary_color: '#3B82F6',
    accent_color: '#10B981',
    background_color: '#F8FAFC',
    card_background: '#FFFFFF',
    text_primary: '#1E293B',
    text_secondary: '#64748B',

    // Categorias
    category_display_style: 'icons',
    category_icon_size: 'large',
    show_category_icons: true,
    show_category_images: false,
    category_layout: 'horizontal',

    // Funcionalidades
    enable_favorites: true,
    enable_share: true,
    enable_whatsapp_share: true,
    enable_product_comparison: false,
    enable_quick_view: false,
    show_related_products: false,

    // Badges
    show_new_badge: true,
    new_product_days: 30,
    show_featured_badge: true,
    show_out_of_stock_badge: true,
    show_low_stock_badge: true,

    // SEO
    enable_seo_friendly_urls: true,

    // Compartilhamento
    enable_public_catalog: true,
    require_login: false,
    enable_qr_code: true,

    // Analytics
    track_views: true,
    track_clicks: true,
    track_shares: true,

    // Notificações
    notify_low_stock: false,
    notify_out_of_stock: false,

    // Avançado
    enable_cache: true,
    cache_duration_minutes: 15
};
