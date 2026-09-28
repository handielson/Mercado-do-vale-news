import { vpsClient } from './vpsClient';
import type { StorefrontCode } from './productStorefrontOffers';

export type ProductDeadlineRequestInput = {
  product_id: string;
  quantity: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_message?: string;
  website?: string;
};

export type ProductDeadlineRequestResult = {
  ok: true;
  id: string;
  public_code: string;
  storefront: StorefrontCode;
  lead_time_label: string;
  notification_status: 'sent' | 'unconfigured' | 'failed';
};

export type AdminProductDeadlineRequest = {
  id: string;
  public_code: string;
  storefront: StorefrontCode;
  product_id: string;
  sku_snapshot: string;
  product_name_snapshot: string;
  quantity_requested: number;
  lead_time_label_snapshot: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_message: string | null;
  status: 'new' | 'contacted' | 'negotiating' | 'approved' | 'declined' | 'closed';
  negotiated_business_days: number | null;
  admin_notes: string | null;
  whatsapp_notification_status: 'pending' | 'sent' | 'unconfigured' | 'failed';
  created_at: string;
};

export const productDeadlineRequestsService = {
  create: (storefront: StorefrontCode, input: ProductDeadlineRequestInput) =>
    vpsClient.post<ProductDeadlineRequestResult>(`/storefronts/${storefront}/deadline-requests`, input),
  list: (storefront: StorefrontCode, search = '', page = 1) => {
    const query = new URLSearchParams({ storefront, search, page: String(page), page_size: '25' });
    return vpsClient.get<{ items: AdminProductDeadlineRequest[]; total: number; page: number; page_size: number }>(
      `/admin/product-deadline-requests?${query}`,
    );
  },
  update: (id: string, update: Pick<AdminProductDeadlineRequest, 'status' | 'negotiated_business_days' | 'admin_notes'>) =>
    vpsClient.patch<{ ok: true }>(`/admin/product-deadline-requests/${encodeURIComponent(id)}`, update),
};
