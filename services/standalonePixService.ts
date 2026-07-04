import { vpsClient } from './vpsClient';
import type {
  GoogleContactOption,
  StandalonePixCreateInput,
  StandalonePixListFilters,
  StandalonePixPayment,
  StandalonePixShareResponse,
} from '../types/standalonePix';

function buildQuery(filters: StandalonePixListFilters = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const standalonePixService = {
  async create(input: StandalonePixCreateInput): Promise<StandalonePixPayment> {
    return vpsClient.post<StandalonePixPayment>('/pix/standalone', input);
  },

  async list(filters: StandalonePixListFilters = {}): Promise<StandalonePixPayment[]> {
    const response = await vpsClient.get<{ data: StandalonePixPayment[] }>('/pix/standalone' + buildQuery(filters));
    return Array.isArray(response.data) ? response.data : [];
  },

  async refreshStatus(id: string): Promise<StandalonePixPayment> {
    return vpsClient.get<StandalonePixPayment>(`/pix/standalone/${encodeURIComponent(id)}/status`);
  },

  async cancel(id: string): Promise<StandalonePixPayment> {
    return vpsClient.post<StandalonePixPayment>(`/pix/standalone/${encodeURIComponent(id)}/cancel`, {});
  },

  async shareWhatsApp(id: string, phone: string): Promise<StandalonePixShareResponse> {
    return vpsClient.post<StandalonePixShareResponse>(`/pix/standalone/${encodeURIComponent(id)}/share-whatsapp`, { phone });
  },

  async searchGoogleContacts(query: string): Promise<GoogleContactOption[]> {
    const response = await vpsClient.get<{ data: GoogleContactOption[] }>('/google-contacts/search' + buildQuery({ q: query, limit: 8 } as any));
    return Array.isArray(response.data) ? response.data : [];
  },

  async getPublic(token: string): Promise<StandalonePixPayment> {
    return vpsClient.get<StandalonePixPayment>(`/pix/public/${encodeURIComponent(token)}`);
  },
};
