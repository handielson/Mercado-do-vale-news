import { Brand, BrandInput } from '../types/brand';
import { vpsApiService } from './vpsApiService';
import { getCompanyId } from './companyContext';

/**
 * BRAND SERVICE - VPS implementation.
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

function getBrandProxyUrl(): string {
    const env = (import.meta as any).env ?? {};
    const proxyBase = env.DEV ? '/vps-proxy' : '/api/vps-proxy';
    return `${proxyBase}?path=${encodeURIComponent('/brands')}`;
}

async function loadVpsBrands(): Promise<any[]> {
    const rows = await vpsApiService.getBrands();
    if (Array.isArray(rows) && rows.length > 0) return rows;

    const response = await fetch(getBrandProxyUrl(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Falha ao carregar marcas da VPS: ${response.status} ${response.statusText}`);
    }

    const fallbackRows = await response.json();
    if (!Array.isArray(fallbackRows)) {
        throw new Error('Falha ao carregar marcas da VPS: resposta invalida');
    }

    return fallbackRows;
}

async function list(): Promise<Brand[]> {
    const rows = await loadVpsBrands();
    return rows.map(mapRow);
}

async function getById(id: string): Promise<Brand | null> {
    const brands = await list();
    return brands.find(brand => brand.id === id) || null;
}

async function create(input: BrandInput): Promise<Brand> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);
    const existing = (await list()).find(brand => brand.slug === slug || brand.name.toLowerCase() === input.name.toLowerCase());
    if (existing) return existing;

    const payload = {
        id: crypto.randomUUID(),
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

async function update(id: string, input: BrandInput): Promise<Brand> {
    const slug = generateSlug(input.name);
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

async function deleteBrand(id: string): Promise<void> {
    const ok = await vpsApiService.deleteBrand(id);
    if (!ok) throw new Error('Falha ao excluir marca na VPS');
}

async function listActive(): Promise<Brand[]> {
    return (await list()).filter(brand => brand.active);
}

export const brandService = {
    list,
    getById,
    create,
    update,
    delete: deleteBrand,
    listActive
};
