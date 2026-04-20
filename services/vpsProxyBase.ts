import {
  DEFAULT_VPS_BASE_URL,
  buildVpsUrl as buildVpsUrlInternal,
  getVpsSyncHeaders as getVpsSyncHeadersInternal,
  getVpsSyncKey as getVpsSyncKeyInternal,
  resolveVpsBase,
} from './vpsTransport.js';

const env = (import.meta as any).env ?? {};
const runtimeHostname = typeof window !== 'undefined' ? window.location.hostname : undefined;

export const VPS_PROXY_BASE = resolveVpsBase(env, runtimeHostname);
export const VPS_DIRECT_BASE_URL = String(env.VITE_VPS_BASE_URL || DEFAULT_VPS_BASE_URL)
  .trim()
  .replace(/\/+$/, '');
export const IS_VPS_PROXY_ROUTE = VPS_PROXY_BASE.startsWith('/');

export function buildVpsUrl(path: string): string {
  return buildVpsUrlInternal(path, { base: VPS_PROXY_BASE });
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
