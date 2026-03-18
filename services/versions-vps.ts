import { Version, VersionInput } from '../types/version';
import { vpsClient } from './vpsClient';

/**
 * VERSION SERVICE — VPS MySQL
 * Substitui versions.ts (localStorage) e versions-supabase.ts (Supabase).
 * Backend: tabela `versions` no MySQL da VPS.
 */

function toSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

interface VpsVersionRow {
    id: string;
    name: string;
    active: number | boolean;
    created_at: string;
}

function mapRow(row: VpsVersionRow): Version {
    return {
        id: row.id,
        name: row.name,
        slug: toSlug(row.name),
        active: Boolean(row.active),
        created: row.created_at,
        updated: row.created_at,
    };
}

export const versionService = {
    async list(): Promise<Version[]> {
        const rows = await vpsClient.get<VpsVersionRow[]>('/versions');
        return (rows || []).map(mapRow);
    },

    async getById(id: string): Promise<Version | null> {
        try {
            const row = await vpsClient.get<VpsVersionRow>(`/versions/${id}`);
            return row ? mapRow(row) : null;
        } catch {
            return null;
        }
    },

    async create(input: VersionInput): Promise<Version> {
        const row = await vpsClient.post<VpsVersionRow>('/versions', {
            name: input.name,
            active: input.active !== undefined ? input.active : true,
        });
        return mapRow(row);
    },

    async update(id: string, input: VersionInput): Promise<Version> {
        const row = await vpsClient.patch<VpsVersionRow>(`/versions/${id}`, {
            name: input.name,
            active: input.active,
        });
        return mapRow(row);
    },

    async delete(id: string): Promise<void> {
        await vpsClient.delete(`/versions/${id}`);
    },

    async listActive(): Promise<Version[]> {
        const rows = await vpsClient.get<VpsVersionRow[]>('/versions?active=1');
        return (rows || []).map(mapRow);
    },
};
