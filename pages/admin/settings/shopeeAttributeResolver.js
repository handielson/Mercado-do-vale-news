// shopeeAttributeResolver.js
//
// Helper compartilhado para resolver atributos de categoria Shopee.
//
// Fonte unica de:
//   - extracao da arvore de atributos da resposta bruta da Shopee;
//   - normalizacao para o formato usado pelo front (ShopeeAttributeField);
//   - aplicacao de sugestoes de valores (marca local, modelo do nome, defaults de template).
//
// Reusado por:
//   - pages/admin/settings/ShopeePage.tsx (fluxo de publicacao individual + envio em massa);
//   - components/settings/ModelModal.tsx (aba Shopee do cadastro de modelos).
//
// Mantido puro (sem React, sem fetch) para poder ser importado por componentes TSX
// sem puxar dependencias pesadas e para ser testado isoladamente.

import { buildShopeeTemplateAttributeValues, resolveShopeeFieldTemplate } from './shopeeFieldTemplates.js';

// ─── Tipos (JSDoc para TS-friendly) ───────────────────────────────────────────

/**
 * @typedef {Object} ShopeeAttributeOption
 * @property {number} value_id
 * @property {string} label
 * @property {string} raw_name
 * @property {string} original_value_name
 */

/**
 * @typedef {Object} ShopeeAttributeField
 * @property {number} attribute_id
 * @property {string} label
 * @property {boolean} mandatory
 * @property {'select'|'multiselect'|'text'|'searchable'} input_kind
 * @property {ShopeeAttributeOption[]} attribute_value_list
 * @property {string|number} [raw_input_type]
 * @property {boolean} [support_search_value]
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

const SHOPEE_WARRANTY_TYPE_ATTRIBUTE_IDS = new Set([100370]);
const SHOPEE_SUPPLIER_WARRANTY_OPTION = {
    value_id: 2437,
    label: 'Garantia do Fornecedor',
    raw_name: 'Supplier Warranty',
    original_value_name: 'Supplier Warranty',
};

// ─── Helpers de texto ─────────────────────────────────────────────────────────

export function normalizeLookupText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function translateShopeeText(entity, fallbackKeys = []) {
    if (Array.isArray(entity?.multi_lang)) {
        const localized = entity.multi_lang.find((entry) => {
            const language = String(entry?.language || '').toLowerCase();
            return language === 'pt-br' || language === 'pt_br' || language.startsWith('pt');
        });
        if (typeof localized?.value === 'string' && localized.value.trim()) {
            return localized.value.trim();
        }
    }

    for (const key of fallbackKeys) {
        const value = entity?.[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return '';
}

// ─── Garantia do Fornecedor ───────────────────────────────────────────────────
// A Shopee as vezes nao retorna a opcao "Supplier Warranty" no atributo de tipo
// de garantia. Garantimos que ela exista para evitar erro de validacao.

export function ensureWarrantyTypeOptions(attributeId, options) {
    if (!SHOPEE_WARRANTY_TYPE_ATTRIBUTE_IDS.has(attributeId)) return options;

    const hasSupplierWarranty = options.some((option) =>
        option.value_id === SHOPEE_SUPPLIER_WARRANTY_OPTION.value_id ||
        normalizeLookupText(option.raw_name) === 'supplier warranty' ||
        normalizeLookupText(option.original_value_name) === 'supplier warranty'
    );

    if (hasSupplierWarranty) return options;

    return [SHOPEE_SUPPLIER_WARRANTY_OPTION, ...options];
}

// ─── Extracao da arvore de atributos ──────────────────────────────────────────
// A action=attributes (get_attribute_tree) pode responder com formatos diferentes
// dependendo da versao/ambiente da Shopee. Tolerante a todas as variantes conhecidas.

export function extractShopeeAttributeTree(data) {
    if (Array.isArray(data?.response?.attribute_list)) {
        return data.response.attribute_list;
    }

    if (Array.isArray(data?.response?.attribute_tree)) {
        return data.response.attribute_tree;
    }

    if (Array.isArray(data?.response?.list)) {
        const entryWithTree = data.response.list.find((entry) => Array.isArray(entry?.attribute_tree));
        if (entryWithTree?.attribute_tree) {
            return entryWithTree.attribute_tree;
        }
    }

    return [];
}

// ─── Normalizacao para o formato do front ─────────────────────────────────────

export function normalizeShopeeAttributes(data) {
    return extractShopeeAttributeTree(data)
        .map((attr) => {
            const rawInputType = attr?.input_type ?? attr?.attribute_type ?? '';
            const inputTypeText = String(rawInputType).toUpperCase();
            const options = Array.isArray(attr?.attribute_value_list)
                ? attr.attribute_value_list
                    .map((option) => {
                        const label =
                            translateShopeeText(option, ['display_attribute_value', 'display_value_name', 'name', 'original_value_name']) ||
                            String(option?.value_id || '').trim();
                        return {
                            value_id: Number(option?.value_id) || 0,
                            label,
                            raw_name: String(option?.name || option?.display_attribute_value || label).trim(),
                            original_value_name: String(option?.original_value_name || option?.name || option?.display_attribute_value || label).trim(),
                        };
                    })
                    .filter((option) => option.label)
                : [];
            const normalizedOptions = ensureWarrantyTypeOptions(Number(attr?.attribute_id) || 0, options);

            const allowsMultiple =
                inputTypeText.includes('MULTIPLE') ||
                attr?.multiple_select === true ||
                attr?.is_multiple === true ||
                attr?.multiple_enter === true;

            const supportSearchValue = Boolean(attr?.attribute_info?.support_search_value);

            let inputKind;
            if (supportSearchValue) {
                inputKind = 'searchable';
            } else if (normalizedOptions.length > 0) {
                inputKind = allowsMultiple ? 'multiselect' : 'select';
            } else {
                inputKind = 'text';
            }

            return {
                attribute_id: Number(attr?.attribute_id) || 0,
                label:
                    translateShopeeText(attr, ['display_attribute_name', 'name', 'original_attribute_name']) ||
                    `Atributo ${attr?.attribute_id || ''}`.trim(),
                mandatory: Boolean(attr?.mandatory ?? attr?.is_mandatory),
                input_kind: inputKind,
                attribute_value_list: normalizedOptions,
                raw_input_type: rawInputType,
                support_search_value: supportSearchValue,
            };
        })
        .filter((attr) => Number.isFinite(attr.attribute_id) && attr.attribute_id > 0);
}

// ─── Sugestoes de valores ─────────────────────────────────────────────────────
// Reexporta a engine de sugestoes (marca local, modelo do nome, defaults de template)
// para que todos os consumidores usem a mesma logica.

export { buildShopeeTemplateAttributeValues, resolveShopeeFieldTemplate };

/**
 * Monta o objeto { attribute_id: valor } para o JSON de "Atributos Padrao",
 * combinando as sugestoes inteligentes com chaves vazias para os atributos
 * obrigatorios que nao receberam sugestao (para o operador ver o que falta).
 *
 * @param {ShopeeAttributeField[]} attributes - atributos normalizados da categoria
 * @param {{ name?: string, brand?: string, sku?: string, category_slug?: string }} product - produto/modelo de referencia
 * @param {object} [template] - template opcional (ex.: capa de celular)
 * @returns {Record<string, string>} mapa attribute_id -> valor (string ou "")
 */
