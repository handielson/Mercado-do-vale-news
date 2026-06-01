import { VPS_DIRECT_BASE_URL } from './vpsProxyBase';
import type { Customer } from '../types/customer';
import type { CreateAccountData, VpsUser } from '../types/auth';

export interface VpsAuthSession {
  token: string;
  user: VpsUser;
  customer: Customer;
}

const STORAGE_KEY = '@mdv_vps_auth_session';

function readStoredSession(): VpsAuthSession | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as VpsAuthSession : null;
  } catch {
    return null;
  }
}

function storeSession(session: VpsAuthSession | null): void {
  if (typeof localStorage === 'undefined') return;
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function buildAuthUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${VPS_DIRECT_BASE_URL}${normalizedPath}`;
}

async function requestAuth(path: string, options: RequestInit = {}): Promise<VpsAuthSession> {
  const session = readStoredSession();
  const response = await fetch(buildAuthUrl(path), {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `Erro ${response.status}`);
  storeSession(json as VpsAuthSession);
  return json as VpsAuthSession;
}

async function requestAuthJson(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(buildAuthUrl(path), {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `Erro ${response.status}`);
  return json;
}

export const vpsAuthService = {
  getStoredSession(): VpsAuthSession | null {
    return readStoredSession();
  },

  getStoredToken(): string {
    return readStoredSession()?.token || '';
  },

  async getSession(): Promise<VpsAuthSession | null> {
    const session = readStoredSession();
    if (!session?.token) return null;
    try {
      return await requestAuth('/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.token}` },
      });
    } catch {
      storeSession(null);
      return null;
    }
  },

  async signInWithEmail(email: string, password: string): Promise<VpsAuthSession> {
    return requestAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async signInWithCpf(cpf_cnpj: string, password: string): Promise<VpsAuthSession> {
    return requestAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ cpf_cnpj, password }),
    });
  },

  async createAccount(data: CreateAccountData): Promise<VpsAuthSession> {
    return requestAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async requestPasswordReset(email: string): Promise<void> {
    await requestAuthJson('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async confirmPasswordReset(token: string, password: string): Promise<void> {
    await requestAuthJson('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  async updatePassword(password: string, resetToken?: string): Promise<void> {
    if (resetToken) {
      await this.confirmPasswordReset(resetToken, password);
      return;
    }
    const session = readStoredSession();
    if (!session?.token) throw new Error('Sessao expirada');
    await requestAuth('/auth/password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ password }),
    });
  },

  async createCustomerLogin(data: { customer_id: string; email: string; cpf_cnpj: string; password: string }): Promise<void> {
    const session = readStoredSession();
    const response = await fetch(buildAuthUrl('/auth/admin/users'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || `Erro ${response.status}`);
  },

  signOut(): void {
    storeSession(null);
  },
};
