
/**
 * FIELD DICTIONARY
 * Centralized definition of all form fields with labels, placeholders, and formatting rules
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Single source of truth for field metadata
 * - Automatic text formatting (capitalize, uppercase, lowercase)
 * - Used by SmartInput component
 */

export type FieldFormat =
    // Text formats
    | 'capitalize'      // First letter uppercase: "Iphone 14"
    | 'uppercase'       // All uppercase: "IPHONE 14"
    | 'lowercase'       // All lowercase: "iphone 14"
    | 'titlecase'       // Each word capitalized: "Iphone 14 Pro"
    | 'sentence'        // First letter of sentences: "Hello. World."
    | 'slug'            // URL-friendly: "iphone-14-pro"
    // Number/Document formats
    | 'phone'           // Phone: "(11) 98765-4321"
    | 'cpf'             // CPF: "123.456.789-01"
    | 'cnpj'            // CNPJ: "12.345.678/0001-90"
    | 'cep'             // CEP: "12345-678"
    | 'brl'             // Currency BRL: "R$ 1.234,56"
    | 'numeric'         // Only numbers: "12345"
    | 'alphanumeric'    // Letters and numbers only: "ABC123"
    // Date formats
    | 'date_br'         // Brazilian date: "31/01/2026"
    | 'date_br_short'   // Short BR date: "31/01/26"
    | 'date_iso'        // ISO date: "2026-01-31"
    // Fiscal formats (Brazilian tax codes)
    | 'ncm'             // NCM: "12345678" (8 digits)
    | 'ean13'           // EAN-13: "7891234567890" (13 digits)
    | 'cest'            // CEST: "1234567" (7 digits)
    // Specialized components (use dedicated components, not SmartInput)
    | 'currency'        // Uses CurrencyInput (stores as INTEGER CENTS)
    | 'imei'            // Uses IMEIInput (15-digit validation)
    | 'selector'        // Uses dedicated selector component (e.g., ColorSelect, BrandSelect)
    | 'none';           // No formatting

export interface FieldDefinition {
    label: string;
    placeholder: string;
    format: FieldFormat;
    required?: boolean;
    description?: string;
    minLength?: number;
    maxLength?: number;
}

/**
 * Field Dictionary
 * Add new fields here to ensure consistency across the application
 */
export const FIELD_DICTIONARY: Record<string, FieldDefinition> = {
    // Product Basic Info
    name: {
        label: 'Nome do Produto',
        placeholder: 'Ex: iPhone 14 Pro Max',
        format: 'capitalize',
        required: true,
        description: 'Nome completo do produto com capitalização automática'
    },
    sku: {
        label: 'SKU (Código)',
        placeholder: 'Ex: IPHONE14-256-BLK',
        format: 'uppercase',
        required: false,
        description: 'Código único do produto em letras maiúsculas'
    },
    description: {
        label: 'Descrição',
        placeholder: 'Descreva as características do produto...',
        format: 'none',
        required: false,
        description: 'Descrição detalhada do produto'
    },

    // Product Specifications (text fields only - selectors have their own components)
    imei: {
        label: 'IMEI',
        placeholder: 'Ex: 123456789012345',
        format: 'imei',
        required: false,
        description: 'Número IMEI do dispositivo (usa IMEIInput component)'
    },
    model_name: {
        label: 'Nome do Modelo',
        placeholder: 'Ex: Iphone 14 pro max',
        format: 'capitalize',
        required: true,
        description: 'Nome do modelo com capitalização automática (mesma formatação do nome do produto)'
    },
    nome_cor: {
        label: 'Nome da Cor',
        placeholder: 'Ex: Azul Meia-Noite, Preto',
        format: 'titlecase',
        required: true,
        description: 'Nome da cor do produto (capitaliza cada palavra)'
    },

    // Pricing Fields (use CurrencyInput component)
    price_cost: {
        label: 'Preço de Custo',
        placeholder: 'R$ 0,00',
        format: 'currency',
        required: true,
        description: 'Preço de compra/custo do produto (usa CurrencyInput)'
    },
    price_retail: {
        label: 'Preço Varejo',
        placeholder: 'R$ 0,00',
        format: 'currency',
        required: true,
        description: 'Preço de venda no varejo (usa CurrencyInput)'
    },
    price_reseller: {
        label: 'Preço Revenda',
        placeholder: 'R$ 0,00',
        format: 'currency',
        required: true,
        description: 'Preço para revendedores (usa CurrencyInput)'
    },
    price_wholesale: {
        label: 'Preço Atacado',
        placeholder: 'R$ 0,00',
        format: 'currency',
        required: true,
        description: 'Preço para atacado (usa CurrencyInput)'
    },

    // Fiscal Fields
    ean: {
        label: 'Código de Barras (EAN-13)',
        placeholder: '7891234567890',
        format: 'ean13',
        required: false,
        description: 'Código de barras EAN-13 (13 dígitos numéricos)'
    },
    ncm: {
        label: 'NCM (8 dígitos)',
        placeholder: '12345678',
        format: 'ncm',
        required: false,
        description: 'Nomenclatura Comum do Mercosul (8 dígitos numéricos)'
    },
    cest: {
        label: 'CEST (7 dígitos)',
        placeholder: '1234567',
        format: 'cest',
        required: false,
        description: 'Código Especificador da Substituição Tributária (7 dígitos numéricos)'
    },

    // Logistics Fields
    weight_kg: {
        label: 'Peso (kg)',
        placeholder: '0.000',
        format: 'none',
        required: false,
        description: 'Peso do produto em quilogramas'
    },
    width_cm: {
        label: 'Largura (cm)',
        placeholder: '0.0',
        format: 'none',
        required: false,
        description: 'Largura da embalagem em centímetros'
    },
    height_cm: {
        label: 'Altura (cm)',
        placeholder: '0.0',
        format: 'none',
        required: false,
        description: 'Altura da embalagem em centímetros'
    },
    depth_cm: {
        label: 'Profundidade (cm)',
        placeholder: '0.0',
        format: 'none',
        required: false,
        description: 'Profundidade da embalagem em centímetros'
    },

    // Additional Info
    notes: {
        label: 'Observações',
        placeholder: 'Informações adicionais...',
        format: 'none',
        required: false,
        description: 'Notas internas sobre o produto'
    },
    capacidade_bateria: {
        label: 'Capacidade da Bateria',
        placeholder: 'Ex: 5000 mAH',
        format: 'alphanumeric',
        required: false,
        description: 'Capacidade da bateria em mAH',
        maxLength: 20
    },

    // Customer Info (for future use)
    customer_name: {
        label: 'Nome do Cliente',
        placeholder: 'Ex: João Silva',
        format: 'capitalize',
        required: false,
        description: 'Nome completo do cliente'
    },
    customer_email: {
        label: 'E-mail',
        placeholder: 'cliente@exemplo.com',
        format: 'lowercase',
        required: false,
        description: 'E-mail do cliente em minúsculas'
    }
};

