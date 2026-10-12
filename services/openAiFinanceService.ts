import { vpsClient } from './vpsClient';
import { getVpsSyncHeaders } from './vpsProxyBase';
import { getAuthSessionToken } from './authSession';
export interface OpenAiFinance {
  status: string; days: number; start_time: number; end_time: number; updated_at: string | null;
  balance_usd: null; balance_status: string; usage_status?: string;
  costs: null | { total_usd: number; daily: Array<{ date: string; cost_usd: number }>; items: Array<{ name: string; cost_usd: number }>; projects: Array<{ name: string; cost_usd: number }> };
  models: null | Array<{ model: string; requests: number; input_tokens: number; cached_tokens: number; output_tokens: number }>;
}
export async function getOpenAiFinance(days: number): Promise<OpenAiFinance> {
  if (import.meta.env.DEV) {
    const token = await getAuthSessionToken();
    const response = await fetch(`/local-ai-finance/finance?days=${days}`, { headers: { ...getVpsSyncHeaders(), Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(55000) });
    if (!response.ok) throw new Error('Consulta indisponível. Inicie o preview financeiro local.');
    return response.json();
  }
  return vpsClient.get(`/admin/openai/finance?days=${days}`, { timeoutMs: 55000 });
}
