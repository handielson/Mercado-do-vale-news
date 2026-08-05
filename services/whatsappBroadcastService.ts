import { vpsClient } from './vpsClient';

export interface WhatsAppBroadcastTopic {
  id: string;
  name: string;
  slug: string;
  category_id?: string | null;
  category_name?: string | null;
  active: boolean | number;
  sort_order: number;
  subscriber_count: number;
}

export interface WhatsAppBroadcastSubscriber {
  id: string;
  phone: string;
  name?: string | null;
  consent_status: 'invited' | 'selecting' | 'subscribed' | 'opted_out' | string;
  topics?: string | null;
  invited_at?: string | null;
  consented_at?: string | null;
}

export interface WhatsAppBroadcastSendResult {
  ok: boolean;
  topic: string;
  total: number;
  sent: number;
  failed: number;
}

export const whatsappBroadcastService = {
  listTopics: () => vpsClient.get<WhatsAppBroadcastTopic[]>('/whatsapp/broadcast/topics'),
  listSubscribers: () => vpsClient.get<WhatsAppBroadcastSubscriber[]>('/whatsapp/broadcast/subscribers'),
  createTopic: (name: string) => vpsClient.post<WhatsAppBroadcastTopic>('/whatsapp/broadcast/topics', { name }),
  updateTopic: (id: string, patch: Partial<Pick<WhatsAppBroadcastTopic, 'name' | 'active' | 'sort_order'>>) =>
    vpsClient.patch<{ ok: boolean }>(`/whatsapp/broadcast/topics/${encodeURIComponent(id)}`, patch),
  invite: (phone: string, name?: string) =>
    vpsClient.post<{ ok: boolean; phone: string }>('/whatsapp/broadcast/invite', { phone, name }),
  send: (topicId: string, message: string) =>
    vpsClient.post<WhatsAppBroadcastSendResult>(`/whatsapp/broadcast/topics/${encodeURIComponent(topicId)}/send`, { message }),
  unsubscribe: (contactId: string) =>
    vpsClient.delete<{ ok: boolean }>(`/whatsapp/broadcast/subscribers/${encodeURIComponent(contactId)}`),
};
