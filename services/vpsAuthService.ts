import { buildVpsUrl, VPS_DIRECT_BASE_URL } from './vpsProxyBase';
import type { Customer } from '../types/customer';
import type { CreateAccountData, PasswordResetChannel, VpsUser } from '../types/auth';
import { normalizeCustomerFromVps } from './customers';

export interface VpsAuthSession {
  token: string;
  user: VpsUser;
  customer: Customer;
}

type StoredVpsAuthSession = Pick<VpsAuthSession, 'token' | 'user'>;

const STORAGE_KEY = '@mdv_vps_auth_session';
let memorySession: StoredVpsAuthSession | null = null;

function parseStoredSession(raw: string | null): StoredVpsAuthSession | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as StoredVpsAuthSession;
    return session?.token && session?.user?.id ? session : null;
  } catch {
    return null;
  }
}

function readStoredSession(): StoredVpsAuthSession | null {
  if (memorySession) return memorySession;
  if (typeof window === 'undefined') return null;

  const sessionFallback = parseStoredSession(window.sessionStorage?.getItem(STORAGE_KEY));
  const persistedSession = parseStoredSession(window.localStorage?.getItem(STORAGE_KEY));
  memorySession = sessionFallback || persistedSession;
  return memorySession;
}

function storeSession(session: VpsAuthSession | null): void {
  if (typeof window === 'undefined') return;
  if (!session) {
    memorySession = null;
    window.localStorage?.removeItem(STORAGE_KEY);
    window.sessionStorage?.removeItem(STORAGE_KEY);
    return;
  }

  // Customer records may contain large images/catalog data. Authentication only
  // needs the token and basic user identity between page loads.
  const compactSession: StoredVpsAuthSession = {
    token: session.token,
    user: session.user,
  };
  const serializedSession = JSON.stringify(compactSession);
  memorySession = compactSession;

  try {
    window.localStorage?.setItem(STORAGE_KEY, serializedSession);
    window.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Keep login working when localStorage is full, without deleting unrelated data.
    try {
      window.sessionStorage?.setItem(STORAGE_KEY, serializedSession);
    } catch {
      // The in-memory session still allows the current navigation to continue.
    }
  }
}

function buildAuthUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${VPS_DIRECT_BASE_URL}${normalizedPath}`;
}

function buildAuthRequestUrl(path: string, method: string = 'GET'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return buildVpsUrl(normalizedPath, { method });
}

async function requestAuth(path: string, options: RequestInit = {}): Promise<VpsAuthSession> {
  const session = readStoredSession();
  const response = await fetch(buildAuthRequestUrl(path, options.method || 'GET'), {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `Erro ${response.status}`);
  const responseSession = json as VpsAuthSession;
  const normalizedSession = {
    ...responseSession,
    customer: normalizeCustomerFromVps(responseSession.customer),
  };
  storeSession(normalizedSession);
  return normalizedSession;
}

async function requestAuthJson(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(buildAuthRequestUrl(path, options.method || 'GET'), {
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
  getStoredSession(): StoredVpsAuthSession | null {
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

  async requestPasswordReset(identifier: string, channel: PasswordResetChannel = 'email'): Promise<void> {
    await requestAuthJson('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ channel, identifier }),
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

  startGoogleSignIn(nextPath: string = '/'): void {
    const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
    const url = new URL(buildAuthUrl('/auth/google/start'));
    url.searchParams.set('next', safeNext);
    window.location.assign(url.toString());
  },

  async completeGoogleSignIn(token: string): Promise<VpsAuthSession> {
    if (!token) throw new Error('Token Google ausente');
    const response = await fetch(buildAuthUrl('/auth/me'), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || `Erro ${response.status}`);
    const session = {
      ...(json as VpsAuthSession),
      customer: normalizeCustomerFromVps((json as VpsAuthSession).customer),
    };
    storeSession(session);
    return session;
  },

  async updateProfile(data: Partial<Customer>): Promise<Customer> {
    const session = readStoredSession();
    if (!session?.token) throw new Error('Sessao expirada');
    const updatedSession = await requestAuth('/auth/profile', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.token}` },
      body: JSON.stringify(data),
    });
    return updatedSession.customer;
  },

  async createCustomerLogin(data: { customer_id: string; email?: string; cpf_cnpj: string; password: string }): Promise<void> {
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
