function normalizeOrigin(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/\/+$/, '');
}

const DEFAULT_SHOPEE_AUTH_ORIGIN = 'https://www.mercadodovale.com.br';

function normalizeHost(value) {
  return String(value || '').trim().toLowerCase();
}

function isLocalHost(host) {
  return host.includes('localhost') || host.startsWith('127.0.0.1');
}

function isMercadoDoValeHost(host) {
  return host === 'mercadodovale.com.br' || host === 'www.mercadodovale.com.br';
}

export function resolveShopeeAuthOrigin({
  host,
  forwardedProto,
  envOrigin = process.env.SHOPEE_REDIRECT_BASE_URL,
} = {}) {
  const cleanHost = normalizeHost(host);
  const cleanEnvOrigin = normalizeOrigin(envOrigin);

  if (cleanEnvOrigin) {
    return cleanEnvOrigin;
  }

  if (isMercadoDoValeHost(cleanHost) || isLocalHost(cleanHost)) {
    return DEFAULT_SHOPEE_AUTH_ORIGIN;
  }

  return DEFAULT_SHOPEE_AUTH_ORIGIN;
}

export function buildShopeeCallbackUrl(options = {}) {
  return `${resolveShopeeAuthOrigin(options)}/api/shopee?action=callback`;
}
