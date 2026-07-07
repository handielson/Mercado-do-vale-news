import { vpsClient } from './vpsClient';

export type WhatsAppStatusCampaignSourceType = 'product' | 'category';
export type WhatsAppStatusCampaignFrequency = 'once' | 'daily' | 'weekly';

export interface WhatsAppStatusCampaign {
  id: string;
  title: string;
  source_type: WhatsAppStatusCampaignSourceType;
  product_id: string | null;
  product_ids?: string[] | string | null;
  category_id: string | null;
  daily_limit: number;
  interval_minutes: number;
  start_time: string;
  frequency: WhatsAppStatusCampaignFrequency;
  active: boolean | number;
  last_product_id: string | null;
  last_run_at: string | null;
  last_error_debug: string | null;
  created_at: string;
  updated_at: string;
}

export type WhatsAppStatusCampaignInput = Omit<
  WhatsAppStatusCampaign,
  'id' | 'last_product_id' | 'last_run_at' | 'last_error_debug' | 'created_at' | 'updated_at'
>;

export interface WhatsAppStatusSendNowResult {
  ok: boolean;
  sent: number;
  failed: number;
  debug?: string;
  logs?: Array<{
    productId?: string;
    productName?: string;
    status: 'sent' | 'failed' | 'skipped';
    debug?: string;
  }>;
}

interface TableDataResponse<T> {
  rows?: T[];
  data?: T[];
  items?: T[];
}

function extractRows<T>(response: TableDataResponse<T> | T[]): T[] {
  if (Array.isArray(response)) return response;
  return response.rows || response.data || response.items || [];
}

function normalizeCampaign(row: WhatsAppStatusCampaign): WhatsAppStatusCampaign {
  let productIds: string[] = [];
  if (Array.isArray(row.product_ids)) {
    productIds = row.product_ids.map(String).filter(Boolean);
  } else if (typeof row.product_ids === 'string' && row.product_ids.trim()) {
    try {
      const parsed = JSON.parse(row.product_ids);
      productIds = Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      productIds = [];
    }
  }
  if (!productIds.length && row.product_id) productIds = [row.product_id];

  return {
    ...row,
    product_ids: productIds,
    daily_limit: Math.max(1, Math.min(10, Number(row.daily_limit || 1))),
    interval_minutes: Math.max(1, Number(row.interval_minutes || 30)),
    active: row.active === true || row.active === 1,
  };
}

export const whatsappStatusCampaignService = {
  async list(): Promise<WhatsAppStatusCampaign[]> {
    const data = await vpsClient.get<TableDataResponse<WhatsAppStatusCampaign>>(
      '/table-data/whatsapp_status_campaigns?limit=200&offset=0',
    );
    return extractRows(data).map(normalizeCampaign);
  },

  async create(input: WhatsAppStatusCampaignInput): Promise<WhatsAppStatusCampaign> {
    const saved = await vpsClient.post<WhatsAppStatusCampaign>('/table-data/whatsapp_status_campaigns', input);
    return normalizeCampaign(saved);
  },

  async update(id: string, input: Partial<WhatsAppStatusCampaignInput>): Promise<WhatsAppStatusCampaign> {
    const saved = await vpsClient.patch<WhatsAppStatusCampaign>(
      `/table-data/whatsapp_status_campaigns/${encodeURIComponent(id)}?pk=id`,
      input,
    );
    return normalizeCampaign(saved);
  },

  async delete(id: string): Promise<void> {
    await vpsClient.delete(`/table-data/whatsapp_status_campaigns/${encodeURIComponent(id)}?pk=id`);
  },

  async sendNow(id: string): Promise<WhatsAppStatusSendNowResult> {
    return vpsClient.post<WhatsAppStatusSendNowResult>(
      `/whatsapp/status-campaigns/${encodeURIComponent(id)}/send-now`,
      {},
    );
  },
};
