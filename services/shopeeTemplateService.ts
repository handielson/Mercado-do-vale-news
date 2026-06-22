import type { ShopeeTemplate, ShopeeTemplateInput } from '../types/shopee-template';
import { getCompanyId } from './companyContext';
import { vpsClient } from './vpsClient';

const CACHE_KEY = 'shopee_templates_cache_v1';

function nowIso(): string {
    return new Date().toISOString();
}

function makeId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    return `template-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const DEFAULT_SHOPEE_TEMPLATES: ShopeeTemplate[] = [
    {
        id: 'universal_defaults',
        name: 'Defaults universais',
        active: true,
        priority: 10000,
        rules: {},
        titleTemplate: '{nome}',
        descriptionTemplate: '',
        shopeeCategoryId: null,
        shopeeCategoryName: 'Todas as categorias',
        attributeDefaults: {
            100121: '3 meses',
            100370: 'Garantia do fornecedor',
            100999: '1',
            100413: 'Novo',
            101219: 'Não',
            101639: '{sku}',
            101029: '{package_dimensions}',
        },
        priceMode: 'product',
        stockMode: 'product',
        dimensionMode: 'product',
        gtinMode: 'product',
        dangerousTerms: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
    },
    {
        id: 'phone_case',
        name: 'Capa de celular',
        active: true,
        priority: 100,
        rules: {
            nameIncludes: ['capa', 'capinha', 'case'],
            skuIncludes: ['capa', 'case'],
        },
        titleTemplate: 'Capa compativel com {modelo} Cor:{cor}',
        descriptionTemplate: '{nome}\n\nProduto compativel. Confira o modelo antes da compra.',
        shopeeCategoryId: 100490,
        shopeeCategoryName: 'Capas',
        attributeDefaults: {
            100121: '3 Months',
            100134: 'TPU',
            100370: 'Supplier Warranty',
        },
        priceMode: 'product',
        stockMode: 'product',
        dimensionMode: 'product',
        gtinMode: 'no_gtin',
        dangerousTerms: [
            {
                id: 'phone-case-iphone',
                term: 'Capa para iPhone',
                replacement: 'Capa compativel com iPhone',
                level: 'warning',
                active: true,
                note: 'Evita expressao que costuma derrubar anuncio.',
            },
            {
                id: 'generic-original',
                term: 'Original',
                replacement: '',
                level: 'block',
                active: true,
                note: 'Use somente se houver autorizacao e comprovacao da marca.',
            },
            {
                id: 'generic-oficial',
                term: 'Oficial',
                replacement: '',
                level: 'block',
                active: true,
                note: 'Termo sensivel para marketplace.',
            },
        ],
        createdAt: nowIso(),
        updatedAt: nowIso(),
    },
];

const REQUIRED_DEFAULT_TEMPLATE_IDS = new Set(['universal_defaults']);

function sortTemplates(templates: ShopeeTemplate[]): ShopeeTemplate[] {
    return [...templates].sort((a, b) => {
        const priorityDiff = Number(b.priority || 0) - Number(a.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });
}

function ensureRequiredDefaultTemplates(templates: ShopeeTemplate[]): ShopeeTemplate[] {
    const currentIds = new Set((templates || []).map((template) => String(template.id)));
    const missingDefaults = DEFAULT_SHOPEE_TEMPLATES.filter((template) =>
        REQUIRED_DEFAULT_TEMPLATE_IDS.has(String(template.id)) && !currentIds.has(String(template.id))
    );
    return missingDefaults.length > 0 ? sortTemplates([...missingDefaults, ...templates]) : templates;
}

interface TableDataResponse {
    rows?: any[];
}

function parseObject(value: unknown): Record<string, any> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }
    return {};
}

function parseArray(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function mapFromRow(row: any): ShopeeTemplate {
    return {
        id: row.id,
        name: row.name,
        active: Boolean(row.active),
        priority: Number(row.priority || 0),
        rules: parseObject(row.rules),
        titleTemplate: row.title_template || '',
        descriptionTemplate: row.description_template || '',
        shopeeCategoryId: row.shopee_category_id ?? null,
        shopeeCategoryName: row.shopee_category_name ?? null,
        attributeDefaults: parseObject(row.attribute_defaults),
        priceMode: row.price_mode || 'product',
        fixedPrice: row.fixed_price ?? null,
        pricePercent: row.price_percent ?? null,
        stockMode: row.stock_mode || 'product',
        fixedStock: row.fixed_stock ?? null,
        dimensionMode: row.dimension_mode || 'product',
        weightKg: row.weight_kg ?? null,
        packageLength: row.package_length ?? null,
        packageWidth: row.package_width ?? null,
        packageHeight: row.package_height ?? null,
        gtinMode: row.gtin_mode || 'product',
        dangerousTerms: parseArray(row.dangerous_terms),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapToRow(input: ShopeeTemplateInput, companyId?: string | null): Record<string, any> {
    return {
        ...(input.id ? { id: input.id } : {}),
        ...(companyId ? { company_id: companyId } : {}),
        name: input.name,
        active: input.active,
        priority: input.priority,
        rules: input.rules || {},
        title_template: input.titleTemplate || '',
        description_template: input.descriptionTemplate || '',
        shopee_category_id: input.shopeeCategoryId || null,
        shopee_category_name: input.shopeeCategoryName || null,
        attribute_defaults: input.attributeDefaults || {},
        price_mode: input.priceMode || 'product',
        fixed_price: input.fixedPrice || null,
        price_percent: input.pricePercent || null,
        stock_mode: input.stockMode || 'product',
        fixed_stock: input.fixedStock ?? null,
        dimension_mode: input.dimensionMode || 'product',
        weight_kg: input.weightKg || null,
        package_length: input.packageLength || null,
        package_width: input.packageWidth || null,
        package_height: input.packageHeight || null,
        gtin_mode: input.gtinMode || 'product',
        dangerous_terms: input.dangerousTerms || [],
        updated_at: nowIso(),
    };
}

function loadFallback(): ShopeeTemplate[] {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return DEFAULT_SHOPEE_TEMPLATES;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? ensureRequiredDefaultTemplates(parsed) : DEFAULT_SHOPEE_TEMPLATES;
    } catch {
        return DEFAULT_SHOPEE_TEMPLATES;
    }
}

function saveFallback(templates: ShopeeTemplate[]): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(templates));
    } catch {
        // localStorage can be unavailable or full.
    }
}

async function loadRows(companyId?: string | null): Promise<any[]> {
    const allRows: any[] = [];
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse>(
            `/table-data/shopee_templates?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return allRows
        .filter(row => includeCompanyTemplateRow(row, companyId))
        .sort((a, b) => {
            const priorityDiff = Number(b.priority || 0) - Number(a.priority || 0);
            if (priorityDiff !== 0) return priorityDiff;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
}

function includeCompanyTemplateRow(row: any, companyId?: string | null): boolean {
    if (!companyId) return true;
    const rowCompanyId = String(row?.company_id || '').trim();
    return !rowCompanyId || rowCompanyId === String(companyId);
}

async function list(): Promise<ShopeeTemplate[]> {
    try {
        const companyId = await getCompanyId().catch(() => null);
        const templates = (await loadRows(companyId)).map(mapFromRow);
        if (templates.length > 0) {
            const templatesWithRequiredDefaults = ensureRequiredDefaultTemplates(templates);
            saveFallback(templatesWithRequiredDefaults);
            return templatesWithRequiredDefaults;
        }

        return seedDefaultsIfEmpty();
    } catch (error) {
        console.warn('[shopeeTemplateService] using fallback templates:', error);
        return loadFallback();
    }
}

async function create(input: ShopeeTemplateInput): Promise<ShopeeTemplate> {
    const companyId = await getCompanyId().catch(() => null);
    const fallbackTemplate: ShopeeTemplate = {
        ...input,
        id: input.id || makeId(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };

    try {
        const data = await vpsClient.post<any>('/table-data/shopee_templates', mapToRow(input, companyId));
        return mapFromRow(data);
    } catch (error) {
        const templates = [...loadFallback(), fallbackTemplate];
        saveFallback(templates);
        return fallbackTemplate;
    }
}

async function update(id: string, input: ShopeeTemplateInput): Promise<ShopeeTemplate> {
    const companyId = await getCompanyId().catch(() => null);
    const fallbackTemplate: ShopeeTemplate = {
        ...input,
        id,
        updatedAt: nowIso(),
    };

    try {
        const data = await vpsClient.patch<any>(
            `/table-data/shopee_templates/${encodeURIComponent(id)}?pk=id`,
            mapToRow(input, companyId)
        );
        return mapFromRow(data);
    } catch (error) {
        const templates = loadFallback().map((template) => template.id === id ? fallbackTemplate : template);
        saveFallback(templates);
        return fallbackTemplate;
    }
}

async function remove(id: string): Promise<void> {
    try {
        await vpsClient.delete(`/table-data/shopee_templates/${encodeURIComponent(id)}?pk=id`);
    } catch (error) {
        // Fallback below keeps local cache in sync even when table is missing.
    }

    saveFallback(loadFallback().filter((template) => template.id !== id));
}

async function seedDefaultsIfEmpty(): Promise<ShopeeTemplate[]> {
    const existing = loadFallback();
    if (existing.length > 0 && existing !== DEFAULT_SHOPEE_TEMPLATES) return existing;

    saveFallback(DEFAULT_SHOPEE_TEMPLATES);

    try {
        const companyId = await getCompanyId().catch(() => null);
        if (!companyId) return DEFAULT_SHOPEE_TEMPLATES;

        const rows = await loadRows(companyId);
        for (const template of DEFAULT_SHOPEE_TEMPLATES) {
            const existing = rows.find(row => String(row.id) === String(template.id));
            const rowData = mapToRow(template, companyId);
            if (existing) {
                await vpsClient.patch(
                    `/table-data/shopee_templates/${encodeURIComponent(template.id)}?pk=id`,
                    rowData
                );
            } else {
                await vpsClient.post('/table-data/shopee_templates', rowData);
            }
        }
    } catch {
        // SQL may not have been applied yet.
    }

    return DEFAULT_SHOPEE_TEMPLATES;
}

export const shopeeTemplateService = {
    list,
    create,
    update,
    remove,
    seedDefaultsIfEmpty,
};
