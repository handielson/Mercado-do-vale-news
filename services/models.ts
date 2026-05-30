import { Model, ModelInput } from '../types/model';
import { vpsClient } from './vpsClient';

/**
 * MODEL SERVICE - VPS implementation
 * The frontend no longer writes models directly to Supabase.
 */

function withBrandQuery(brandId: string): string {
    return `/models?brand_id=${encodeURIComponent(brandId)}`;
}

async function list(): Promise<Model[]> {
    return vpsClient.get<Model[]>('/models');
}

async function getById(id: string): Promise<Model | null> {
    return vpsClient.get<Model | null>(`/models/${encodeURIComponent(id)}`);
}

async function listByBrand(brandId: string): Promise<Model[]> {
    return vpsClient.get<Model[]>(withBrandQuery(brandId));
}

async function create(input: ModelInput): Promise<Model> {
    return vpsClient.post<Model>('/models', input);
}

async function update(id: string, input: ModelInput): Promise<Model> {
    return vpsClient.put<Model>(`/models/${encodeURIComponent(id)}`, input);
}

async function deleteModel(id: string): Promise<void> {
    await vpsClient.delete(`/models/${encodeURIComponent(id)}`);
}

async function listActive(): Promise<Model[]> {
    return list();
}

async function listActiveByBrand(brandId: string): Promise<Model[]> {
    return listByBrand(brandId);
}

export const modelService = {
    list,
    getById,
    listByBrand,
    create,
    update,
    delete: deleteModel,
    listActive,
    listActiveByBrand
};
