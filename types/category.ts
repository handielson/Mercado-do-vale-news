/**
 * Traffic Light Pattern for Field Requirements
 * - off: Field is hidden from UI
 * - optional: Field is visible but not required
 * - required: Field is visible and mandatory
 */
export type FieldRequirement = 'off' | 'optional' | 'required';

/**
 * Custom Field Types
 * Defines the input type for custom fields
 * Includes all format types from field-dictionary for full compatibility
 */
export type CustomFieldType =
    // Basic types
    | 'text'
    | 'number'
    | 'dropdown'
    | 'textarea'
    // Text formatting
    | 'capitalize'
    | 'uppercase'
    | 'lowercase'
    | 'titlecase'
    | 'sentence'
    | 'slug'
    // Specialized text
    | 'alphanumeric'
    | 'numeric'
    // Brazilian formats
    | 'phone'
    | 'cpf'
    | 'cnpj'
    | 'cep'
    // Date formats
    | 'date_br'
    | 'date_br_short'
    | 'date_iso'
    // Fiscal codes
    | 'ncm'
    | 'ean13'
    | 'cest'
    // Currency
    | 'brl';

/**
 * Custom Field Definition
 * Allows categories to have dynamic, user-defined fields
 */
export interface CustomField {
    id: string;                    // Unique identifier
    name: string;                  // Display name (e.g., "Garantia Estendida")
    key: string;                   // Internal key (e.g., "extended_warranty")
    type: CustomFieldType;         // Input type
    requirement: FieldRequirement; // Traffic light status
    options?: string[];            // For dropdown type
    placeholder?: string;          // Placeholder text
}

/**
 * Category Configuration
 * Controls which fields are shown and required for products/units in this category
 */
export interface CategoryConfig {
    // Inventory Identifiers (Unit level)
    imei1: FieldRequirement;           // IMEI 1 tracking (15 digits)
    imei2: FieldRequirement;           // IMEI 2 tracking (15 digits)
    serial: FieldRequirement;          // Serial number

    // Product Specifications
    color: FieldRequirement;           // Device color
    storage: FieldRequirement;         // Storage capacity (128GB, 256GB)
    ram: FieldRequirement;             // RAM capacity (4GB, 8GB)
    version: FieldRequirement;         // Regional variant (Global, China)

    // Condition-based fields
    battery_health: FieldRequirement;  // Battery health % (for used items)

    // Custom Fields (dynamic)
    custom_fields?: CustomField[];     // User-defined fields

    // EAN Auto-Fill Configuration
    ean_autofill_config?: {
        enabled: boolean;              // If true, auto-fills fields when EAN is found
        exclude_fields?: string[];     // Fields to NOT auto-fill (e.g., ['imei1', 'imei2', 'serial'])
    };

    // Automatic Product Name Generation
    auto_name_enabled?: boolean;       // If true, generates product name automatically
    auto_name_template?: string;       // Template with placeholders: "{model}, {ram}/{storage} - {version}"

    // DEPRECATED (kept for backward compatibility)
    auto_name_fields?: string[];       // Fields to compose the name (ex: ['model', 'ram', 'storage', 'color'])
    auto_name_separator?: string;      // Separator between fields (default: ' ', can be '/', '-', etc.)
}

/**
 * Category Interface
 * Represents a product category with field requirements configuration
 */
export interface Category {
    id: string;
    name: string;
    slug: string;
    config: CategoryConfig;  // Field requirements configuration
    created: string;
    updated: string;
}

/**
 * CategoryInput Interface
 * Data required to create or update a category
 */
export interface CategoryInput {
    name: string;
    slug?: string;
    config: CategoryConfig;
}
