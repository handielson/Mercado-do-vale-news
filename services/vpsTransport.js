const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

export const DEFAULT_VPS_BASE_URL = 'https://api.xiaomipetrolina.com.br';
export const DEV_VPS_PROXY_BASE = '/vps-proxy';
// Rota separada: o preview local nunca depende da decisÃ£o do proxy remoto.
export const DEV_CATALOG_PREVIEW_PROXY_BASE = '/local-catalog-preview';
export const PROD_VPS_PROXY_BASE = '/api/vps-proxy';

const PUBLIC_READ_EXACT_PATHS = new Set([
  '/banners',
  '/battery-healths',
  '/brands',
  '/catalog-settings',
  '/catalog/metadata',
  '/categories',
  '/check-video',
  '/field-presets',
  '/payment-fees',
  '/public/company-settings',
  '/public/check-video',
  '/rams',
  '/shipping/settings',
  '/shipping/zones',
  '/status',
  '/storages',
  '/versions',
  '/warranty-templates',
]);

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

function normalizeVpsMethod(method) {
  return String(method || 'GET').trim().toUpperCase() || 'GET';
}

function getVpsPathname(path) {
  const normalizedPath = normalizeVpsPath(path);
  try {
    return new URL(normalizedPath, DEFAULT_VPS_BASE_URL).pathname;
  } catch {
    return normalizedPath.split('?')[0] || '/';
  }
}

function isLocalCatalogPreviewPath(path, method = 'GET') {
  const pathname = getVpsPathname(path);
  const normalizedMethod = normalizeVpsMethod(method);
  const productId = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  if (pathname === '/products/batch' && normalizedMethod === 'POST') return true;
  if (new RegExp(`^/products/${productId}$`, 'i').test(pathname) && ['GET', 'PUT'].includes(normalizedMethod)) return true;
  if (new RegExp(`^/admin/products/${productId}/storefront-offers$`, 'i').test(pathname) && normalizedMethod === 'GET') return true;
  if (new RegExp(`^/admin/products/${productId}/storefront-offers/(mercado_do_vale|loja_3d)$`, 'i').test(pathname) && normalizedMethod === 'PUT') return true;
  if (pathname === '/storefronts/loja_3d/products' && normalizedMethod === 'GET') return true;
  if (new RegExp(`^/storefronts/loja_3d/products/${productId}$`, 'i').test(pathname) && normalizedMethod === 'GET') return true;
  if (pathname === '/admin/local-preview/drafts' && normalizedMethod === 'GET') return true;
  return new RegExp(`^/admin/local-preview/drafts/${productId}/approve$`, 'i').test(pathname) && normalizedMethod === 'POST';
}

function shouldUseLocalCatalogPreview(env = {}, runtimeHostname, path, method) {
  const isDevBuild = env.MODE !== 'production' && Boolean(env.DEV);
  return (isDevBuild || isLocalHostname(runtimeHostname)) && isLocalCatalogPreviewPath(path, method);
}

function isPublicProductReadPath(pathname) {
  if (pathname === '/products' || pathname === '/products/category-counts') {
    return true;
  }

  if (/^\/products\/by-category\/[^/]+$/u.test(pathname)) {
    return true;
  }

  if (/^\/products\/by-(?:slug|ean)\/[^/]+$/u.test(pathname)) {
    return true;
  }

  if (/^\/products\/[^/]+\/combo$/u.test(pathname)) {
    return true;
  }

  if (/^\/products\/[^/]+$/u.test(pathname)) {
    return true;
  }

  return false;
}

function isPublicReadPath(pathname) {
  if (PUBLIC_READ_EXACT_PATHS.has(pathname)) {
    return true;
  }

  if (pathname.startsWith('/coupons/validate/')) {
    return true;
  }

  if (pathname.startsWith('/video/')) {
    return true;
  }

  if (/^\/versions\/[^/]+$/u.test(pathname)) {
    return true;
  }

  if (/^\/public\/products\/[^/]+\/reviews$/u.test(pathname)) {
    return true;
  }

  if (/^\/delivery\/jobs\/[^/]+$/u.test(pathname)) {
    return true;
  }

  if (/^\/delivery\/tracking\/[^/]+$/u.test(pathname)) {
    return true;
  }

  if (pathname === '/storefronts/loja_3d/products'
    || pathname === '/storefronts/loja_3d/settings'
    || pathname === '/print3d/auth/google/config'
    || pathname === '/print3d/auth/phone/status') {
    return true;
  }

  return isPublicProductReadPath(pathname);
}

function isPublicWritePath(pathname, method) {
  if (method === 'POST' && pathname === '/public/feedback') {
    return true;
  }

  if (method === 'POST' && /^\/products\/[^/]+\/view$/u.test(pathname)) {
    return true;
  }

  if (method === 'POST' && /^\/banners\/[^/]+\/(?:click|view)$/u.test(pathname)) {
    return true;
  }

  if (method === 'POST' && /^\/delivery\/jobs\/[^/]+\/(?:pix-intent|payment-status|start-route|proof|complete)$/u.test(pathname)) {
    return true;
  }

  if (method === 'POST' && [
    '/storefronts/loja_3d/quote',
    '/storefronts/loja_3d/shipping/quote',
    '/storefronts/loja_3d/deadline-requests',
    '/storefronts/loja_3d/maintenance-preview/verify',
  ].includes(pathname)) {
    return true;
  }

  return false;
}

export function isPublicVpsPath(path, method = 'GET') {
  const normalizedMethod = normalizeVpsMethod(method);
  const pathname = getVpsPathname(path);

  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') {
    return isPublicReadPath(pathname);
  }

  return isPublicWritePath(pathname, normalizedMethod);
}

function getProxyBase(env = {}, runtimeHostname) {
  const isProductionMode = env.MODE === 'production';
  const isDevBuild = !isProductionMode && Boolean(env.DEV);
  const forceLocalProxy = env.VITE_FORCE_LOCAL_VPS_PROXY === '1';

  if (isDevBuild || forceLocalProxy || isLocalHostname(runtimeHostname)) {
    return DEV_VPS_PROXY_BASE;
  }

  return PROD_VPS_PROXY_BASE;
}

export function resolveVpsBase(env = {}, runtimeHostname, path, method = 'GET') {
  const proxyBase = getProxyBase(env, runtimeHostname);
  const allowDirectPublicVps = env.VITE_ALLOW_DIRECT_PUBLIC_VPS === '1';
  const forceVpsProxy = env.VITE_FORCE_VPS_PROXY === '1';

  if (proxyBase === DEV_VPS_PROXY_BASE) {
    return proxyBase;
  }

  if ((allowDirectPublicVps || !forceVpsProxy) && path && isPublicVpsPath(path, method)) {
    return normalizeVpsBase(env.VITE_VPS_BASE_URL || DEFAULT_VPS_BASE_URL);
  }

  return proxyBase;
}

export function buildVpsUrl(path, options = {}) {
  const normalizedPath = normalizeVpsPath(path);
  const base = options.base || (shouldUseLocalCatalogPreview(
    options.env || {}, options.runtimeHostname, normalizedPath, options.method,
  ) ? DEV_CATALOG_PREVIEW_PROXY_BASE : resolveVpsBase(
    options.env || {},
    options.runtimeHostname,
    normalizedPath,
    options.method,
  ));

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