/**
 * Get field definition by key
 */
export function getFieldDefinition(fieldKey: string): FieldDefinition | undefined {
    return FIELD_DICTIONARY[fieldKey];
}

/**
 * Apply text formatting based on field format rule
 */
export function applyFieldFormat(value: string, format: FieldFormat): string {
    if (!value) return value;

    switch (format) {
        // ========== TEXT FORMATS ==========
        case 'capitalize':
            // Capitalize first letter only
            return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

        case 'uppercase':
            return value.toUpperCase();

        case 'lowercase':
            return value.toLowerCase();

        case 'titlecase':
            // Capitalize first letter of each word
            return value
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

        case 'sentence':
            // Capitalize first letter of each sentence
            return value.replace(/(^\w|\.\s+\w)/g, letter => letter.toUpperCase());

        case 'slug':
            // Convert to URL-friendly slug
            return value
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[^a-z0-9]+/g, '-')      // Replace non-alphanumeric with dash
                .replace(/^-+|-+$/g, '');         // Remove leading/trailing dashes

        // ========== NUMBER/DOCUMENT FORMATS ==========
        case 'phone':
            // Format: (11) 98765-4321
            const phoneDigits = value.replace(/\D/g, '');
            if (phoneDigits.length <= 10) {
                // Landline: (11) 3456-7890
                return phoneDigits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
            } else {
                // Mobile: (11) 98765-4321
                return phoneDigits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            }

        case 'cpf':
            // Format: 123.456.789-01
            const cpfDigits = value.replace(/\D/g, '').slice(0, 11);
            return cpfDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

        case 'cnpj':
            // Format: 12.345.678/0001-90
            const cnpjDigits = value.replace(/\D/g, '').slice(0, 14);
            return cnpjDigits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

        case 'cep':
            // Format: 12345-678
            const cepDigits = value.replace(/\D/g, '').slice(0, 8);
            return cepDigits.replace(/(\d{5})(\d{3})/, '$1-$2');

        case 'brl':
            // Format: R$ 1.234,56
            const brlDigits = value.replace(/\D/g, '');
            if (!brlDigits) return 'R$ 0,00';

            const brlNumber = parseFloat(brlDigits) / 100;
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(brlNumber);

        case 'numeric':
            // Only numbers
            return value.replace(/\D/g, '');

        case 'alphanumeric':
            // Only letters and numbers (no special characters)
            return value.replace(/[^a-zA-Z0-9]/g, '');

        // ========== DATE FORMATS ==========
        case 'date_br':
            // Format: DD/MM/YYYY (31/01/2026)
            const brDigits = value.replace(/\D/g, '').slice(0, 8);
            if (brDigits.length <= 2) return brDigits;
            if (brDigits.length <= 4) return `${brDigits.slice(0, 2)}/${brDigits.slice(2)}`;
            return `${brDigits.slice(0, 2)}/${brDigits.slice(2, 4)}/${brDigits.slice(4)}`;

        case 'date_br_short':
            // Format: DD/MM/YY (31/01/26)
            const brShortDigits = value.replace(/\D/g, '').slice(0, 6);
            if (brShortDigits.length <= 2) return brShortDigits;
            if (brShortDigits.length <= 4) return `${brShortDigits.slice(0, 2)}/${brShortDigits.slice(2)}`;
            return `${brShortDigits.slice(0, 2)}/${brShortDigits.slice(2, 4)}/${brShortDigits.slice(4)}`;

        case 'date_iso':
            // Format: YYYY-MM-DD (2026-01-31)
            const isoDigits = value.replace(/\D/g, '').slice(0, 8);
            if (isoDigits.length <= 4) return isoDigits;
            if (isoDigits.length <= 6) return `${isoDigits.slice(0, 4)}-${isoDigits.slice(4)}`;
            return `${isoDigits.slice(0, 4)}-${isoDigits.slice(4, 6)}-${isoDigits.slice(6)}`;

        // ========== FISCAL FORMATS (Brazilian Tax Codes) ==========
        case 'ncm':
            // NCM: 8 digits only
            return value.replace(/\D/g, '').slice(0, 8);

        case 'ean13':
            // EAN-13: 13 digits only
            return value.replace(/\D/g, '').slice(0, 13);

        case 'cest':
            // CEST: 7 digits only
            return value.replace(/\D/g, '').slice(0, 7);

        // Specialized components (these should use dedicated components, not SmartInput)
        case 'currency':
            // This field uses CurrencyInput component - stores as INTEGER CENTS
            return value; // No text formatting, handled by CurrencyInput

        case 'imei':
            // This field uses IMEIInput component - 15-digit validation
            return value.replace(/\D/g, '').slice(0, 15).toUpperCase();

        case 'selector':
            // This field uses a dedicated selector component (ColorSelect, BrandSelect, etc.)
            return value; // No text formatting, handled by selector component

        case 'none':
        default:
            return value;
    }
}

