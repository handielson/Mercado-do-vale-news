import { storefrontCaptchaToken } from './print3dTurnstile';

const paths = new Set(['/auth/login', '/auth/register', '/auth/password', '/auth/password-reset/request',
  '/auth/password-reset/confirm', '/auth/phone/request', '/auth/phone/verify']);

export async function protectAuthRequest(path: string, options: RequestInit): Promise<RequestInit> {
  if (import.meta.env.VITE_MDV_AUTH_SECURITY_ENABLED !== '1'
    || options.method !== 'POST' || !paths.has(path)) return options;
  const captcha_token = await storefrontCaptchaToken(import.meta.env.VITE_MDV_TURNSTILE_SITE_KEY, 'mdv_auth');
  return { ...options, body: JSON.stringify({ ...JSON.parse(String(options.body || '{}')), captcha_token }) };
}
