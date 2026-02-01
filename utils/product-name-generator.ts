import { CategoryConfig } from '../types/category';

/**
 * PRODUCT NAME GENERATOR
 * Automatically generates product names based on category configuration
 * 
 * Example:
 * Fields: ['model', 'ram', 'storage', 'color']
 * Values: 'iPhone 13', '4GB', '128GB', 'Azul'
 * Separator: ' '
 * Result: "iPhone 13 4GB 128GB Azul"
 */

/**
 * Generate product name based on category configuration
 * Supports both template-based and field-based generation
 * @param config - Category configuration with auto_name settings
 * @param productData - Product data object (includes specs)
 * @returns Generated product name or empty string if disabled
 */
export function generateProductName(
    config: CategoryConfig | undefined,
    productData: Record<string, any>
): string {
    if (!config?.auto_name_enabled) return '';

    // Use template if available (new method)
    if (config.auto_name_template) {
        return generateFromTemplate(config.auto_name_template, productData);
    }

    // Fallback to old field-based method (backward compatibility)
    if (config.auto_name_fields && config.auto_name_fields.length > 0) {
        const separator = config.auto_name_separator || ' ';
        const parts: string[] = [];

        for (const fieldKey of config.auto_name_fields) {
            let value: any;

            // Check in specs first (most fields are in specs)
            if (productData.specs && productData.specs[fieldKey] !== undefined) {
                value = productData.specs[fieldKey];
            }
            // Check in root level (brand, model, etc.)
            else if (productData[fieldKey] !== undefined) {
                value = productData[fieldKey];
            }

            // Add to parts if value exists and is not empty
            if (value !== null && value !== undefined && value.toString().trim()) {
                parts.push(value.toString().trim());
            }
        }

        return parts.join(separator);
    }

    return '';
}

/**
 * Generate name from template with placeholders
 * Template example: "{modelo}, {ram}/{armazenamento} - {versao}"
 * Result: "iPhone 13, 4GB/128GB - Global"
 */
