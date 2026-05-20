import { Brand, BrandInput } from '../types/brand';
import { supabase } from './supabase';
import { vpsApiService } from './vpsApiService';
import { getCompanyId } from './companyContext';
import { USE_VPS } from '../config/migration';

/**
 * BRAND SERVICE - Supabase Implementation
 * Multi-tenant service with Row Level Security
 */

/**
 * Generate URL-friendly slug from brand name
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function mapRow(row: any): Brand {
    const activeValue = row.active;
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        active: activeValue === undefined || activeValue === null ? true : activeValue !== false && activeValue !== 0 && activeValue !== '0',
        logo_url: row.logo_url || undefined,
        warranty_days: row.warranty_days || 90,
        created: row.created_at || '',
        updated: row.updated_at || row.created_at || ''
    };
}

/**
 * List all brands
 */
async function list(): Promise<Brand[]> {
    if (USE_VPS.brands) {
        const rows = await vpsApiService.getBrands();
        if (!rows) throw new Error('Falha ao carregar marcas da VPS');
        return rows.map(mapRow);
    }

    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

    if (error) throw new Error(`Failed to fetch brands: ${error.message}`);

    return (data || []).map(mapRow);
}

/**
 * Get brand by ID
 */
async function getById(id: string): Promise<Brand | null> {
    if (USE_VPS.brands) {
        const brands = await list();
        return brands.find(brand => brand.id === id) || null;
    }

    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch brand: ${error.message}`);
    }

    return mapRow(data);
}

/**
 * Create new brand
 */
async function create(input: BrandInput): Promise<Brand> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    if (USE_VPS.brands) {
        const id = crypto.randomUUID();
        const payload = {
            id,
            company_id: companyId,
            name: input.name,
            slug,
            warranty_days: input.warranty_days || 90,
            logo_url: input.logo_url || null,
            active: input.active !== undefined ? input.active : true
        };
        const ok = await vpsApiService.syncBrand(payload);
        if (!ok) throw new Error('Falha ao criar marca na VPS');
        return mapRow(payload);
    }

    const { data, error } = await supabase
        .from('brands')
        .insert({
            company_id: companyId,
            name: input.name,
            slug,
            warranty_days: input.warranty_days || 90,
            active: input.active !== undefined ? input.active : true
        })
        .select()
        .single();

    if (error) {
        // Tolerância de falhas "Get or Create": se houver conflito Unique, pegamos a marca existente.
        if (error.code === '23505' || error.message.includes('unique constraint') || error.message.includes('409')) {
            const { data: existingBrand, error: fetchErr } = await supabase
                .from('brands')
                .select('*')
                .eq('slug', slug)
                .eq('company_id', companyId)
                .single();
            
            if (!fetchErr && existingBrand) {
                const result = mapRow(existingBrand);
                return result;
            }
        }
        throw new Error(`Failed to create brand: ${error.message}`);
    }

    const result = mapRow(data);
    // Fire-and-forget VPS sync
    vpsApiService.syncBrand({ ...data, company_id: data.company_id }).catch(console.warn);
    return result;
}

/**
 * Update existing brand + cascade: sync brand name in products table
 */
async function update(id: string, input: BrandInput): Promise<Brand> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    if (USE_VPS.brands) {
        const payload = {
            name: input.name,
            slug,
            warranty_days: input.warranty_days || 90,
            logo_url: input.logo_url || null,
            active: input.active !== undefined ? input.active : true
        };
        const ok = await vpsApiService.updateBrand(id, payload);
        if (!ok) throw new Error('Falha ao atualizar marca na VPS');
        const updated = await getById(id);
        if (!updated) throw new Error('Marca nao encontrada apos atualizacao');
        return updated;
    }

    // 1. Fetch current name before updating (needed for cascading)
    const { data: current, error: fetchError } = await supabase
        .from('brands')
        .select('name')
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle();

    if (fetchError) throw new Error(`Failed to fetch brand: ${fetchError.message}`);

    const oldName = current?.name;

    // 2. Update — no .select() to avoid RLS blocking returned rows
    const updatePayload: Record<string, unknown> = {
        name: input.name,
        slug,
        warranty_days: input.warranty_days || 90,
    };
    if (input.active !== undefined) {
        updatePayload.active = input.active;
    }

    const { error } = await supabase
        .from('brands')
        .update(updatePayload)
        .eq('id', id);

    if (error) throw new Error(`Failed to update brand: ${error.message}`);

    // 3. Cascade: update brand name in products table
    if (oldName && oldName !== input.name) {
        await supabase
            .from('products')
            .update({ brand: input.name })
            .eq('brand', oldName);
    }

    // 4. Fetch updated brand via separate SELECT
    const updated = await getById(id);
    if (!updated) throw new Error('Brand not found after update.');
    // Fire-and-forget VPS sync
    vpsApiService.updateBrand(id, { name: input.name, slug, warranty_days: input.warranty_days || 90, active: input.active }).catch(console.warn);
    return updated;
}


/**
 * Delete brand
 */
async function deleteBrand(id: string): Promise<void> {
    if (USE_VPS.brands) {
        const ok = await vpsApiService.deleteBrand(id);
        if (!ok) throw new Error('Falha ao excluir marca na VPS');
        return;
    }

    const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', id);

    if (error) throw new Error(`Failed to delete brand: ${error.message}`);

    // Fire-and-forget VPS sync
    vpsApiService.deleteBrand(id).catch(console.warn);
}


/**
 * Get brands available for selectors.
 * Older rows may have active as null, which is treated as active by the mapper.
 */
async function listActive(): Promise<Brand[]> {
    if (USE_VPS.brands) {
        return (await list()).filter(brand => brand.active);
    }

    const companyId = await getCompanyId();
    const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('company_id', companyId)
        .or('active.eq.true,active.is.null')
        .order('name');

    if (error) throw new Error(`Failed to fetch active brands: ${error.message}`);
    return (data || []).map(mapRow);
}

export const brandService = {
    list,
    getById,
    create,
    update,
    delete: deleteBrand,
    listActive
};
