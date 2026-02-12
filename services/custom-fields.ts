import { supabase } from './supabase';

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

/**
 * Custom Fields Service
 * Manages custom field definitions stored in Supabase
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Database-First Architecture
 * - All field definitions stored in Supabase
 * - No local config files for business data
 */
class CustomFieldsService {
    private cache: CustomField[] | null = null;
    private cacheTimestamp: number = 0;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Get company ID from auth context or first company
     */
    private async getCompanyId(): Promise<string> {
        // Try to get from authenticated user first
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            // Get user's company_id from profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', user.id)
                .single();

            if (profile?.company_id) {
                return profile.company_id;
            }
        }

        // Fallback: Get first company (for development/testing)
        const { data: companies } = await supabase
            .from('companies')
            .select('id')
            .limit(1);

        if (!companies || companies.length === 0) {
            throw new Error('No company found. Please create a company first.');
        }

        return companies[0].id;
    }

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

        const companyId = await this.getCompanyId();
        console.log('🔍 [CustomFieldsService] Using company_id:', companyId);

        const { data, error } = await supabase
            .from('custom_fields')
            .select('*')
            .eq('company_id', companyId)
            .order('display_order', { ascending: true });

        if (error) {
            console.error('❌ [CustomFieldsService] Error loading custom fields:', error);
            throw error;
        }

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
        const { data, error } = await supabase
            .from('custom_fields')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error loading custom field:', error);
            return null;
        }

        return data;
    }

    /**
     * Get a field by key
     */
    async getByKey(key: string): Promise<CustomField | null> {
        const companyId = await this.getCompanyId();

        const { data, error } = await supabase
            .from('custom_fields')
            .select('*')
            .eq('company_id', companyId)
            .eq('key', key)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Not found
                return null;
            }
            console.error('Error loading custom field:', error);
            throw error;
        }

        return data;
    }

    /**
     * Create a new custom field
     */
    async create(input: CustomFieldInput): Promise<CustomField> {
        const companyId = await this.getCompanyId();

        // Check if key already exists
        const existing = await this.getByKey(input.key);
        if (existing) {
            throw new Error(`Field with key "${input.key}" already exists`);
        }

        const { data, error } = await supabase
            .from('custom_fields')
            .insert({
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
                is_system: false
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating custom field:', error);
            throw error;
        }

        // Clear cache
        this.clearCache();

        return data;
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

            const { data, error } = await supabase
                .from('custom_fields')
                .update({
                    label: input.label,
                    placeholder: input.placeholder,
                    help_text: input.help_text,
                    options: input.options,
                    display_order: input.display_order,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error updating system field:', error);
                throw error;
            }

            // Clear cache
            this.clearCache();

            return data;
        }

        // Non-system fields: allow full update
        const { data, error } = await supabase
            .from('custom_fields')
            .update({
                label: input.label,
                category: input.category,
                field_type: input.field_type,
                options: input.options,
                validation: input.validation,
                placeholder: input.placeholder,
                help_text: input.help_text,
                table_config: input.table_config,
                display_order: input.display_order,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating custom field:', error);
            throw error;
        }

        // Clear cache
        this.clearCache();

        return data;
    }

    /**
     * Delete a custom field (only non-system fields)
     * Delete a custom field (system fields cannot be deleted)
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('custom_fields')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting custom field:', error);
            throw error;
        }

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
            await supabase
                .from('custom_fields')
                .update({ display_order: update.display_order })
                .eq('id', update.id);
        }

        // Clear cache
        this.clearCache();
    }
}

export const customFieldsService = new CustomFieldsService();
