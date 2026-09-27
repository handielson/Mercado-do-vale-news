import { buildVpsUrl } from './vpsProxyBase';
import { print3dCaptchaToken } from './print3dTurnstile';

// Credenciais do Mercado do Vale nunca entram nas requisições de conta 3D.
const SESSION_KEY = 'print3d_customer_session_v1';
const GOOGLE_PROOF_KEY = 'print3d_google_browser_verifier';
let googleCompletion: { code: string; promise: Promise<Customer> } | undefined;
type Customer = { id: string; name: string; email: string | null; phone?: string | null };
type Session = { token: string; customer: Customer };
type PhoneChallenge = { challenge_id: string; expires_in: number; retry_after: number };
type PhoneProof = { phone_verification_token: string; expires_in: number };

async function request<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const method = body === undefined ? 'GET' : 'POST';
  const payload = body === undefined ? undefined : { ...(body as Record<string, unknown>), captcha_token: await print3dCaptchaToken() };
  const response = await fetch(buildVpsUrl(`/print3d/auth${path}`, { method }), {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    cache: 'no-store',
    credentials: 'omit',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(
    response.status === 503 ? 'As contas da loja 3D ainda não estão disponíveis.'
      : typeof data.error === 'string' ? data.error : 'Não foi possível concluir a solicitação.'
  ), { statusCode: response.status });
  return data as T;
}

export const print3dAccountClient = {
  requestStore: async <T>(path: string, body?: unknown): Promise<T> => {
    const method = body === undefined ? 'GET' : 'POST';
    const orderPath = /^\/print3d\/orders\/[0-9a-f-]{36}(?:\/(?:payment(?:\/refresh)?|cancel))?$/i.test(path);
    const allowed = method === 'GET'
      ? ['/print3d/production', '/print3d/checkout', '/print3d/orders'].includes(path) || orderPath && !path.endsWith('/refresh')
      : path === '/print3d/checkout' || orderPath && /\/(?:payment(?:\/refresh)?|cancel)$/.test(path);
    if (!allowed) throw new Error('Área da loja inválida.');
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token && path !== '/print3d/checkout') throw new Error('Entre na sua conta 3D para continuar.');
    if (!token && method === 'POST') throw new Error('Entre na sua conta 3D para confirmar seu pedido.');
    const response = await fetch(buildVpsUrl(path, { method }), {
      method, body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: 'omit', cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 401
      ? 'Sua sessão expirou. Entre novamente na conta 3D.'
      : response.status === 503 ? 'Esta função da loja 3D ainda não está disponível.'
      : typeof data.error === 'string' ? data.error : 'Não foi possível concluir a solicitação.');
    return data as T;
  },
  googleConfig: () => request<{ configured: boolean }>('/google/config'),
  beginGoogle: async (link = false) => {
    const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const browser_challenge = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(GOOGLE_PROOF_KEY, verifier);
    const result = await request<{ url: string }>('/google/prepare', { link, browser_challenge }, link ? sessionStorage.getItem(SESSION_KEY) || undefined : undefined);
    window.location.assign(result.url);
  },
  completeGoogle: (code: string): Promise<Customer> => {
    if (googleCompletion?.code === code) return googleCompletion.promise;
    const promise = (async () => {
      const browser_verifier = sessionStorage.getItem(GOOGLE_PROOF_KEY);
      if (!browser_verifier || !/^[a-f0-9]{64}$/.test(code)) throw new Error('Reinicie o acesso com Google neste navegador.');
      try {
        const session = await request<Session>('/google/exchange', { code, browser_verifier }, sessionStorage.getItem(SESSION_KEY) || undefined);
        sessionStorage.setItem(SESSION_KEY, session.token);
        return session.customer;
      } finally { sessionStorage.removeItem(GOOGLE_PROOF_KEY); }
    })();
    googleCompletion = { code, promise };
    return promise;
  },
  registerEmail: (name: string, email: string, password: string, cpf?: string) =>
    request<{ message: string }>('/register', { name, email, password, cpf, verification_method: 'email' }),
  registerWhatsApp: async (name: string, phone: string, password: string, proof: string, cpf?: string) => {
    const session = await request<Session>('/register', { name, phone, password, cpf,
      phone_verification_token: proof, verification_method: 'whatsapp' });
    sessionStorage.setItem(SESSION_KEY, session.token);
    return session.customer;
  },
  requestRegistrationPhoneCode: (phone: string) => request<PhoneChallenge>('/phone/register/request', { phone }),
  verifyRegistrationPhoneCode: (challengeId: string, code: string) =>
    request<PhoneProof>('/phone/register/verify', { challenge_id: challengeId, code }),
  resendVerification: (email: string) => request<{ message: string }>('/verification/request', { email }),
  verifyEmail: (token: string) => request<{ verified: true }>('/verify-email', { token }),
  login: async (identifierType: 'email' | 'phone' | 'cpf', identifier: string, password: string) => {
    const session = await request<Session>('/login', { identifier_type: identifierType, identifier, password });
    sessionStorage.setItem(SESSION_KEY, session.token);
    return session.customer;
  },
  requestPasswordReset: (email: string) => request<{ message: string }>('/password/request', { email }),
  resetPassword: (token: string, password: string) => request<{ changed: true }>('/password/reset', { token, password }),
  requestPhonePasswordReset: (phone: string) => request<PhoneChallenge | { message: string }>('/password/phone/request', { phone }),
  verifyPhonePasswordReset: (phone: string, challengeId: string, code: string) =>
    request<PhoneProof>('/password/phone/verify', { phone, challenge_id: challengeId, code }),
  resetPasswordWithPhone: (phone: string, proof: string, password: string) =>
    request<{ changed: true }>('/password/phone/confirm', { phone, phone_verification_token: proof, password }),
  requestProfilePhoneCode: (phone: string) => request<PhoneChallenge>('/phone/request', { phone }, sessionStorage.getItem(SESSION_KEY) || undefined),
  verifyProfilePhoneCode: (challengeId: string, code: string) =>
    request<PhoneProof>('/phone/verify', { challenge_id: challengeId, code }, sessionStorage.getItem(SESSION_KEY) || undefined),
  confirmProfilePhone: (phone: string, proof: string) =>
    request<{ verified: true; phone: string }>('/phone/confirm', { phone, phone_verification_token: proof }, sessionStorage.getItem(SESSION_KEY) || undefined),
  phoneStatus: () => request<{ phone: string | null; verified: boolean }>('/phone/status', undefined, sessionStorage.getItem(SESSION_KEY) || undefined),
  me: async () => {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return null;
    try { return (await request<{ customer: Customer }>('/me', undefined, token)).customer; }
    catch (cause) {
      if ((cause as { statusCode?: number })?.statusCode === 401) {
        // A response for a previous session must not erase a newer login.
        if (sessionStorage.getItem(SESSION_KEY) === token) sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      throw cause;
    }
  },
  logout: () => sessionStorage.removeItem(SESSION_KEY),
};
