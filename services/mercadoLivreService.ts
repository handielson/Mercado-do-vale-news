import { vpsClient } from './vpsClient';

export type MercadoLivreCandidate = { id: string; sku: string; name: string };
export type MercadoLivreListing = { itemId: string; variationId: string; title: string; status: string; sku: string; variation: string;
  existing: Array<{ productId: string; sku: string | null }>; candidates: MercadoLivreCandidate[];
  match: 'linked' | 'missing_sku' | 'unique' | 'ambiguous' | 'not_found' };
export type MercadoLivreDiscovery = { items: MercadoLivreListing[]; errors: Array<{ itemId: string; error: string }>; nextCursor: string | null; total: number; sellerId: string };

export interface MercadoLivreStatus {
  configured: boolean;
  connected: boolean;
  clientId: string;
  userId: string | null;
  nickname: string | null;
  tokenExpiresAt: string | null;
  autoDceEnabled: boolean;
  stockSyncEnabled: boolean;
  connectedAt: string | null;
  redirectUrl: string;
  webhookUrl: string;
}

export interface MercadoLivrePrintJob {
  shipment_id: string;
  order_id: string;
  status: 'awaiting_dce' | 'ready' | 'printing' | 'printed' | 'intervention' | 'closed';
  shipment_status: string | null;
  shipment_substatus: string | null;
  tracking_number: string | null;
  last_error: string | null;
  created_at: string;
}

export const mercadoLivreService = {
  getPreparationSnapshot: () => vpsClient.get<any>('/mercado-livre/preparation/snapshot'),
  calculateListingPrice: (sellerId: string, draft: unknown, pricingPolicy: unknown) => vpsClient.post<any>('/mercado-livre/preparation/pricing', { sellerId, draft, pricingPolicy }),
  getCategoryRequirements: (id: string) => vpsClient.get<any>(`/mercado-livre/preparation/categories/${encodeURIComponent(id)}`),
  previewPublication: (sellerId: string, draft: unknown) => vpsClient.post<any>('/mercado-livre/preparation/preview', { sellerId, draft }),
  publishPrepared: (sellerId: string, draft: unknown, resumeOnly = false) => vpsClient.post<{itemId:string;alreadyPublished:boolean}>('/mercado-livre/preparation/publish', { sellerId, draft, confirmPublication:true, resumeOnly }),
  discoverProducts: (cursor = '') => vpsClient.get<MercadoLivreDiscovery>(`/mercado-livre/products/discover${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  findCandidates: (q: string) => vpsClient.get<{ items: MercadoLivreCandidate[] }>(`/mercado-livre/products/candidates?q=${encodeURIComponent(q)}`),
  getProductLinks: () => vpsClient.get<{ items: Array<{ product_id: string; item_id: string; variation_id?: string; last_error?: string | null }> }>('/mercado-livre/products/links'),
  getStatus: () => vpsClient.get<MercadoLivreStatus>('/mercado-livre/settings'),
  updateSettings: (input: Partial<{
    clientId: string;
    clientSecret: string;
    autoDceEnabled: boolean;
    stockSyncEnabled: boolean;
  }>) => vpsClient.patch<MercadoLivreStatus>('/mercado-livre/settings', input),
  getAuthorizationUrl: () => vpsClient.get<{ url: string }>('/mercado-livre/oauth/auth'),
  getPrintJobs: () => vpsClient.get<{ items: MercadoLivrePrintJob[] }>('/mercado-livre/print-jobs?limit=30'),
  emitDce: (orderId: string) => vpsClient.post(`/mercado-livre/orders/${encodeURIComponent(orderId)}/dce`, {}),
  linkProduct: (input: { productId: string; itemId: string; variationId?: string; sellerSku?: string }) =>
    vpsClient.post('/mercado-livre/products/link', input),
};
