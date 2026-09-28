import { vpsClient } from './vpsClient';

export type LocalCatalogDraft = {
  product_id: string;
  fields: string[];
  storefronts: string[];
  updated_at: string | null;
};

export function isLocalCatalogPreviewRuntime(): boolean {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return false;
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
}

export const localCatalogPreviewService = {
  list: (productId: string) => vpsClient.get<{ drafts: LocalCatalogDraft[] }>(
    `/admin/local-preview/drafts?product_id=${encodeURIComponent(productId)}`,
  ),
  approve: (productId: string) => vpsClient.post<{ ok: boolean; approved: number; changes: string[] }>(
    `/admin/local-preview/drafts/${encodeURIComponent(productId)}/approve`, {},
  ),
};