function generateFromTemplate(
    template: string,
    productData: Record<string, any>
): string {
    let result = template;

    // Map Portuguese placeholders to field names
    const placeholderMap: Record<string, string> = {
        'marca': 'brand',
        'modelo': 'model',
        'sku': 'sku',
        'ram': 'ram',
        'armazenamento': 'storage',
        'cor': 'color',
        'versao': 'version',
        'bateria': 'battery_health',
        'serial': 'serial',
        'imei1': 'imei1',
        'imei2': 'imei2',
        'ncm': 'ncm',
        'cest': 'cest',
        'peso': 'weight_kg'
    };

    // Replace all {placeholderName} with actual values
    const placeholderRegex = /\{(\w+)\}/g;

    result = result.replace(placeholderRegex, (match, placeholderName) => {
        // Get the actual field name from the map
        const fieldName = placeholderMap[placeholderName.toLowerCase()] || placeholderName;
        let value: any;

        // Check in specs first
        if (productData.specs && productData.specs[fieldName] !== undefined) {
            value = productData.specs[fieldName];
        }
        // If not in specs, check in root
        else if (productData[fieldName] !== undefined) {
            value = productData[fieldName];
        }

        // Return value or empty string if not found
        return value ? value.toString().trim() : '';
    });

    // Clean up extra spaces/separators when fields are missing
    result = result
        .replace(/,\s*,/g, ',')           // Remove double commas
        .replace(/\/\s*\//g, '/')         // Remove double slashes
        .replace(/-\s*-/g, '-')           // Remove double hyphens
        .replace(/\(\s*\)/g, '')          // Remove empty parentheses
        .replace(/,\s*$/g, '')            // Remove trailing comma
        .replace(/^\s*,/g, '')            // Remove leading comma
        .replace(/,\s*-/g, ' -')          // Clean up ", -" to " -"
        .replace(/-\s*,/g, ',')           // Clean up "- ," to ","
        .replace(/\/\s*-/g, ' -')         // Clean up "/ -" to " -"
        .replace(/-\s*\//g, '/')          // Clean up "- /" to "/"
        .replace(/\s+/g, ' ')             // Normalize multiple spaces to single
        .trim();

    return result;
}

/**
 * Generate preview name with example values for configuration UI
 * @param config - Category configuration with auto_name settings
 * @returns Preview of generated name with example data
 */
export function generatePreviewName(config: CategoryConfig): string {
    if (!config.auto_name_enabled || !config.auto_name_fields || config.auto_name_fields.length === 0) {
        return '(Nenhum campo selecionado)';
    }

    // Example data for preview
    const exampleData: Record<string, any> = {
        brand: 'Apple',
        model: 'iPhone 13',
        specs: {
            ram: '4GB',
            storage: '128GB',
            color: 'Azul',
            version: 'Global',
            battery_health: '100%'
        }
    };

    const generatedName = generateProductName(config, exampleData);
    return generatedName || '(Campos selecionados não têm valores de exemplo)';
}

/**
 * Get available fields for auto-naming configuration
 * Returns list of fields that can be used to compose product names
 */
export function getAvailableFieldsForNaming() {
    return [
        // Basic fields
        { key: 'brand', label: 'Marca', placeholder: '{marca}' },
        { key: 'model', label: 'Modelo', placeholder: '{modelo}' },
        { key: 'sku', label: 'SKU', placeholder: '{sku}' },

        // Specs - Common
        { key: 'ram', label: 'Memória RAM', placeholder: '{ram}' },
        { key: 'storage', label: 'Armazenamento', placeholder: '{armazenamento}' },
        { key: 'color', label: 'Cor', placeholder: '{cor}' },
        { key: 'version', label: 'Versão', placeholder: '{versao}' },

        // Specs - Condition
        { key: 'battery_health', label: 'Saúde da Bateria', placeholder: '{bateria}' },

        // Identifiers
        { key: 'serial', label: 'Número de Série', placeholder: '{serial}' },
        { key: 'imei1', label: 'IMEI 1', placeholder: '{imei1}' },
        { key: 'imei2', label: 'IMEI 2', placeholder: '{imei2}' },

        // Fiscal
        { key: 'ncm', label: 'NCM', placeholder: '{ncm}' },
        { key: 'cest', label: 'CEST', placeholder: '{cest}' },

        // Logistics
        { key: 'weight_kg', label: 'Peso (kg)', placeholder: '{peso}' }
    ];
}

/**
 * Get common separator options for UI
 */
export function getSeparatorOptions() {
    return [
        { value: ' ', label: 'Espaço ( )' },
        { value: '/', label: 'Barra (/)' },
        { value: '-', label: 'Hífen (-)' },
        { value: '_', label: 'Underscore (_)' },
        { value: ' - ', label: 'Espaço-Hífen-Espaço ( - )' },
        { value: ' / ', label: 'Espaço-Barra-Espaço ( / )' }
    ];
}

/**
 * Get template presets for quick selection
 */
export function getTemplatePresets() {
    return [
        {
            name: 'Simples (espaços)',
            template: '{modelo} {ram} {armazenamento} {cor}',
            example: 'iPhone 13 4GB 128GB Azul'
        },
        {
            name: 'Com vírgula e barra',
            template: '{modelo}, {ram}/{armazenamento} - {versao}',
            example: 'Redmi Note 14, 6GB/256GB - Global'
        },
        {
            name: 'Completo com marca',
            template: '{marca} {modelo} ({ram}/{armazenamento}) - {cor}',
            example: 'Apple iPhone 13 (4GB/128GB) - Azul'
        },
        {
            name: 'Compacto',
            template: '{modelo} {armazenamento} {cor}',
            example: 'iPhone 13 128GB Azul'
        }
    ];
}
