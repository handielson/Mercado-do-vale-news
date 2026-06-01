import { vpsClient } from './vpsClient';
import { TeamMember, TeamMemberInput, TeamMemberFilters } from '../types/team';

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

function matchesSearch(member: TeamMember, search: string): boolean {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [member.name, member.cpf_cnpj, member.email]
        .some(value => (value || '').toLowerCase().includes(term));
}

/**
 * Team Member Service
 *
 * Team member operational data is loaded through the VPS table-data bridge.
 * Cache management is kept for admin screens that repeatedly list the team.
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

    private async loadTeamMembers(pageSize = 200): Promise<TeamMember[]> {
        if (this.isCacheValid() && this.cache) return this.cache;

        let offset = 0;
        const rows: TeamMember[] = [];

        while (true) {
            const response = await vpsClient.get<TableDataResponse<TeamMember>>(
                `/table-data/team_members?limit=${pageSize}&offset=${offset}`
            );
            const batch = extractRows(response);
            rows.push(...batch);
            if (batch.length < pageSize) break;
            offset += pageSize;
        }

        this.cache = rows;
        this.cacheTimestamp = Date.now();
        return rows;
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
        return (await this.loadTeamMembers())
            .filter(member => !filters?.search || matchesSearch(member, filters.search))
            .filter(member => !filters?.role || member.role === filters.role)
            .filter(member => !filters?.employment_type || member.employment_type === filters.employment_type)
            .filter(member => filters?.is_active === undefined || member.is_active === filters.is_active)
            .filter(member => !filters?.created_after || member.created_at >= filters.created_after)
            .filter(member => !filters?.created_before || member.created_at <= filters.created_before)
            .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    /**
     * Get team member by ID
     */
    async getById(id: string): Promise<TeamMember | null> {
        const member = (await this.loadTeamMembers()).find(item => item.id === id);
        return member || null;
    }

    /**
     * Get team member by CPF/CNPJ
     */
    async getByCpfCnpj(cpfCnpj: string): Promise<TeamMember | null> {
        const member = (await this.loadTeamMembers()).find(item => item.cpf_cnpj === cpfCnpj);
        return member || null;
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
        const data = await vpsClient.post<TeamMember>('/table-data/team_members', input);
        this.clearCache();
        return data;
    }

    /**
     * Create delivery member from PDV through VPS.
     */
    async createDeliveryFromPdv(input: TeamMemberInput): Promise<TeamMember> {
        const data = await vpsClient.post<TeamMember>('/team/delivery', input);
        this.clearCache();
        return data;
    }

    /**
     * Update existing team member
     */
    async update(id: string, input: Partial<TeamMemberInput>): Promise<TeamMember> {
        const data = await vpsClient.patch<TeamMember>(`/table-data/team_members/${id}`, input);
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
        await vpsClient.delete(`/table-data/team_members/${id}`);
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
        return (await this.loadTeamMembers()).filter(member => member.is_active).length;
    }
}

export const teamService = new TeamService();
