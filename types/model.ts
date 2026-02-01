
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
}

export interface ModelInput {
    name: string;
    brand_id: string;
    active?: boolean;
}
