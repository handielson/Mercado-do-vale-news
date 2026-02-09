/**
 * Shipping Preset Interface
 * Represents a reusable shipping dimensions template
 */
export interface ShippingPreset {
    id: string;
    name: string;
    category_id?: string;
    category?: string; // Nome da categoria (populated)
    weight: number; // gramas
    height: number; // cm
    width: number; // cm
    length: number; // cm
    is_default: boolean;
    created_at: string;
    updated_at: string;
    company_id: string;
}

/**
 * ShippingPresetInput Interface
 * Data required to create or update a shipping preset
 */
export interface ShippingPresetInput {
    name: string;
    category_id?: string;
    weight: number;
    height: number;
    width: number;
    length: number;
    is_default?: boolean;
}
