import { vpsClient } from './vpsClient';

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
  status: 'awaiting_dce' | 'ready' | 'printing' | 'printed' | 'intervention';
  shipment_substatus: string | null;
  tracking_number: string | null;
  last_error: string | null;
  created_at: string;
}

export const mercadoLivreService = {
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