export function buildShopeeAttributeDefaultsPayload(attributes, product, template) {
    const resolvedTemplate = template ?? resolveShopeeFieldTemplate(product);
    const suggested = buildShopeeTemplateAttributeValues(attributes, product, resolvedTemplate);

    const payload = {};
    for (const attr of attributes || []) {
        const attrId = Number(attr?.attribute_id);
        if (!Number.isFinite(attrId) || attrId <= 0) continue;

        const suggestedValue = suggested[attrId];
        if (typeof suggestedValue === 'string' && suggestedValue.trim()) {
            payload[String(attrId)] = suggestedValue.trim();
            continue;
        }

        // Obrigatorios sem sugestao entram como string vazia para o operador ver o que falta.
        // Opcionais sem sugestao nao entram (evita ruido no JSON).
        if (attr?.mandatory) {
            payload[String(attrId)] = '';
        }
    }

    return payload;
}

/**
 * Conta atributos obrigatorios e quantos ja foram preenchidos, para feedback na UI.
 *
 * @param {ShopeeAttributeField[]} attributes
 * @param {Record<string, string>} payload
 * @returns {{ total: number, mandatory: number, filled: number, mandatoryFilled: number }}
 */
export function summarizeShopeeAttributes(attributes, payload) {
    let total = 0;
    let mandatory = 0;
    let filled = 0;
    let mandatoryFilled = 0;

    for (const attr of attributes || []) {
        total += 1;
        const value = payload?.[String(attr?.attribute_id)];
        const hasValue = typeof value === 'string' && value.trim().length > 0;
        if (attr?.mandatory) {
            mandatory += 1;
            if (hasValue) mandatoryFilled += 1;
        }
        if (hasValue) filled += 1;
    }

    return { total, mandatory, filled, mandatoryFilled };
}
