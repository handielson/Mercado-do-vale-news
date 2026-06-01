import { getCompanyId } from './companyContext';
import { vpsClient } from './vpsClient';

export const FORMAT_OPTIONS = [
    // Tipos de Texto
    { value: 'none', label: '📝 Texto Livre (Sem formatação)', color: 'bg-slate-100 text-slate-800' },
    { value: 'capitalize', label: '📝 Capitalize (Primeira maiúscula)', color: 'bg-blue-100 text-blue-800' },
    { value: 'uppercase', label: '📝 UPPERCASE (Tudo maiúsculo)', color: 'bg-purple-100 text-purple-800' },
    { value: 'lowercase', label: '📝 lowercase (Tudo minúsculo)', color: 'bg-green-100 text-green-800' },
    { value: 'titlecase', label: '📝 Title Case (Iniciais maiúsculas)', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'sentence', label: '📝 Sentence case (Início de frase)', color: 'bg-cyan-100 text-cyan-800' },
    { value: 'slug', label: '🔗 slug-case (URL amigável)', color: 'bg-teal-100 text-teal-800' },

    // Componentes e Seletores
    { value: 'select', label: '🎯 Seletor (Lista Dropdown)', color: 'bg-fuchsia-100 text-fuchsia-800' },
    { value: 'checkbox', label: '☑️ Checkbox (Sim/Não)', color: 'bg-sky-100 text-sky-800' },
    { value: 'textarea', label: '📄 Área de Texto (Texto Longo)', color: 'bg-slate-100 text-slate-800' },

    // Formatadores Específicos
    { value: 'numeric', label: '🔢 Numérico (Apenas números)', color: 'bg-lime-100 text-lime-800' },
    { value: 'alphanumeric', label: '🔤 Alfanumérico (Sem especiais)', color: 'bg-sky-100 text-sky-800' },
    { value: 'phone', label: '📱 Telefone', color: 'bg-orange-100 text-orange-800' },
    { value: 'cpf', label: '📋 CPF', color: 'bg-rose-100 text-rose-800' },
    { value: 'cnpj', label: '📋 CNPJ', color: 'bg-pink-100 text-pink-800' },
    { value: 'cep', label: '📮 CEP', color: 'bg-amber-100 text-amber-800' },
    { value: 'brl', label: '💰 R$ (Real - Para campos textuais)', color: 'bg-emerald-100 text-emerald-800' },

    // Datas
    { value: 'date_br', label: '📅 DD/MM/YYYY', color: 'bg-blue-100 text-blue-800' },
    { value: 'date_br_short', label: '📅 DD/MM/YY', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'date_iso', label: '📅 YYYY-MM-DD', color: 'bg-cyan-100 text-cyan-800' },

    // Componentes Nativos (Evitar usar como Formatação simples, mas disponíveis)
    { value: 'currency', label: '💰 Componente Valor Monetário', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'imei', label: '📱 Componente IMEI', color: 'bg-violet-100 text-violet-800' },

    // Fiscais
    { value: 'ncm', label: '📋 NCM (8 dígitos)', color: 'bg-slate-100 text-slate-800' },
    { value: 'ean13', label: '📋 EAN-13 (13 dígitos)', color: 'bg-gray-100 text-gray-800' },
    { value: 'cest', label: '📋 CEST (7 dígitos)', color: 'bg-zinc-100 text-zinc-800' },
];

export interface TableConfig {
    table_name: string;
    value_column: string;
    label_column: string;
    order_by?: string;
}

