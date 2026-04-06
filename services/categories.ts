import { Category, CategoryInput } from '../types/category';
import { vpsApiService } from './vpsApiService';

/**
 * CATEGORY SERVICE — VPS-only implementation
 * A VPS é a única fonte de verdade para categorias.
 */

const VPS_BASE_URL = (import.meta as any).env?.DEV
    ? '/vps-proxy'
    : ((import.meta as any).env?.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br');

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function mapRow(row: any): Category {
    return {
        id: row.id,
        parent_id: row.parent_id || null,
        sort_order: row.sort_order ?? 0,
        name: row.name,
        slug: row.slug,
        config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}),
        warranty_days: row.warranty_days || 90,
        production_days: row.production_days || 0,
        extended_warranty_enabled: !!row.extended_warranty_enabled,
        margin_wholesale: row.margin_wholesale ?? undefined,
        margin_reseller: row.margin_reseller ?? undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function list(): Promise<Category[]> {
    const result = await vpsApiService.getCategories();
    if (!result) throw new Error('Falha ao carregar categorias da VPS');
    const cats = (result as any[]).map(mapRow);
    cats.sort((a, b) => {
        const orderA = a.sort_order ?? 9999;
        const orderB = b.sort_order ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });
    return cats;
}

async function create(input: CategoryInput): Promise<Category> {
    const slug = input.slug || generateSlug(input.name);
    // Gerar UUID v4 no cliente para garantir que o ID seja igual Supabase-style
    const id = crypto.randomUUID();
    const ok = await vpsApiService.syncCategory({
        id,
        parent_id: input.parent_id || null,
        name: input.name,
        slug,
        config: input.config || {},
        warranty_days: input.warranty_days || 90,
        production_days: input.production_days || 0,
        sort_order: input.sort_order || 0,
        extended_warranty_enabled: input.extended_warranty_enabled ?? false,
        margin_wholesale: input.margin_wholesale || null,
        margin_reseller: input.margin_reseller || null,
    });
    if (!ok) throw new Error('Falha ao criar categoria na VPS');
    return mapRow({ id, slug, ...input, production_days: input.production_days || 0, extended_warranty_enabled: input.extended_warranty_enabled ?? false });
}

async function getById(id: string): Promise<Category | null> {
    const all = await list();
    return all.find(c => c.id === id) || null;
}

async function update(id: string, input: CategoryInput): Promise<Category> {
    const slug = input.slug || generateSlug(input.name);
    const ok = await vpsApiService.updateCategory(id, {
        parent_id: input.parent_id || null,
        name: input.name,
        slug,
        config: input.config || {},
        warranty_days: input.warranty_days || 90,
        production_days: input.production_days || 0,
        sort_order: input.sort_order,
        extended_warranty_enabled: input.extended_warranty_enabled ?? false,
        margin_wholesale: input.margin_wholesale || null,
        margin_reseller: input.margin_reseller || null,
    });
    if (!ok) throw new Error('Falha ao atualizar categoria na VPS');
    const updated = await getById(id);
    if (!updated) throw new Error('Categoria não encontrada após atualização');
    return updated;
}

async function remove(id: string): Promise<void> {
    const ok = await vpsApiService.deleteCategory(id);
    if (!ok) throw new Error('Falha ao excluir categoria na VPS');
}

async function updateSortOrder(orders: { id: string; sort_order: number }[]): Promise<void> {
    const SYNC_KEY = (import.meta as any).env?.VITE_VPS_SYNC_KEY || '';
    await fetch(`${VPS_BASE_URL}/categories/sort-order`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Key': SYNC_KEY,
        },
        body: JSON.stringify(orders),
    });
}

export const categoryService = {
    list,
    create,
    getById,
    update,
    remove,
    updateSortOrder
};
