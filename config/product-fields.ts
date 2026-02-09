/**
 * Product Fields Configuration
 * Central source of truth for all product fields used across the application
 */

export interface FieldDefinition {
    key: string;
    label: string;
    category: 'basic' | 'spec' | 'price' | 'fiscal' | 'logistics';
}

/**
 * All product fields available in the system
 * This is the single source of truth for field definitions
 */
export const PRODUCT_FIELDS: FieldDefinition[] = [
    // Basic Information
    { key: 'category_id', label: 'Categoria', category: 'basic' },
    { key: 'brand', label: 'Marca', category: 'basic' },
    { key: 'model', label: 'Modelo', category: 'basic' },
    { key: 'name', label: 'Nome do Produto', category: 'basic' },
    { key: 'sku', label: 'SKU', category: 'basic' },
    { key: 'description', label: 'Descrição', category: 'basic' },

    // Specifications
    { key: 'specs.imei1', label: 'IMEI 1', category: 'spec' },
    { key: 'specs.imei2', label: 'IMEI 2', category: 'spec' },
    { key: 'specs.serial', label: 'Serial', category: 'spec' },
    { key: 'specs.color', label: 'Cor', category: 'spec' },
    { key: 'specs.storage', label: 'Armazenamento', category: 'spec' },
    { key: 'specs.ram', label: 'RAM', category: 'spec' },
    { key: 'specs.version', label: 'Versão', category: 'spec' },
    { key: 'specs.battery_health', label: 'Saúde da Bateria', category: 'spec' },
    { key: 'specs.battery_mah', label: 'Bateria (mAh)', category: 'spec' },
    { key: 'specs.display', label: 'Display (pol)', category: 'spec' },

    // Media
    { key: 'images', label: 'Imagens', category: 'basic' },

    // Prices
    { key: 'price_cost', label: 'Preço de Custo', category: 'price' },
    { key: 'price_retail', label: 'Preço Varejo', category: 'price' },
    { key: 'price_reseller', label: 'Preço Revenda', category: 'price' },
    { key: 'price_wholesale', label: 'Preço Atacado', category: 'price' },
];

/**
 * Unique fields that should NOT be auto-filled from model template
 * These are specific to individual product units
 */
export const UNIQUE_FIELDS = ['imei1', 'imei2', 'serial', 'color', 'ean', 'sku'];

/**
 * Get fields by category
 */
export function getFieldsByCategory(category: FieldDefinition['category']): FieldDefinition[] {
    return PRODUCT_FIELDS.filter(f => f.category === category);
}

/**
 * Get all basic information fields
 */
export function getBasicFields(): FieldDefinition[] {
    return getFieldsByCategory('basic');
}

/**
 * Get all specification fields
 */
export function getSpecFields(): FieldDefinition[] {
    return getFieldsByCategory('spec');
}

/**
 * Get all price fields
 */
export function getPriceFields(): FieldDefinition[] {
    return getFieldsByCategory('price');
}
