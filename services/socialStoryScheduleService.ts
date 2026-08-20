import { vpsClient } from './vpsClient';

export type SocialStoryDestination = 'instagram' | 'whatsapp';
export type SocialStoryMediaType = 'image' | 'video';

export interface SocialStoryDraftItem {
  mediaType: SocialStoryMediaType;
  mediaUrl: string;
  label?: string;
  caption?: string;
  offsetSeconds?: number;
  color?: string;
  productId?: string;
}

export interface SocialStoryDelivery {
  id: string;
  destination: SocialStoryDestination;
  status: string;
  attempt_count: number;
  provider_publication_id?: string | null;
  error?: string | null;
  published_at?: string | null;
}

export interface SocialStoryScheduleItem {
  id: string;
  sequence_index: number;
  media_type: SocialStoryMediaType;
  media_url: string;
  label?: string | null;
  caption?: string | null;
  scheduled_at: string;
  deliveries: SocialStoryDelivery[];
}

export interface SocialStorySchedule {
  id: string;
  title: string;
  source_type: 'standalone' | 'whatsapp_campaign';
  source_id?: string | null;
  scheduled_at: string;
  destinations: SocialStoryDestination[];
  status: string;
  approval_id?: string | null;
  last_error?: string | null;
  items: SocialStoryScheduleItem[];
}

export interface CreateSocialStoryScheduleInput {
  title: string;
  sourceType: 'standalone' | 'whatsapp_campaign';
  sourceId?: string | null;
  scheduledAt: string;
  destinations: SocialStoryDestination[];
  includePrice?: boolean;
  mediaDelaySeconds?: number;
  items?: SocialStoryDraftItem[];
}

export const socialStoryScheduleService = {
  async list(): Promise<SocialStorySchedule[]> {
    return (await vpsClient.get<{ ok: true; items: SocialStorySchedule[] }>('/admin/marketing/stories')).items;
  },

  async previewWhatsApp(campaignId: string, includePrice = true): Promise<SocialStoryDraftItem[]> {
    return (await vpsClient.post<{ ok: true; items: SocialStoryDraftItem[] }>(
      '/admin/marketing/stories/preview-whatsapp', { campaignId, includePrice },
    )).items;
  },

  async create(input: CreateSocialStoryScheduleInput): Promise<{ scheduleId: string; approvalId: string; itemCount: number }> {
    return await vpsClient.post('/admin/marketing/stories', input);
  },

  async cancel(id: string): Promise<void> {
    await vpsClient.post(`/admin/marketing/stories/${encodeURIComponent(id)}/cancel`, {});
  },
};