export interface CustomField {
    id: string;
    company_id: string;
    key: string;
    label: string;
    category: 'basic' | 'spec' | 'price' | 'fiscal' | 'logistics';
    field_type:
    | 'text' | 'textarea' | 'capitalize' | 'uppercase' | 'lowercase' | 'titlecase' | 'sentence' | 'slug'
    | 'number' | 'numeric' | 'alphanumeric' | 'phone' | 'cpf' | 'cnpj' | 'cep'
    | 'date_br' | 'date_br_short' | 'date_iso'
    | 'ncm' | 'ean13' | 'cest'
    | 'brl' | 'select' | 'checkbox'
    | 'table_relation';
    options?: string[];
    validation?: Record<string, any>;
    placeholder?: string;
    help_text?: string;
    table_config?: TableConfig;
    is_system: boolean;
    display_order: number;
    created_at: string;
    updated_at: string;
}

export interface CustomFieldInput {
    key: string;
    label: string;
    category: 'basic' | 'spec' | 'price' | 'fiscal' | 'logistics';
    field_type?:
    | 'text' | 'textarea' | 'capitalize' | 'uppercase' | 'lowercase' | 'titlecase' | 'sentence' | 'slug'
    | 'number' | 'numeric' | 'alphanumeric' | 'phone' | 'cpf' | 'cnpj' | 'cep'
    | 'date_br' | 'date_br_short' | 'date_iso'
    | 'ncm' | 'ean13' | 'cest'
    | 'brl' | 'select' | 'checkbox'
    | 'table_relation';
    options?: string[];
    validation?: Record<string, any>;
    placeholder?: string;
    help_text?: string;
    table_config?: TableConfig;
    display_order?: number;
}

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

