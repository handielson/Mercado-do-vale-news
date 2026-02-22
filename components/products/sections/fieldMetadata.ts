import { FieldRequirement } from '../../../types/category';

/**
 * Field Metadata Map
 * Defines how each CategoryConfig field should be rendered
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Centralized field configuration
 * - Easy to add new fields
 * - Consistent rendering across the app
 */

export interface FieldMetadata {
    label: string;
    type: 'text' | 'number' | 'select' | 'imei' | 'color-select' | 'capacity-select' | 'version-select' | 'battery-health-select';
    placeholder?: string;
    options?: string[];
}

export const FIELD_METADATA: Record<string, FieldMetadata> = {
    // Inventory Identifiers
    imei1: {
        label: 'IMEI 1',
        type: 'imei',
        placeholder: 'Digite 15 dígitos'
    },
    imei2: {
        label: 'IMEI 2',
        type: 'imei',
        placeholder: 'Digite 15 dígitos'
    },
    serial: {
        label: 'Serial',
        type: 'text',
        placeholder: 'Ex: SN123456789'
    },

    // Product Specifications
    color: {
        label: 'Cor Predominante',
        type: 'color-select'
    },
    storage: {
        label: 'Armazenamento',
        type: 'capacity-select'
    },
    ram: {
        label: 'Memória RAM',
        type: 'capacity-select'
    },
    version: {
        label: 'Versão',
        type: 'version-select'
    },

    // Battery & Display
    battery_health: {
        label: 'Saúde Bateria',
        type: 'battery-health-select'
    },
    battery_mah: {
        label: 'Bateria (mAh)',
        type: 'number',
        placeholder: 'Ex: 5000'
    },
    display: {
        label: 'Display (pol)',
        type: 'text',
        placeholder: 'Ex: 6.7'
    }
};

/**
 * Check if a field is a "special" field that requires custom rendering
 * (e.g., IMEI inputs, ColorSelect, CapacitySelect, etc.)
 */
export const isSpecialField = (key: string): boolean => {
    const specialFields = ['imei1', 'imei2', 'serial', 'color', 'storage', 'ram', 'version', 'battery_health'];
    return specialFields.includes(key);
};

/**
 * Fields that are specific to a product unit (vary per unit or variation).
 * Only these fields are shown in the product entry form.
 * Fields NOT listed here (e.g., battery_mah, display) belong to the model template.
 */
const PRODUCT_LEVEL_FIELDS = [
    'imei1', 'imei2', 'serial',
    'color', 'storage', 'ram',
    'version', 'battery_health'
];

/**
 * Check if a field should be rendered in the product form.
 * Only product-level fields (unique per unit/variation) are rendered.
 * Model-level fields (battery_mah, display, etc.) are excluded.
 */
export const shouldRenderField = (key: string, requirement: FieldRequirement | undefined): boolean => {
    if (!requirement || requirement === 'off') return false;
    if (!FIELD_METADATA[key]) return false;
    if (!PRODUCT_LEVEL_FIELDS.includes(key)) return false;
    return true;
};
