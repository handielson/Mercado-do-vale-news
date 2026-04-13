export const DEFAULT_VIDEO_BASE_URL = 'https://videos.mercadodovale.com.br';

export function normalizeVideoBaseUrl(baseUrl?: string | null): string {
  const trimmed = (baseUrl || '').trim();
  if (!trimmed) return DEFAULT_VIDEO_BASE_URL;
  return trimmed.replace(/\/+$/, '');
}

export function buildProductVideoUrl(baseUrl: string | null | undefined, sku: string, extension = '.mp4'): string {
  const normalizedBaseUrl = normalizeVideoBaseUrl(baseUrl);
  const cleanSku = sku.replace(/\s+/g, '');
  const cleanExtension = extension.startsWith('.') ? extension : `.${extension}`;
  return `${normalizedBaseUrl}/${cleanSku}${cleanExtension}`;
}

export function normalizeProductVideoUrl(url?: string | null): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  return trimmed;
}