// ============================================
// RUNTIME FIELD DICTIONARY MANAGEMENT
// ============================================

const FIELD_DICTIONARY_STORAGE_KEY = 'antigravity_field_dictionary_v1';

/**
 * Load field dictionary from localStorage (with fallback to defaults)
 */
function loadFieldDictionary(): Record<string, FieldDefinition> {
    try {
        const stored = localStorage.getItem(FIELD_DICTIONARY_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading field dictionary from localStorage:', error);
    }
    return { ...FIELD_DICTIONARY };
}

/**
 * Save field dictionary to localStorage
 */
function saveFieldDictionary(dictionary: Record<string, FieldDefinition>): void {
    try {
        localStorage.setItem(FIELD_DICTIONARY_STORAGE_KEY, JSON.stringify(dictionary));
    } catch (error) {
        console.error('Error saving field dictionary to localStorage:', error);
    }
}

/**
 * Runtime field dictionary (loaded from localStorage or defaults)
 */
let runtimeDictionary: Record<string, FieldDefinition> = loadFieldDictionary();

/**
 * Get current runtime field dictionary
 */
export function getRuntimeFieldDictionary(): Record<string, FieldDefinition> {
    return { ...runtimeDictionary };
}

/**
 * Get field definition by key (from runtime dictionary)
 */
export function getFieldDefinitionRuntime(fieldKey: string): FieldDefinition | undefined {
    return runtimeDictionary[fieldKey];
}

/**
 * Update field format at runtime
 */
export function updateFieldFormat(fieldKey: string, newFormat: FieldFormat): boolean {
    if (!runtimeDictionary[fieldKey]) {
        console.error(`Field "${fieldKey}" not found in dictionary`);
        return false;
    }

    runtimeDictionary[fieldKey] = {
        ...runtimeDictionary[fieldKey],
        format: newFormat
    };

    saveFieldDictionary(runtimeDictionary);
    return true;
}

/**
 * Reset field dictionary to defaults
 */
export function resetFieldDictionary(): void {
    runtimeDictionary = { ...FIELD_DICTIONARY };
    saveFieldDictionary(runtimeDictionary);
}

/**
 * Create a new custom field
 */
export function createCustomField(
    key: string,
    definition: FieldDefinition
): boolean {
    // Validate key format (lowercase, underscores only)
    if (!/^[a-z_]+$/.test(key)) {
        console.error('Field key must contain only lowercase letters and underscores');
        return false;
    }

    // Check if field already exists
    if (runtimeDictionary[key]) {
        console.error(`Field "${key}" already exists`);
        return false;
    }

    runtimeDictionary[key] = definition;
    saveFieldDictionary(runtimeDictionary);
    return true;
}

/**
 * Delete a custom field (only non-default fields can be deleted)
 */
export function deleteCustomField(key: string): boolean {
    // Prevent deletion of default fields
    if (FIELD_DICTIONARY[key]) {
        console.error(`Cannot delete default field "${key}"`);
        return false;
    }

    if (!runtimeDictionary[key]) {
        console.error(`Field "${key}" not found`);
        return false;
    }

    delete runtimeDictionary[key];
    saveFieldDictionary(runtimeDictionary);
    return true;
}

/**
 * Check if a field is a custom field (not in defaults)
 */
export function isCustomField(key: string): boolean {
    return !FIELD_DICTIONARY[key] && !!runtimeDictionary[key];
}
