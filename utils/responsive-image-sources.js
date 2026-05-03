const PRODUCT_WIDTHS = [320, 480, 800];
const BANNER_WIDTHS = [768, 1280];
const SOURCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const DERIVATIVE_FORMATS = ['avif', 'webp'];

const PRODUCT_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 242px';
const BANNER_SIZES = '(max-width: 768px) 100vw, 1280px';

const isInlineOrBlobUrl = (url) => /^(data|blob):/i.test(url);
const isBlingProxyUrl = (url) => url.startsWith('/api/bling') || url.includes('/api/bling?');

function splitUrl(rawUrl) {
  const hashIndex = rawUrl.indexOf('#');
  const beforeHash = hashIndex >= 0 ? rawUrl.slice(0, hashIndex) : rawUrl;
  const hash = hashIndex >= 0 ? rawUrl.slice(hashIndex) : '';
  const queryIndex = beforeHash.indexOf('?');

  return {
    pathname: queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash,
    search: queryIndex >= 0 ? beforeHash.slice(queryIndex) : '',
    hash,
  };
}

function getExtension(pathname) {
  const match = pathname.match(/(\.[a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

export function deriveImageVariantUrl(rawUrl, width, format) {
  const { pathname, search, hash } = splitUrl(rawUrl);
  const extension = getExtension(pathname);
  if (!SOURCE_EXTENSIONS.has(extension)) return null;

  return `${pathname.slice(0, -extension.length)}-${width}.${format}${search}${hash}`;
}

function canBuildSources(rawUrl, kind) {
  if (!rawUrl || isInlineOrBlobUrl(rawUrl) || isBlingProxyUrl(rawUrl)) return false;
  const { pathname } = splitUrl(rawUrl);
  const extension = getExtension(pathname);
  if (!SOURCE_EXTENSIONS.has(extension)) return false;

  const lowerPath = pathname.toLowerCase();
  if (kind === 'banner') return lowerPath.includes('/banners/');
  return lowerPath.includes('/products/') || lowerPath.includes('/legacy/external/');
}

export function buildResponsiveImageSources(rawUrl, options = {}) {
  const kind = options.kind === 'banner' ? 'banner' : 'product';
  if (!canBuildSources(rawUrl, kind)) return null;

  const widths = kind === 'banner' ? BANNER_WIDTHS : PRODUCT_WIDTHS;
  const byFormat = Object.fromEntries(
    DERIVATIVE_FORMATS.map((format) => [
      format,
      widths
        .map((width) => `${deriveImageVariantUrl(rawUrl, width, format)} ${width}w`)
        .join(', '),
    ]),
  );

  return {
    avifSrcSet: byFormat.avif,
    webpSrcSet: byFormat.webp,
    sizes: kind === 'banner' ? BANNER_SIZES : PRODUCT_SIZES,
  };
}