function parseJsonField<T>(value: unknown, fallback: T): T {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value as T;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function normalizeOptionList(value: unknown): string[] {
    const parsed = parseJsonField<unknown>(value, []);
    const rawOptions = Array.isArray(parsed) ? parsed : [parsed];

    return rawOptions
        .flatMap((option) => {
            const text = String(option ?? '').trim();
            if (!text) return [];
            if (!/[\\\n\r]|\\n|\\r/.test(text)) return [text];
            return text
                .replace(/\\r\\n|\\n|\\r/g, '\n')
                .split(/[\\\n\r]+/)
                .map(part => part.trim())
                .filter(Boolean);
        })
        .filter((option, index, list) => list.findIndex(item => item.toLowerCase() === option.toLowerCase()) === index);
}

function normalizeField(row: CustomField): CustomField {
    return {
        ...row,
        options: normalizeOptionList(row.options),
        validation: parseJsonField<Record<string, any>>(row.validation, {}),
        table_config: parseJsonField<TableConfig | undefined>(row.table_config, undefined),
        is_system: Boolean(row.is_system),
        display_order: Number(row.display_order ?? 999),
    };
}

async function loadCustomFields(pageSize = 200): Promise<CustomField[]> {
    let offset = 0;
    const rows: CustomField[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<CustomField>>(
            `/table-data/custom_fields?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response).map(normalizeField);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

function orderFields(fields: CustomField[]): CustomField[] {
    return [...fields].sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999) || a.label.localeCompare(b.label));
}

function buildCreatePayload(companyId: string, input: CustomFieldInput): Record<string, unknown> {
    return {
        company_id: companyId,
        key: input.key,
        label: input.label,
        category: input.category,
        field_type: input.field_type || 'text',
        options: input.options || [],
        validation: input.validation || {},
        placeholder: input.placeholder || null,
        help_text: input.help_text || null,
        table_config: input.table_config || null,
        display_order: input.display_order || 999,
        is_system: false,
    };
}

function buildUpdatePayload(input: Partial<CustomFieldInput>, systemField = false): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        label: input.label,
        options: input.options,
        placeholder: input.placeholder,
        help_text: input.help_text,
        display_order: input.display_order,
        updated_at: new Date().toISOString(),
    };

    if (!systemField) {
        payload.category = input.category;
        payload.field_type = input.field_type;
        payload.validation = input.validation;
        payload.table_config = input.table_config;
    }

    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

/**
 * Custom Fields Service
 * Manages custom field definitions stored in the VPS/MySQL table-data layer.
 */
class CustomFieldsService {
    private cache: CustomField[] | null = null;
    private cacheTimestamp: number = 0;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Check if cache is valid
     */
    private isCacheValid(): boolean {
        return this.cache !== null && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL;
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache = null;
        this.cacheTimestamp = 0;
    }

    /**
     * List all custom fields for the current company
     */
    async list(): Promise<CustomField[]> {
        // Return cached data if valid
        if (this.isCacheValid() && this.cache) {
            console.log('🔍 [CustomFieldsService] Returning cached data:', this.cache.length, 'fields');
            return this.cache;
        }

        const companyId = await getCompanyId();
        console.log('🔍 [CustomFieldsService] Using company_id:', companyId);

        const data = orderFields((await loadCustomFields()).filter(field => field.company_id === companyId));

        console.log('✅ [CustomFieldsService] Loaded fields:', data?.length || 0);
        console.log('🔍 [CustomFieldsService] Fields:', data);

        // Update cache
        this.cache = data || [];
        this.cacheTimestamp = Date.now();

        return data || [];
    }

    /**
     * Get fields by category
     */
    async getByCategory(category: CustomField['category']): Promise<CustomField[]> {
        const fields = await this.list();
        return fields.filter(f => f.category === category);
    }

    /**
     * Get a single custom field by ID
     */
    async getById(id: string): Promise<CustomField | null> {
        const field = (await loadCustomFields()).find(item => item.id === id);
        return field || null;
    }

    /**
     * Get a field by key
     */
    async getByKey(key: string): Promise<CustomField | null> {
        const companyId = await getCompanyId();
        return (await loadCustomFields()).find(field => field.company_id === companyId && field.key === key) || null;
    }

    /**
     * Create a new custom field
     */
    async create(input: CustomFieldInput): Promise<CustomField> {
        const companyId = await getCompanyId();

        // Check if key already exists
        const existing = await this.getByKey(input.key);
        if (existing) {
            throw new Error(`Field with key "${input.key}" already exists`);
        }

        const data = await vpsClient.post<CustomField>('/table-data/custom_fields', buildCreatePayload(companyId, input));

        // Clear cache
        this.clearCache();

        return normalizeField(data);
    }

    /**
     * Update an existing custom field
     * System fields can only update: label, placeholder, help_text, options, display_order
     * System fields CANNOT update: key, field_type, category, table_config
     */
    async update(id: string, input: Partial<CustomFieldInput>): Promise<CustomField> {
        // Check if field is system field
        const field = await this.getById(id);

        if (field?.is_system) {
            // System fields: only allow updating non-structural fields
            console.log('⚠️ [CustomFieldsService] Updating system field (limited):', field.key);

            const data = await vpsClient.patch<CustomField>(
                `/table-data/custom_fields/${id}`,
                buildUpdatePayload(input, true)
            );

            // Clear cache
            this.clearCache();

            return normalizeField(data);
        }

        // Non-system fields: allow full update
        const data = await vpsClient.patch<CustomField>(
            `/table-data/custom_fields/${id}`,
            buildUpdatePayload(input, false)
        );

        // Clear cache
        this.clearCache();

        return normalizeField(data);
    }

    /**
     * Delete a custom field (only non-system fields)
     * Delete a custom field (system fields cannot be deleted)
     */
    async delete(id: string): Promise<void> {
        await vpsClient.delete(`/table-data/custom_fields/${id}`);

        // Clear cache to force refresh
        this.cache = null;
        this.cacheTimestamp = 0;
    }

    /**
     * Reorder fields
     */
    async reorder(fieldIds: string[]): Promise<void> {
        const updates = fieldIds.map((id, index) => ({
            id,
            display_order: index
        }));

        for (const update of updates) {
            await vpsClient.patch<CustomField>(`/table-data/custom_fields/${update.id}`, {
                display_order: update.display_order,
                updated_at: new Date().toISOString(),
            });
        }

        // Clear cache
        this.clearCache();
    }
}

export const customFieldsService = new CustomFieldsService();
