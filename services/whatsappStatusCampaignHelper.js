export const MAX_STATUS_PRODUCTS_PER_RUN = 10;
export const DEFAULT_STATUS_INTERVAL_MINUTES = 30;
const PUBLIC_STATUS_IMAGE_ORIGIN = 'https://imagens.xiaomipetrolina.com.br';
const PUBLIC_VPS_API_ORIGIN = 'https://api.xiaomipetrolina.com.br';

export function toPublicCatalogStoryMediaUrl(value) {
  const rawUrl = String(value || '').trim();
  if (/^https:\/\//i.test(rawUrl)) return rawUrl;
  if (!rawUrl) return '';

  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    if (parsed.pathname.endsWith('/vps-proxy')) {
      const proxiedPath = String(parsed.searchParams.get('path') || '').trim();
      if (/^https:\/\//i.test(proxiedPath)) return proxiedPath;
      if (!proxiedPath.startsWith('/')) return '';
      const origin = /^\/status-[^/]+/i.test(proxiedPath)
        ? PUBLIC_STATUS_IMAGE_ORIGIN
        : PUBLIC_VPS_API_ORIGIN;
      return `${origin}${proxiedPath}`;
    }
    if (parsed.pathname === '/api/bling' && parsed.searchParams.get('resource') === 'image-proxy') {
      const originalUrl = String(parsed.searchParams.get('url') || '').trim();
      return /^https:\/\//i.test(originalUrl) ? originalUrl : '';
    }
  } catch {}

  return '';
}

export function clampDailyProductLimit(value) {
  const parsed = Math.floor(Number(value) || 0);
  return Math.max(1, Math.min(MAX_STATUS_PRODUCTS_PER_RUN, parsed));
}

function normalizeIntervalMinutes(value) {
  const parsed = Math.floor(Number(value) || DEFAULT_STATUS_INTERVAL_MINUTES);
  return Math.max(1, parsed);
}

function padTimePart(value) {
  return String(value).padStart(2, '0');
}

function minutesToTime(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${padTimePart(hours)}:${padTimePart(mins)}`;
}

function timeToMinutes(time) {
  const [hours = '0', minutes = '0'] = String(time || '08:00').split(':');
  return Math.max(0, Math.min(1439, Number(hours) * 60 + Number(minutes)));
}

export function resolveScheduledSendTimes({ startTime = '08:00', count = 1, intervalMinutes = DEFAULT_STATUS_INTERVAL_MINUTES } = {}) {
  const safeCount = clampDailyProductLimit(count);
  const safeInterval = normalizeIntervalMinutes(intervalMinutes);
  const start = timeToMinutes(startTime);
  return Array.from({ length: safeCount }, (_, index) => minutesToTime(start + index * safeInterval));
}

export function getStatusProductImage(product, includePrice = true) {
  if (includePrice) return String(product?.marketing_background_url || '').trim();
  const directNoPrice = String(product?.marketing_background_no_price_url || '').trim();
  if (directNoPrice) return directNoPrice;
  const sourceProducts = Array.isArray(product?.status_group_products) && product.status_group_products.length
    ? [product, ...product.status_group_products]
    : [product];
  for (const item of sourceProducts) {
    const noPriceImage = String(item?.marketing_background_no_price_url || '').trim();
    if (noPriceImage) return noPriceImage;
  }
  for (const item of sourceProducts) {
    const images = Array.isArray(item?.images) ? item.images : [];
    const image = String(item?.image_url || images[0] || '').trim();
    if (image) return image;
  }
  return '';
}

function hasUsableImage(product, includePrice = true) {
  return Boolean(getStatusProductImage(product, includePrice));
}

function hasStock(product) {
  return Number(product?.stock_quantity ?? 0) > 0 || product?.track_inventory === false;
}

function parseStatusJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeStatusText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleStatusText(value) {
  return String(value || '').trim();
}

export function normalizeStatusMemoryLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const compact = text.replace(/\s+/g, '').toUpperCase();
  return compact
    .replace(/(\d+)G$/i, '$1GB')
    .replace(/(\d+)T$/i, '$1TB');
}

function statusSpecValue(product, keys) {
  const specs = parseStatusJson(product?.specs);
  const customFields = parseStatusJson(product?.custom_fields);
  for (const source of [specs, customFields]) {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== undefined && value !== null && String(value).trim()) return value;
    }
  }
  return '';
}

export function getStatusProductVariation(product) {
  const ram = normalizeStatusMemoryLabel(statusSpecValue(product, ['ram', 'memoria_ram', 'memory_ram', 'RAM']));
  const storage = normalizeStatusMemoryLabel(statusSpecValue(product, ['storage', 'armazenamento', 'memoria', 'memoria_interna', 'capacity']));
  const color = titleStatusText(statusSpecValue(product, ['color', 'cor', 'colour', 'Color', 'Cor']));

  return { ram, storage, color };
}

function extractMemoryFromName(product) {
  const name = String(product?.name || '');
  const slashMatch = name.match(/\b(\d+\s*(?:gb|g|tb|t))\s*\/\s*(\d+\s*(?:gb|g|tb|t))\b/i);
  if (slashMatch) {
    return {
      ram: normalizeStatusMemoryLabel(slashMatch[1]),
      storage: normalizeStatusMemoryLabel(slashMatch[2]),
    };
  }
  const pairMatch = name.match(/\b(\d+\s*(?:gb|g))\s+(?:ram\s+)?(\d+\s*(?:gb|g|tb|t))\b/i);
  if (pairMatch) {
    return {
      ram: normalizeStatusMemoryLabel(pairMatch[1]),
      storage: normalizeStatusMemoryLabel(pairMatch[2]),
    };
  }
  return { ram: '', storage: '' };
}

function getStatusProductGroupName(product, variation) {
  let name = String(product?.model || product?.name || 'Produto').trim();
  for (const part of [variation?.ram, variation?.storage, variation?.color]) {
    if (!part) continue;
    name = name.replace(new RegExp(`\\b${String(part).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), ' ');
  }
  return name.replace(/\s+-\s*$/, '').replace(/\s+/g, ' ').trim() || String(product?.name || 'Produto').trim();
}

