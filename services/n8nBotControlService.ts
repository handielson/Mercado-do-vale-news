import { vpsClient } from './vpsClient';

export type N8nBotClientControl = {
  id?: string;
  remote_jid: string;
  phone: string;
  blocked: boolean | number;
  block_reason?: string | null;
  blocked_at?: string | null;
  blocked_by?: string | null;
  reset_requested_at?: string | null;
  reset_consumed_at?: string | null;
  reset_count: number;
  last_seen_at?: string | null;
  updated_at?: string | null;
};

export type N8nBotControlLookup = {
  control: N8nBotClientControl;
  memorySessionKey: string;
  resetPending: boolean;
};

export type N8nBotConversation = {
  remote_jid: string;
  phone: string;
  contact_name?: string | null;
  last_message_at?: string | null;
  last_message?: string | null;
  last_direction?: 'inbound' | 'outbound' | 'internal' | string | null;
  total_messages: number;
  inbound_count: number;
  outbound_count: number;
  blocked?: boolean | number | null;
  block_reason?: string | null;
  reset_count?: number;
  reset_requested_at?: string | null;
  reset_consumed_at?: string | null;
  control_updated_at?: string | null;
};

export type N8nBotMessage = {
  id: number;
  remote_jid: string;
  phone: string;
  contact_name?: string | null;
  direction: 'inbound' | 'outbound' | 'internal' | string;
  message_text: string;
  message_type?: string | null;
  source_node?: string | null;
  wa_message_id?: string | null;
  created_at?: string | null;
};

function buildQuery(params: Record<string, string>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value.trim()) search.set(key, value.trim());
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const n8nBotControlService = {
  lookup(params: { phone?: string; remoteJid?: string }) {
    return vpsClient.get<N8nBotControlLookup>(
      `/n8n-bot/client-control${buildQuery({
        phone: params.phone || '',
        remoteJid: params.remoteJid || '',
      })}`,
    );
  },

  recent() {
    return vpsClient.get<{ rows: N8nBotClientControl[] }>('/n8n-bot/client-control');
  },

  setBlocked(params: { phone?: string; remoteJid?: string; blocked: boolean; reason?: string; blockedBy?: string }) {
    return vpsClient.post<N8nBotControlLookup>('/n8n-bot/client-control/block', {
      phone: params.phone,
      remoteJid: params.remoteJid,
      blocked: params.blocked,
      reason: params.reason,
      blockedBy: params.blockedBy,
    });
  },

  reset(params: { phone?: string; remoteJid?: string; blockedBy?: string }) {
    return vpsClient.post<N8nBotControlLookup>('/n8n-bot/client-control/reset', {
      phone: params.phone,
      remoteJid: params.remoteJid,
      blockedBy: params.blockedBy,
    });
  },

  listConversations(params: { limit?: number } = {}) {
    return vpsClient.get<{ rows: N8nBotConversation[] }>(
      `/n8n-bot/conversations${buildQuery({ limit: params.limit ? String(params.limit) : '' })}`,
    );
  },

  listMessages(params: { phone?: string; remoteJid?: string; limit?: number; afterId?: number }) {
    return vpsClient.get<{ rows: N8nBotMessage[] }>(
      `/n8n-bot/messages${buildQuery({
        phone: params.phone || '',
        remoteJid: params.remoteJid || '',
        limit: params.limit ? String(params.limit) : '',
        afterId: params.afterId ? String(params.afterId) : '',
      })}`,
    );
  },
};
