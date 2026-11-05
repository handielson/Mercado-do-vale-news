import { vpsClient } from './vpsClient';

export interface EntryItem {
    source: string;
    model_id?: string | null;
    category_id?: string | null;
    name?: string;
    configuration?: { ram?: string; storage?: string; version?: string; network?: string; condition?: string };
    color?: string;
    condition_note?: string | null;
    battery_health?: number | null;
    identity?: { imei1?: string | null; imei2?: string | null; serial?: string | null };
    quantity?: number;
    cost_cents?: number;
    location_id?: string | null;
    prices?: { price_retail: number; price_reseller: number; price_wholesale: number } | null;
}

export interface PlanLine {
    line: number;
    product_id: string | null;
    sku: string | null;
    family: 'new' | 'existing' | null;
    variation: 'new' | 'existing' | null;
    price_source: string | null;
    stock: { kind: string; quantity: number };
    errors: string[];
}

export interface PreviewResult { ok: boolean; plan: PlanLine[]; hash: string }
export interface CommitResult { batch_id: string; plan: PlanLine[] }

const TIMEOUT = { timeoutMs: 60000 };

export const catalogEntries = {
    preview: (items: EntryItem[]) =>
        vpsClient.post<PreviewResult>('/catalog-entries/preview', { items }, TIMEOUT),
    commit: (items: EntryItem[], previewHash: string) =>
        vpsClient.post<CommitResult>('/catalog-entries', { items, preview_hash: previewHash }, TIMEOUT),
    get: (id: string) =>
        vpsClient.get<{ batch: Record<string, unknown>; lines: Record<string, unknown>[] }>(
            `/catalog-entries/${encodeURIComponent(id)}`, TIMEOUT),
};
