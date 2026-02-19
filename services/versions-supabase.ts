
import { Version, VersionInput } from '../types/version';
import { supabase } from './supabase';

/**
 * VERSION SERVICE - Supabase Implementation
 *
 * Replaces the legacy versions.ts (localStorage).
 * The `versions` table has: id, company_id, name, created_at
 * Fields `slug` and `active` are derived in memory for type compatibility.
 */

const COMPANY_SLUG = 'mercado-do-vale';

function toSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function getCompanyId(): Promise<string> {
    const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', COMPANY_SLUG)
        .single();

    if (error) throw new Error(`Failed to get company: ${error.message}`);
    return data.id;
}

function mapRow(row: { id: string; name: string; created_at: string }): Version {
    return {
        id: row.id,
        name: row.name,
        slug: toSlug(row.name),
        active: true,
        created: row.created_at,
        updated: row.created_at,
    };
}

async function list(): Promise<Version[]> {
    const companyId = await getCompanyId();
    const { data, error } = await supabase
        .from('versions')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

    if (error) throw new Error(`Failed to fetch versions: ${error.message}`);
    return (data || []).map(mapRow);
}

async function getById(id: string): Promise<Version | null> {
    const { data, error } = await supabase
        .from('versions')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch version: ${error.message}`);
    }
    return mapRow(data);
}

async function create(input: VersionInput): Promise<Version> {
    const companyId = await getCompanyId();
    const { data, error } = await supabase
        .from('versions')
        .insert({ company_id: companyId, name: input.name })
        .select()
        .single();

    if (error) throw new Error(`Failed to create version: ${error.message}`);
    return mapRow(data);
}

async function update(id: string, input: VersionInput): Promise<Version> {
    const { data, error } = await supabase
        .from('versions')
        .update({ name: input.name })
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(`Failed to update version: ${error.message}`);
    return mapRow(data);
}

async function deleteVersion(id: string): Promise<void> {
    const { error } = await supabase
        .from('versions')
        .delete()
        .eq('id', id);

    if (error) throw new Error(`Failed to delete version: ${error.message}`);
}

async function listActive(): Promise<Version[]> {
    return list();
}

export const versionService = {
    list,
    getById,
    create,
    update,
    delete: deleteVersion,
    listActive,
};
