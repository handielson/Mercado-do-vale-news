
/**
 * MODEL TYPES
 * Interface definitions for Model entity
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows same pattern as Brand types
 * - Models are associated with brands
 * - Includes active flag for soft delete
 */

export interface Model {
    id: string;
    name: string;
    slug: string;
    brand_id: string;  // Reference to brand
    active: boolean;
    created: string;
    updated: string;

    // Template fields
    category_id?: string;
    description?: string;
    template_values?: Record<string, any> & {
        shopee_category_id?: number | null;
        shopee_category_name?: string;
        shopee_attribute_defaults?: Record<string, any>;
        shopee_auto_publish_enabled?: boolean;
    };  // Dynamic default values

    // EAN codes for product identification
    eans?: string[];  // Array of EAN/GTIN codes for barcode scanning
}

export interface ModelInput {
    name: string;
    brand_id: string;
    active?: boolean;

    // Template fields
    category_id?: string;
    description?: string;
    template_values?: Record<string, any> & {
        shopee_category_id?: number | null;
        shopee_category_name?: string;
        shopee_attribute_defaults?: Record<string, any>;
        shopee_auto_publish_enabled?: boolean;
    };

    // EAN codes
    eans?: string[];
}

