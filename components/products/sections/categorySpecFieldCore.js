export const CATEGORY_SPEC_FIELD_METADATA = {
    iks: {
        label: 'IKS',
        type: 'select',
        options: ['Sim', 'Não', 'Consulte'],
    },
    sks: {
        label: 'SKS',
        type: 'select',
        options: ['Sim', 'Não', 'Consulte'],
    },
};

const IGNORED_CATEGORY_CONFIG_KEYS = new Set([
    'custom_fields',
    'ean_autofill_config',
    'auto_name_enabled',
    'auto_name_template',
    'auto_name_fields',
    'auto_name_separator',
    'unique_fields',
]);

export function getCategoryDynamicSpecFields(categoryConfig, templateValues = {}) {
    if (!categoryConfig || typeof categoryConfig !== 'object') return [];

    return Object.entries(categoryConfig)
        .filter(([key, value]) => {
            if (typeof value !== 'string') return false;
            if (value === 'off' || value === 'hidden') return false;
            if (IGNORED_CATEGORY_CONFIG_KEYS.has(key)) return false;
            if (key.includes('ean_autofill') || key.includes('auto_name')) return false;
            if (templateValues && templateValues[key] !== undefined) return false;
            return true;
        })
        .sort(([keyA], [keyB]) => {
            if (keyA === 'serial') return -1;
            if (keyB === 'serial') return 1;
            return keyA.localeCompare(keyB);
        })
        .map(([key, requirement]) => ({ key, requirement }));
}
