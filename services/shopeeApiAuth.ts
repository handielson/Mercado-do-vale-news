// shopee-api-auth-v1: /api/shopee-catalog e /api/shopee-actions exigem login de admin (ou x-sync-key).
// As telas chamam essas rotas com fetch() direto em vários lugares; este wrapper único acrescenta
// o token do admin só nessas duas rotas do próprio site, sem tocar em outras requisições.
import { getAuthSessionToken } from './authSession';
import { getVpsSyncHeaders } from './vpsProxyBase';

export const SHOPEE_PROTECTED_PATHS = ['/api/shopee-catalog', '/api/shopee-actions'];

export function isProtectedShopeeApiUrl(input: string, origin: string): boolean {
  try {
    const url = new URL(input, origin);
    if (url.origin !== origin) return false;
    return SHOPEE_PROTECTED_PATHS.some((path) => url.pathname === path);
  } catch {
    return false;
  }
}

export function installShopeeApiAuthFetch(target: typeof globalThis = globalThis): void {
  const original = target.fetch?.bind(target);
  if (!original || (original as any).__mdvShopeeAuth) return;
  const wrapped = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const origin = target.location?.origin || '';
    if (!origin || !isProtectedShopeeApiUrl(rawUrl, origin)) return original(input, init);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has('Authorization')) {
      const token = await getAuthSessionToken().catch(() => null);
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
    for (const [key, value] of Object.entries(getVpsSyncHeaders() || {})) {
      if (value && !headers.has(key)) headers.set(key, String(value));
    }
    return original(input, { ...init, headers });
  };
  (wrapped as any).__mdvShopeeAuth = true;
  target.fetch = wrapped as typeof fetch;
}
