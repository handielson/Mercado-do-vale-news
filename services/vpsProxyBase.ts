import {
  DEFAULT_VPS_BASE_URL,
  buildVpsUrl as buildVpsUrlInternal,
  getVpsSyncHeaders as getVpsSyncHeadersInternal,
  getVpsSyncKey as getVpsSyncKeyInternal,
  isProxyBase,
  resolveVpsBase,
} from './vpsTransport.js';

const viteEnv = (import.meta as any).env ?? {};
const env = {
  DEV: Boolean(viteEnv.DEV),
  MODE: String(viteEnv.MODE || ''),
  VITE_ALLOW_DIRECT_PUBLIC_VPS: viteEnv.VITE_ALLOW_DIRECT_PUBLIC_VPS,
  VITE_FORCE_LOCAL_VPS_PROXY: viteEnv.VITE_FORCE_LOCAL_VPS_PROXY,
  VITE_FORCE_VPS_PROXY: viteEnv.VITE_FORCE_VPS_PROXY,
  VITE_VPS_BASE_URL: viteEnv.VITE_VPS_BASE_URL,
  VITE_VPS_SYNC_KEY: viteEnv.VITE_VPS_SYNC_KEY,
};
const runtimeHostname = typeof window !== 'undefined' ? window.location.hostname : undefined;

export const VPS_PROXY_BASE = resolveVpsBase(env, runtimeHostname);
export const VPS_DIRECT_BASE_URL = String(env.VITE_VPS_BASE_URL || DEFAULT_VPS_BASE_URL)
  .trim()
  .replace(/\/+$/, '');
export const IS_VPS_PROXY_ROUTE = VPS_PROXY_BASE.startsWith('/');

export function isVpsProxyPath(path: string, method: string = 'GET'): boolean {
  return isProxyBase(resolveVpsBase(env, runtimeHostname, path, method));
}

export function buildVpsUrl(path: string, options: { method?: string } = {}): string {
  return buildVpsUrlInternal(path, {
    env,
    runtimeHostname,
    method: options.method,
  });
}

export function getVpsSyncKey(): string {
  return getVpsSyncKeyInternal(env);
}

export function getVpsSyncHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...getVpsSyncHeadersInternal(env),
    ...extra,
  };
}
