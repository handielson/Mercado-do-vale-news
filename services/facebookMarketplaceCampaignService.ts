import { vpsClient } from './vpsClient';
import type { FacebookMarketplaceDestination } from './facebookMarketplaceScheduleService';

export interface FacebookMarketplaceGroup {
  id: string;
  name: string;
  url: string;
  source: 'manual' | 'chrome';
  active: boolean | number;
  last_synced_at: string | null;
}

export interface FacebookMarketplaceCampaign {
  id: string;
  title: string;
  category_id: string;
  min_stock: number;
  interval_minutes: number;
  republish_cooldown_hours: number;
  daily_limit: number;
  start_time: string;
  end_time: string;
  destinations: FacebookMarketplaceDestination[] | string | null;
  description_template: string | null;
  active: boolean | number;
  last_product_id: string | null;
  last_generated_at: string | null;
  next_run_at: string | null;
  last_error: string | null;
}

export type FacebookMarketplaceCampaignInput = Omit<FacebookMarketplaceCampaign,
  'id' | 'last_product_id' | 'last_generated_at' | 'next_run_at' | 'last_error'>;

function rowsOf<T>(value: { rows?: T[] } | T[]): T[] {
  return Array.isArray(value) ? value : value.rows || [];
}

function parseDestinations(value: FacebookMarketplaceCampaign['destinations']): FacebookMarketplaceDestination[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function normalizeCampaign(row: FacebookMarketplaceCampaign): FacebookMarketplaceCampaign {
  return {
    ...row,
    min_stock: Math.max(1, Number(row.min_stock || 1)),
    interval_minutes: Math.max(15, Number(row.interval_minutes || 180)),
    republish_cooldown_hours: Math.max(1, Number(row.republish_cooldown_hours || 168)),
    daily_limit: Math.max(1, Number(row.daily_limit || 4)),
    active: row.active === true || row.active === 1,
    destinations: parseDestinations(row.destinations),
  };
}

export const facebookMarketplaceCampaignService = {
  async listCampaigns() {
    const response = await vpsClient.get<{ rows?: FacebookMarketplaceCampaign[] }>('/table-data/facebook_marketplace_campaigns?limit=200&offset=0');
    return rowsOf(response).map(normalizeCampaign);
  },
  async createCampaign(input: FacebookMarketplaceCampaignInput) {
    return normalizeCampaign(await vpsClient.post<FacebookMarketplaceCampaign>('/table-data/facebook_marketplace_campaigns', input));
  },
  async updateCampaign(id: string, input: Partial<FacebookMarketplaceCampaignInput>) {
    return normalizeCampaign(await vpsClient.patch<FacebookMarketplaceCampaign>(`/table-data/facebook_marketplace_campaigns/${encodeURIComponent(id)}?pk=id`, input));
  },
  async deleteCampaign(id: string) {
    await vpsClient.delete(`/table-data/facebook_marketplace_campaigns/${encodeURIComponent(id)}?pk=id`);
  },
  async listGroups() {
    const response = await vpsClient.get<{ rows?: FacebookMarketplaceGroup[] }>('/table-data/facebook_marketplace_groups?limit=500&offset=0');
    return rowsOf(response).map((row) => ({ ...row, active: row.active === true || row.active === 1 }));
  },
  async createGroup(input: Pick<FacebookMarketplaceGroup, 'name' | 'url' | 'source'>) {
    return vpsClient.post<FacebookMarketplaceGroup>('/table-data/facebook_marketplace_groups', { ...input, active: true, last_synced_at: new Date().toISOString() });
  },
  async deleteGroup(id: string) {
    await vpsClient.delete(`/table-data/facebook_marketplace_groups/${encodeURIComponent(id)}?pk=id`);
  },
};
