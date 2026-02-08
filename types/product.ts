
import { ProductStatus } from '../utils/field-standards';

/**
 * Product Origin (Fiscal)
 * Based on Brazilian tax regulations
 */
export enum ProductOrigin {
    NATIONAL = '0',                      // Nacional
    FOREIGN_DIRECT = '1',                // Estrangeira - Importação direta
    FOREIGN_INTERNAL = '2',              // Estrangeira - Adquirida no mercado interno
    NATIONAL_FOREIGN_40 = '3',           // Nacional com conteúdo estrangeiro > 40%
    NATIONAL_FOREIGN_70 = '4',           // Nacional com conteúdo estrangeiro <= 40%
    NATIONAL_IMPORT_NO_SIMILAR = '5',    // Nacional com importação sem similar
    FOREIGN_NO_SIMILAR = '6',            // Estrangeira sem similar nacional
    FOREIGN_INDUSTRIALIZATION = '7',     // Estrangeira - Industrialização no Brasil
    NATIONAL_FOREIGN_70_NO_SIMILAR = '8' // Nacional > 70% com importação sem similar
}

/**
 * Warranty Type
 * Defines how warranty is determined for a product
 */
export type WarrantyType = 'brand' | 'category' | 'custom';

/**
 * Product Dimensions (Logistics)
 */
export interface ProductDimensions {
    width_cm: number;   // Largura em centímetros
    height_cm: number;  // Altura em centímetros
    depth_cm: number;   // Profundidade em centímetros
}

/**
 * Product Interface
 * Represents a product in the catalog with category, brand, and specifications
 * All price fields are stored as integers in CENTAVOS (e.g., R$ 10,50 = 1050)
 */
export interface Product {
    id: string;

    // Category & Brand
    category_id: string;
    brand: string;
    model: string;

    // Basic Information
    name: string;
    sku: string;

    // Financial Integrity: All prices in CENTAVOS (integer)
    price_cost: number;        // Preço de Custo/Compra (centavos)
    price_retail: number;      // Preço Varejo (centavos)
    price_reseller: number;    // Preço Revenda (centavos)
    price_wholesale: number;   // Preço Atacado (centavos)

    // Media & Identifiers
    images: string[];          // URLs or blob URLs
    eans: string[];            // Códigos de barras (EAN-13)

    // Fiscal & Compliance (ERP-ready)
    ncm?: string;              // Nomenclatura Comum do Mercosul (8 dígitos)
    cest?: string;             // Código Especificador da Substituição Tributária (7 dígitos)
    origin?: ProductOrigin;    // Origem da mercadoria (0-8)

    // Logistics & Shipping
    weight_kg?: number;        // Peso líquido em quilogramas
    dimensions?: ProductDimensions; // Dimensões para cálculo de frete

    // Specifications (flexible object based on category)
    // Examples:
    // - Phone: { display: '6.1"', storage: '128GB', color: 'Azul', network: '5G' }
    // - Tablet: { display: '10.2"', storage: '64GB', wifi_only: true }
    specs: Record<string, any>;

    // Status using Enum (NO magic strings)
    status: ProductStatus;

    // Inventory Control
    track_inventory: boolean;      // If true, monitors stock quantity
    stock_quantity?: number;       // Quantity in stock (null if track_inventory = false)

    // Gift Product (Brinde)
    is_gift?: boolean;             // If true, applies automatic full discount in POS

    // Warranty Configuration
    warranty_type: WarrantyType;   // Type of warranty: brand, category, or custom
    warranty_template_id?: string; // Warranty template ID (only used when warranty_type = 'custom')

    // SEO Fields (AI-Generated)
    description?: string;          // Detailed product description (HTML/Rich Text) for SEO
    slug?: string;                 // URL-friendly slug (e.g., iphone-15-pro-max-256gb-preto)
    meta_title?: string;           // SEO meta title (max 60 characters)
    meta_description?: string;     // SEO meta description (max 160 characters)
    keywords?: string[];           // Keywords/tags for search and SEO

    // Timestamps
    created: string;
    updated: string;
}

/**
 * ProductInput Interface
 * Data required to create or update a product
 */
export interface ProductInput {
    category_id: string;
    brand: string;
    model: string;
    name: string;
    sku: string;
    price_cost: number;
    price_retail: number;
    price_reseller: number;
    price_wholesale: number;
    images?: string[];
    eans?: string[];
    ncm?: string;
    cest?: string;
    origin?: ProductOrigin;
    weight_kg?: number;
    dimensions?: ProductDimensions;
    specs?: Record<string, any>;
    status: ProductStatus;
    track_inventory: boolean;
    stock_quantity?: number;
    is_gift?: boolean;
    warranty_type?: WarrantyType;
    warranty_template_id?: string;
    // SEO Fields (AI-Generated)
    description?: string;
    slug?: string;
    meta_title?: string;
    meta_description?: string;
    keywords?: string[];
}
