// Catalog System Types
import type { Product } from './product';


/**
 * Espelha exatamente a tabela `catalog_banners` do Supabase.
 * Campos verificados em 2026-02-19 contra information_schema.
 */
export interface Banner {
    id: string;
    title: string;
    subtitle?: string;   // texto exibido abaixo do título no carrossel
    image_url: string;
    /** Destino do link — campo canônico da tabela. */
    link_target?: string;
    /** Campo legado na tabela — mantido para SELECT; não usar em INSERT/UPDATE. */
    link_url?: string;
    link_type: 'product' | 'category' | 'external' | 'none';
    display_order: number;
    is_active: boolean;
    /** Rascunho — banner não publicado ainda */
    is_draft?: boolean;
    start_date?: Date;
    end_date?: Date;
    published_at?: Date;
    clicks_count: number;
    views_count: number;
    /**
     * Tipos de cliente que podem visualizar este banner.
     * Array vazio = visível para todos.
     * Valores: 'varejo' | 'revenda' | 'atacado'
     */
    target_audience: string[];
    created_at: Date;
    updated_at: Date;
}

/** @alias Banner — alias para compatibilidade com componentes admin */
export type CatalogBanner = Banner;


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
    // Note: images is inherited from Product as string[] - do not override
    is_favorite?: boolean;
    category_slug?: string; // Slug da categoria para exibição de badges
}

// Product Variants - For grouping products by model
export interface ProductVariants {
    rams: string[];
    storages: string[];
    colors: Array<{ name: string; hex?: string }>;
    priceRange: { min: number; max: number };
}

// Product Variant - Single RAM/Storage combination with its colors
export interface ProductVariant {
    ram: string;
    storage: string;
    colors: Array<{ name: string; hex?: string }>;
    products: CatalogProduct[];
    priceRange: { min: number; max: number };
}

// Product Group - Aggregated products by Brand + Model (with multiple variants)
export interface ProductGroup {
    groupKey: string;
    brand: string;
    model: string;
    variants: ProductVariant[];
    allColors: Array<{ name: string; hex?: string }>; // All colors across all variants
    globalPriceRange: { min: number; max: number }; // Price range across all variants
    representativeProduct: CatalogProduct;
}

// Variant Specifications - Selected variant details
export interface VariantSpecs {
    ram: string;
    storage: string;
    color: string;
}

// Installment Plan - Payment options
export interface InstallmentPlan {
    installments: number;
    value: number;      // Valor da parcela (centavos)
    total: number;      // Total a pagar (centavos)
    label: string;      // "À VISTA (PIX)", "10x", etc.
    highlighted?: boolean;
}

// Address - Delivery address
export interface Address {
    cep: string;
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    number?: string;
    complement?: string;
}

// Delivery Option - Pickup or delivery
export interface DeliveryOption {
    type: 'pickup' | 'delivery';
    address?: Address;
    notes?: string;
}

// Quote Request - Complete quote for WhatsApp
export interface QuoteRequest {
    product: CatalogProduct;
    variant: VariantSpecs;
    installmentPlan: InstallmentPlan;
    delivery: DeliveryOption;
}
