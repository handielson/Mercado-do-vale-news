// Catalog System Types

export interface Banner {
    id: string;
    title: string;
    image_url: string;
    link_url?: string;
    link_type: 'product' | 'category' | 'external' | 'none';
    link_target?: string;
    display_order: number;
    is_active: boolean;
    start_date?: Date;
    end_date?: Date;
    clicks_count: number;
    views_count: number;
    created_at: Date;
    updated_at: Date;
}

export interface CatalogShare {
    id: string;
    share_type: 'whatsapp' | 'copy' | 'pdf';
    scope: 'full' | 'category' | 'product';
    scope_value?: string;
    customer_id?: string;
    session_id?: string;
    shared_at: Date;
}

export interface ProductImage {
    id: string;
    product_id: string;
    image_url: string;
    is_primary: boolean;
    display_order: number;
    created_at: Date;
}

export interface CustomerFavorite {
    id: string;
    customer_id: string;
    product_id: string;
    created_at: Date;
}

export interface ProductView {
    id: string;
    product_id: string;
    customer_id?: string;
    session_id?: string;
    viewed_at: Date;
}

export interface FilterState {
    categories: string[];
    brands: string[];
    priceRange: [number, number];
    storage: string[];
    ram: string[];
    colors: string[];
    condition: string[];
    inStockOnly: boolean;
}

export interface CatalogState {
    products: Product[];
    filters: FilterState;
    searchQuery: string;
    viewMode: 'grid' | 'list';
    sortBy: 'price_asc' | 'price_desc' | 'newest' | 'popular' | 'featured';
    favorites: string[];
    comparison: Product[];
    isLoading: boolean;
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        hasMore: boolean;
    };
}

export interface ShareOptions {
    type: 'whatsapp' | 'copy' | 'pdf';
    scope: 'full' | 'category' | 'product';
    scopeValue?: string;
}

// Extended Product type with catalog fields
export interface CatalogProduct extends Product {
    featured?: boolean;
    is_new?: boolean;
    discount_percentage?: number;
    views_count?: number;
    last_viewed_at?: Date;
    seo_title?: string;
    seo_description?: string;
    seo_keywords?: string[];
    images?: ProductImage[];
    is_favorite?: boolean;
}
