import { supabase } from './supabase';
import { TeamMember, TeamMemberInput, TeamMemberFilters } from '../types/team';

/**
 * Team Member Service
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Database-First Architecture
 * - All team member data stored in Supabase
 * - Cache management for performance
 */

class TeamService {
    private cache: TeamMember[] | null = null;
    private cacheTimestamp: number = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
     * List all team members with optional filters
     */
    async list(filters?: TeamMemberFilters): Promise<TeamMember[]> {
        let query = supabase
            .from('team_members')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply filters
        if (filters?.search) {
            query = query.or(`name.ilike.%${filters.search}%,cpf_cnpj.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
        }

        if (filters?.role) {
            query = query.eq('role', filters.role);
        }

        if (filters?.employment_type) {
            query = query.eq('employment_type', filters.employment_type);
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
     * Get team member by ID
     */
    async getById(id: string): Promise<TeamMember | null> {
        const { data, error } = await supabase
            .from('team_members')
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
     * Get team member by CPF/CNPJ
     */
    async getByCpfCnpj(cpfCnpj: string): Promise<TeamMember | null> {
        const { data, error } = await supabase
            .from('team_members')
            .select('*')
            .eq('cpf_cnpj', cpfCnpj)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }

        return data;
    }

    /**
     * Get team members by role
     */
    async getByRole(role: string): Promise<TeamMember[]> {
        return this.list({ role: role as any });
    }

    /**
     * Create new team member
     */
    async create(input: TeamMemberInput): Promise<TeamMember> {
        const { data, error } = await supabase
            .from('team_members')
            .insert(input)
            .select()
            .single();

        if (error) throw error;

        this.clearCache();
        return data;
    }

    /**
     * Update existing team member
     */
    async update(id: string, input: Partial<TeamMemberInput>): Promise<TeamMember> {
        const { data, error } = await supabase
            .from('team_members')
            .update(input)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        this.clearCache();
        return data;
    }

    /**
     * Delete team member (soft delete by setting is_active = false)
     */
    async softDelete(id: string): Promise<void> {
        await this.update(id, { is_active: false });
    }

    /**
     * Delete team member (hard delete from database)
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('team_members')
            .delete()
            .eq('id', id);

        if (error) throw error;
        this.clearCache();
    }

    /**
     * Search team members by name
     */
    async search(query: string): Promise<TeamMember[]> {
        return this.list({ search: query });
    }

    /**
     * Get active team members count
     */
    async getActiveCount(): Promise<number> {
        const { count, error } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        if (error) throw error;
        return count || 0;
    }
}

export const teamService = new TeamService();
