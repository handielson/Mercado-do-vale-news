import { supabase } from './supabase';
import { Customer, CustomerInput, CustomerFilters } from '../types/customer';

/**
 * Customer Service
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Database-First Architecture
 * - All customer data stored in Supabase
 * - Cache management for performance
 * - RLS policies enforce security
 */

// Temporary company ID for development
const TEMP_COMPANY_ID = 'mercado-do-vale';

class CustomerService {
    private cache: Customer[] | null = null;
    private cacheTimestamp: number = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    /**
     * Get company ID from authenticated user or fallback to temp company
     */
    private async getCompanyId(): Promise<string> {
        const { data, error } = await supabase
            .from('companies')
            .select('id')
            .eq('slug', TEMP_COMPANY_ID)
            .single();

        if (error) throw new Error(`Failed to get company: ${error.message}`);
        return data.id;
    }

    /**
     * Check if cache is valid
     */
    private isCacheValid(): boolean {
        return this.cache !== null &&
            (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache = null;
        this.cacheTimestamp = 0;
    }

    /**
     * List all customers with optional filters
     */
    async list(filters?: CustomerFilters): Promise<Customer[]> {
        const companyId = await this.getCompanyId();

        let query = supabase
            .from('customers')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        // Apply filters
        if (filters?.search) {
            query = query.or(`name.ilike.%${filters.search}%,cpf_cnpj.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
        }

        if (filters?.is_active !== undefined) {
            query = query.eq('is_active', filters.is_active);
        }

        if (filters?.created_after) {
            query = query.gte('created_at', filters.created_after);
        }

        if (filters?.created_before) {
            query = query.lte('created_at', filters.created_before);
        }

        const { data, error } = await query;
        if (error) throw error;

        this.cache = data;
        this.cacheTimestamp = Date.now();

        return data;
    }

    /**
     * Get customer by ID
     */
    async getById(id: string): Promise<Customer | null> {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }

        return data;
    }

    /**
     * Get customer by CPF/CNPJ
     */
    async getByCpfCnpj(cpfCnpj: string): Promise<Customer | null> {
        const companyId = await this.getCompanyId();

        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('company_id', companyId)
            .eq('cpf_cnpj', cpfCnpj)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }

        return data;
    }

    /**
     * Create new customer
     */
    async create(input: CustomerInput): Promise<Customer> {
        const companyId = await this.getCompanyId();

        const { data, error } = await supabase
            .from('customers')
            .insert({
                company_id: companyId,
                ...input
            })
            .select()
            .single();

        if (error) throw error;

        this.clearCache();
        return data;
    }

    /**
     * Update existing customer
     */
    async update(id: string, input: Partial<CustomerInput>): Promise<Customer> {
        const { data, error } = await supabase
            .from('customers')
            .update(input)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        this.clearCache();
        return data;
    }

    /**
     * Delete customer (soft delete by setting is_active = false)
     */
    async softDelete(id: string): Promise<void> {
        await this.update(id, { is_active: false });
    }

    /**
     * Delete customer (hard delete from database)
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) throw error;
        this.clearCache();
    }

    /**
     * Search customers by name
     */
    async search(query: string): Promise<Customer[]> {
        return this.list({ search: query });
    }

    /**
     * Get active customers count
     */
    async getActiveCount(): Promise<number> {
        const companyId = await this.getCompanyId();

        const { count, error } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('is_active', true);

        if (error) throw error;
        return count || 0;
    }
}

export const customerService = new CustomerService();
