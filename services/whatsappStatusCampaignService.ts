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
  queued?: boolean;
  already_running?: boolean;
  run_id?: string | null;
  sent: number;
  failed: number;
  debug?: string;
  logs?: Array<{
    productId?: string;
    productName?: string;
    status: 'sending' | 'sent' | 'failed' | 'skipped';
    debug?: string;
  }>;
}

export interface WhatsAppStatusCampaignLog {
  id?: string;
  run_id?: string | null;
  campaign_id?: string;
  product_id?: string | null;
  product_name?: string | null;
  status: 'sending' | 'sent' | 'failed' | 'skipped' | string;
  debug_text?: string | null;
  scheduled_for?: string | null;
  slot_index?: number | null;
  created_at?: string | null;
}

export interface WhatsAppStatusTraceEvent {
  id: number;
  run_id: string;
  log_id?: string | null;
  campaign_id: string;
  product_id?: string | null;
  stage: string;
  state: 'started' | 'ok' | 'failed' | 'info' | string;
  message?: string | null;
  details_json?: Record<string, string | number | boolean | null> | string | null;
  elapsed_ms?: number | null;
  created_at?: string | null;
}

export interface WhatsAppStatusCampaignProgress {
  campaign_id: string;
  daily_limit: number;
  interval_minutes: number;
  start_time: string;
  active: boolean;
  scheduled: {
    total: number;
    done: number;
    sent: number;
    failed: number;
    skipped: number;
    percent: number;
    next_slot_index: number | null;
    next_scheduled_for: string | null;
  };
  today: {
    total_logs: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  last_log: WhatsAppStatusCampaignLog | null;
  trace_events: WhatsAppStatusTraceEvent[];
  logs: WhatsAppStatusCampaignLog[];
}

export interface WhatsAppStatusProgressResponse {
  ok: boolean;
  generated_at: string;
  campaigns: WhatsAppStatusCampaignProgress[];
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

function normalizeTraceEvent(event: WhatsAppStatusTraceEvent): WhatsAppStatusTraceEvent {
  let details = event.details_json;
  if (typeof details === 'string' && details.trim()) {
    try { details = JSON.parse(details); } catch { details = {}; }
  }
  return { ...event, details_json: details && typeof details === 'object' ? details : {} };
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

  async progress(): Promise<WhatsAppStatusProgressResponse> {
    const result = await vpsClient.get<WhatsAppStatusProgressResponse>('/whatsapp/status-campaigns/progress');
    return {
      ...result,
      campaigns: (result.campaigns || []).map((campaign) => ({
        ...campaign,
        trace_events: (campaign.trace_events || []).map(normalizeTraceEvent),
      })),
    };
  },
};