function colorSortKey(product) {
  const variation = getStatusProductVariation(product);
  return normalizeStatusText(variation.color || product?.name || product?.sku || product?.id);
}

function chooseStatusRepresentative(products) {
  return [...products]
    .sort((a, b) => colorSortKey(a).localeCompare(colorSortKey(b), 'pt-BR'))
    .find(hasUsableImage) || products[0];
}

export function groupStatusProductsByVariation(products) {
  const groups = new Map();

  for (const product of Array.isArray(products) ? products : []) {
    const explicit = getStatusProductVariation(product);
    const fromName = extractMemoryFromName(product);
    const variation = {
      ram: explicit.ram || fromName.ram,
      storage: explicit.storage || fromName.storage,
      color: explicit.color,
    };
    const groupName = getStatusProductGroupName(product, variation);
    const modelKey = product?.model_id || normalizeStatusText(groupName);
    const key = [
      modelKey,
      product?.model_id ? '' : normalizeStatusText(groupName),
      normalizeStatusText(variation.ram),
      normalizeStatusText(variation.storage),
    ].join('|');

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: groupName,
        ram: variation.ram,
        storage: variation.storage,
        products: [],
      });
    }
    groups.get(key).products.push(product);
  }

  return Array.from(groups.values()).map((group) => {
    const representative = chooseStatusRepresentative(group.products);
    const colors = Array.from(new Set(
      group.products
        .map((product) => getStatusProductVariation(product).color)
        .filter(Boolean)
        .map(titleStatusText)
    )).sort((a, b) => normalizeStatusText(a).localeCompare(normalizeStatusText(b), 'pt-BR'));
    const prices = group.products.map((product) => Number(product?.price_retail || 0)).filter((price) => price > 0);
    const priceRetail = prices.length ? Math.min(...prices) : representative.price_retail;

    return {
      ...representative,
      name: group.name || representative.name,
      price_retail: priceRetail,
      status_variation: {
        ram: group.ram,
        storage: group.storage,
        colors,
        product_ids: group.products.map((product) => product.id).filter(Boolean),
      },
      status_group_products: group.products,
    };
  });
}

export function selectStatusProducts(products, { dailyLimit = MAX_STATUS_PRODUCTS_PER_RUN, lastProductId = '', includePrice = true } = {}) {
  const inStock = (Array.isArray(products) ? products : [])
    .filter((product) => product?.id)
    .filter(hasStock);

  if (!inStock.length) return [];

  const grouped = groupStatusProductsByVariation(inStock).filter((product) => hasUsableImage(product, includePrice));
  const startIndex = Math.max(0, grouped.findIndex((product) => product.id === lastProductId) + 1);
  const rotated = [...grouped.slice(startIndex), ...grouped.slice(0, startIndex)];
  return rotated.slice(0, clampDailyProductLimit(dailyLimit));
}

