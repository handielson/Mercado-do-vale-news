export const MAX_STATUS_PRODUCTS_PER_RUN = 10;
export const DEFAULT_STATUS_INTERVAL_MINUTES = 30;

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

function hasUsableImage(product) {
  return Array.isArray(product?.images) && product.images.some((image) => String(image || '').trim());
}

function hasUsablePrice(product) {
  return Number(product?.price_retail || 0) > 0;
}

function hasStock(product) {
  return Number(product?.stock_quantity ?? 0) > 0 || product?.track_inventory === false;
}

export function selectStatusProducts(products, { dailyLimit = MAX_STATUS_PRODUCTS_PER_RUN, lastProductId = '' } = {}) {
  const eligible = (Array.isArray(products) ? products : [])
    .filter((product) => product?.id)
    .filter(hasUsableImage)
    .filter(hasUsablePrice)
    .filter(hasStock);

  if (!eligible.length) return [];

  const startIndex = Math.max(0, eligible.findIndex((product) => product.id === lastProductId) + 1);
  const rotated = [...eligible.slice(startIndex), ...eligible.slice(0, startIndex)];
  return rotated.slice(0, clampDailyProductLimit(dailyLimit));
}

export function formatStatusMoney(cents) {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).replace(/\u00a0/g, ' ');
}

export function buildStatusCaption({ product, cardPlan, siteBaseUrl = 'https://mercadodovale.com.br' }) {
  const productName = String(product?.name || 'Produto').trim();
  const priceLine = `A vista no PIX: ${formatStatusMoney(product?.price_retail)}`;
  const cardLine = cardPlan?.installments && cardPlan?.value
    ? `Cartao: ${cardPlan.installments}x de ${formatStatusMoney(cardPlan.value)}`
    : '';
  const link = product?.slug
    ? `${String(siteBaseUrl).replace(/\/+$/, '')}/produto/${product.slug}`
    : String(siteBaseUrl).replace(/\/+$/, '');

  return [
    productName,
    '',
    priceLine,
    cardLine,
    '',
    'Veja no site:',
    link,
  ].filter((line) => line !== '').join('\n');
}

export function buildStatusPayload({ product, caption }) {
  const image = Array.isArray(product?.images)
    ? product.images.find((value) => String(value || '').trim())
    : '';

  return {
    type: 'image',
    content: String(image || '').trim(),
    caption,
    allContacts: true,
  };
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
