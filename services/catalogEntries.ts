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
    /** Atalho: produto (variação) já escolhido. O servidor ignora modelo, categoria, nome, configuração (menos a condição) e cor. */
    product_id?: string | null;
    /** Linha da aba Foto: pré-cadastro da fila de foto (do cliente vale só o local). */
    photo_intake_id?: string | null;
    /** Só para a tela; o servidor ignora (não entra no hash). */
    label?: string;
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
/** replay: o mesmo client_batch_id já tinha sido gravado; nada foi gravado de novo. */
export interface CommitResult { batch_id: string; plan: PlanLine[]; replay?: boolean }
export interface BatchLine { line: number; product_id: string | null; unit_id?: string | null; quantity?: number }

const TIMEOUT = { timeoutMs: 60000 };

export const catalogEntries = {
    preview: (items: EntryItem[]) =>
        vpsClient.post<PreviewResult>('/catalog-entries/preview', { items }, TIMEOUT),
    /** clientBatchId: chave de idempotência; reenviar com a mesma chave não grava duas vezes. */
    commit: (items: EntryItem[], previewHash: string, clientBatchId: string) =>
        vpsClient.post<CommitResult>('/catalog-entries', { items, preview_hash: previewHash, client_batch_id: clientBatchId }, TIMEOUT),
    get: (id: string) =>
        vpsClient.get<{ batch: Record<string, unknown>; lines: BatchLine[] }>(
            `/catalog-entries/${encodeURIComponent(id)}`, TIMEOUT),
};
