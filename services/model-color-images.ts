/**
 * Model-Color Images Service
 * Manages images for model-color variations through the VPS table-data API.
 */

import { getCompanyId } from './companyContext';
import { vpsClient } from './vpsClient';

export interface ModelColorImages {
    id: string;
    company_id?: string | null;
    model_id: string;
    color_id: string;
    images: string[];
    image_url?: string | null;
    display_order?: number | null;
    created_at: string;
    updated_at: string;
}

export interface ModelColorImagesInput {
    model_id: string;
    color_id: string;
    images: string[];
}

export type ModelColorImageRow = {
    id: string;
    company_id?: string | null;
    model_id: string;
    color_id: string;
    images?: string[] | string | null;
    image_url?: string | null;
    display_order?: number | string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

function parseImages(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [value];
    } catch {
        return [value];
    }
}

function normalizeRow(row: ModelColorImageRow): ModelColorImages {
    const images = parseImages(row.images);
    if (row.image_url && !images.includes(row.image_url)) images.push(row.image_url);

    return {
        id: row.id,
        company_id: row.company_id,
        model_id: row.model_id,
        color_id: row.color_id,
        images,
        image_url: row.image_url || images[0] || null,
        display_order: row.display_order == null ? null : Number(row.display_order),
        created_at: row.created_at || '',
        updated_at: row.updated_at || '',
    };
}

function sortRows(rows: ModelColorImages[]): ModelColorImages[] {
    return [...rows].sort((left, right) => {
        const leftOrder = left.display_order == null ? Number.MAX_SAFE_INTEGER : Number(left.display_order);
        const rightOrder = right.display_order == null ? Number.MAX_SAFE_INTEGER : Number(right.display_order);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return String(right.updated_at || '').localeCompare(String(left.updated_at || ''));
    });
}

async function loadRows(): Promise<ModelColorImages[]> {
    const companyId = await getCompanyId();
    const pageSize = 500;
    const rows: ModelColorImageRow[] = [];

    for (let offset = 0; ; offset += pageSize) {
        const response = await vpsClient.get<TableDataResponse<ModelColorImageRow>>(
            `/table-data/model_color_images?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
    }

    const normalized = rows.map(normalizeRow);
    return companyId
        ? normalized.filter(row => !row.company_id || row.company_id === companyId)
        : normalized;
}

/**
 * Get images for a specific model-color variation
 */
async function get(modelId: string, colorId: string): Promise<ModelColorImages | null> {
    const rows = await loadRows();
    return sortRows(rows.filter(row => row.model_id === modelId && row.color_id === colorId))[0] || null;
}

/**
 * Get all images for a model (all colors)
 */
async function getByModel(modelId: string): Promise<ModelColorImages[]> {
    return sortRows((await loadRows()).filter(row => row.model_id === modelId));
}

/**
 * Get all image rows for a set of models.
 */
async function getByModelIds(modelIds: string[]): Promise<ModelColorImages[]> {
    const ids = new Set(modelIds.filter(Boolean));
    if (ids.size === 0) return [];
    return sortRows((await loadRows()).filter(row => ids.has(row.model_id)));
}

async function getAll(): Promise<ModelColorImages[]> {
    return sortRows(await loadRows());
}

/**
 * Create or update images for a model-color variation
 */
async function upsert(input: ModelColorImagesInput): Promise<ModelColorImages> {
    const companyId = await getCompanyId();
    const existing = await get(input.model_id, input.color_id);
    const payload = {
        company_id: companyId,
        model_id: input.model_id,
        color_id: input.color_id,
        images: input.images,
        image_url: input.images[0] || null
    };

    const existingId = existing?.id;
    if (existingId) {
        const data = await vpsClient.patch<ModelColorImageRow>(
            `/table-data/model_color_images/${encodeURIComponent(existingId)}?pk=id`,
            payload
        );
        return normalizeRow(data);
    }

    const data = await vpsClient.post<ModelColorImageRow>('/table-data/model_color_images', payload);
    return normalizeRow(data);
}

/**
 * Delete images for a model-color variation
 */
async function remove(modelId: string, colorId: string): Promise<void> {
    const rows = (await loadRows()).filter(row => row.model_id === modelId && row.color_id === colorId);
    await Promise.all(rows.map(row =>
        vpsClient.delete(`/table-data/model_color_images/${encodeURIComponent(row.id)}?pk=id`)
    ));
}

/**
 * Get images for a product (custom or default)
 */
async function getProductImages(product: {
    custom_images?: string[] | null;
    model_id: string;
    color_id: string;
}): Promise<string[]> {
    if (product.custom_images && product.custom_images.length > 0) {
        return product.custom_images;
    }

    const variantImages = await get(product.model_id, product.color_id);
    return variantImages?.images || [];
}

export const modelColorImagesService = {
    get,
    getAll,
    getByModel,
    getByModelIds,
    upsert,
    remove,
    getProductImages
};
