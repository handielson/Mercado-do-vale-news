export const CATEGORY_SPEC_FIELD_METADATA = {
    material: { label: 'Material', type: 'text', placeholder: 'Ex: PLA, PETG, resina' },
    size: { label: 'Tamanho', type: 'text', placeholder: 'Ex: Pequeno, 15 cm' },
    finish: { label: 'Acabamento', type: 'text', placeholder: 'Ex: Fosco, brilhante, pintado' },
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
    irda: {
        label: 'IrDA',
        type: 'select',
        options: ['Sim', 'Não', 'Consulte'],
    },
};

// Fill only gaps: category/custom definitions and model-provided values win.
export function getPrint3dDefaultSpecFields(categoryConfig = {}, customFields = [], templateValues = {}) {
    const normalize = value => String(value || '').trim().replace(/^specs\./i, '').toLowerCase();
    const configured = new Set([
        ...Object.keys(categoryConfig || {}), ...Object.keys(templateValues || {}),
        ...[...(categoryConfig?.custom_fields || []), ...(customFields || [])].map(field =>
            field.key ?? field.field_key ?? field.technicalName ?? field.technical_name ?? field.name),
    ].map(normalize));
    return [['material'], ['size', 'tamanho'], ['finish', 'acabamento']]
        .filter(aliases => !aliases.some(key => configured.has(key)))
        .map(([key]) => ({ key, requirement: 'optional' }));
}

const IGNORED_CATEGORY_CONFIG_KEYS = new Set([
    'custom_fields',
    'ean_autofill_config',
    'auto_name_enabled',
    'auto_name_template',
    'auto_name_fields',
    'auto_name_separator',
    'unique_fields',
    'iks',
    'sks',
    'irda',
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
