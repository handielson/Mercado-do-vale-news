const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

export const DEFAULT_VPS_BASE_URL = 'https://api.xiaomipetrolina.com.br';

function normalizeVpsBase(base) {
  return String(base || DEFAULT_VPS_BASE_URL).trim().replace(/\/+$/, '');
}

function normalizeVpsPath(path) {
  const raw = String(path || '').trim();
  if (!raw) return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function isLocalHostname(hostname) {
  return typeof hostname === 'string' && LOCAL_HOSTNAMES.has(hostname);
}

export function isProxyBase(base) {
  return typeof base === 'string' && base.startsWith('/');
}

export function resolveVpsBase(env = {}, runtimeHostname) {
  const isDevBuild = Boolean(env.DEV);
  const forceLocalProxy = env.VITE_FORCE_LOCAL_VPS_PROXY === '1';

  if (isDevBuild || forceLocalProxy || isLocalHostname(runtimeHostname)) {
    return '/vps-proxy';
  }

  return normalizeVpsBase(env.VITE_VPS_BASE_URL || DEFAULT_VPS_BASE_URL);
}

export function buildVpsUrl(path, options = {}) {
  const normalizedPath = normalizeVpsPath(path);
  const base = options.base || resolveVpsBase(options.env || {}, options.runtimeHostname);

  if (isProxyBase(base)) {
    return `${base}?path=${encodeURIComponent(normalizedPath)}`;
  }

  return `${normalizeVpsBase(base)}${normalizedPath}`;
}

export function getVpsSyncKey(env = {}) {
  return String(env.VITE_VPS_SYNC_KEY || '').trim();
}

export function getVpsSyncHeaders(env = {}) {
  const syncKey = getVpsSyncKey(env);
  return syncKey ? { 'x-sync-key': syncKey } : {};
}