export function buildStatusCaption({ product, siteBaseUrl = 'https://mercadodovale.com.br' }) {
  const productName = String(product?.name || 'Produto').trim();
  const variation = product?.status_variation || getStatusProductVariation(product);
  const memoryLine = [variation?.ram ? `${variation.ram} RAM` : '', variation?.storage ? `${variation.storage} armazenamento` : '']
    .filter(Boolean)
    .join(' + ');
  const colors = Array.isArray(variation?.colors) && variation.colors.length
    ? variation.colors
    : [variation?.color].filter(Boolean);
  const colorLine = colors.length ? `Cores disponiveis: ${colors.join(', ')}` : '';
  const link = product?.slug
    ? `${String(siteBaseUrl).replace(/\/+$/, '')}/produto/${product.slug}`
    : String(siteBaseUrl).replace(/\/+$/, '');

  return [
    productName,
    memoryLine ? `Memoria: ${memoryLine}` : '',
    colorLine,
    '',
    'Confira os detalhes e as condicoes na arte.',
    '',
    'Veja no site:',
    link,
  ].filter((line) => line !== '').join('\n');
}

export function buildStatusPayload({ product, caption, includePrice = true }) {
  const image = getStatusProductImage(product, includePrice);

  return {
    type: 'image',
    content: String(image || '').trim(),
    caption,
    allContacts: false,
    statusJidList: [],
  };
}

export function buildCatalogStoryItems(products, {
  includePrice = true,
  dailyLimit = MAX_STATUS_PRODUCTS_PER_RUN,
  productIntervalSeconds = DEFAULT_STATUS_INTERVAL_MINUTES * 60,
  mediaIntervalSeconds = 8,
} = {}) {
  const flattened = (Array.isArray(products) ? products : []).flatMap((product) => (
    Array.isArray(product?.status_group_products) && product.status_group_products.length
      ? product.status_group_products
      : [product]
  ));
  const grouped = groupStatusProductsByVariation(flattened.filter((product) => product?.id).filter(hasStock))
    .filter((product) => hasUsableImage(product, includePrice));
  const requestedLimit = Math.floor(Number(dailyLimit));
  const effectiveLimit = requestedLimit === 0 ? grouped.length : Math.max(1, Math.min(80, requestedLimit || 1));
  const selected = grouped.slice(0, effectiveLimit);
  const items = [];

  selected.forEach((product, productIndex) => {
    const image = toPublicCatalogStoryMediaUrl(getStatusProductImage(product, includePrice));
    if (!image) return;
    const caption = buildStatusCaption({ product });
    const baseOffset = productIndex * Math.max(0, Number(productIntervalSeconds) || 0);
    items.push({
      mediaType: 'image',
      mediaUrl: image,
      caption,
      label: `${product.name} - ${includePrice ? 'arte com preço' : 'imagem sem preço'}`,
      offsetSeconds: baseOffset,
      productId: product.id,
    });

    const sourceProducts = Array.isArray(product?.status_group_products) && product.status_group_products.length
      ? product.status_group_products
      : [product];
    const usedColors = new Set();
    const usedUrls = new Set();
    sourceProducts.forEach((sourceProduct) => {
      const variation = getStatusProductVariation(sourceProduct);
      const color = String(variation.color || '').trim();
      const colorKey = normalizeStatusText(color) || `produto:${sourceProduct?.id || sourceProduct?.sku || usedColors.size}`;
      const videoUrl = toPublicCatalogStoryMediaUrl(String(includePrice
        ? sourceProduct?.marketing_video_url || sourceProduct?.video_url || ''
        : sourceProduct?.video_url || '').trim());
      if (!videoUrl || usedColors.has(colorKey) || usedUrls.has(videoUrl)) return;
      usedColors.add(colorKey);
      usedUrls.add(videoUrl);
      items.push({
        mediaType: 'video',
        mediaUrl: videoUrl,
        caption,
        label: `${product.name} - ${color || `vídeo ${usedColors.size}`}`,
        offsetSeconds: baseOffset + usedColors.size * Math.max(1, Number(mediaIntervalSeconds) || 8),
        productId: sourceProduct?.id || product.id,
        color,
      });
    });
  });

  return items.slice(0, 80);
}

export function sanitizeStatusDebugText(value) {
  return String(value || '')
    .replace(/(apikey\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[redacted]')
    .replace(/(token\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .slice(0, 1200);
}

export function buildStatusSendDebug({
  campaign,
  product,
  endpoint,
  httpStatus,
  errorMessage,
  responseBody,
  scheduledFor,
} = {}) {
  return [
    'WHATSAPP_STATUS_SEND_DEBUG',
    `Campanha: ${campaign?.title || campaign?.name || 'sem titulo'} (${campaign?.id || 'sem id'})`,
    `Produto: ${product?.name || 'sem produto'} (${product?.id || product?.sku || 'sem id'})`,
    `Horario: ${scheduledFor || 'envio manual/agora'}`,
    `Endpoint: ${endpoint || 'nao informado'}`,
    `HTTP: ${httpStatus || 'sem resposta'}`,
    `Erro: ${sanitizeStatusDebugText(errorMessage || 'sem mensagem')}`,
    `Resposta: ${sanitizeStatusDebugText(responseBody || '')}`,
  ].join('\n');
}
