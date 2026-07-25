import { getDashboardSalesDigest } from './dashboardSalesDigestService.js';
import { vpsClient } from './vpsClient';

export const PURCHASE_QUEUE_TABLE = 'purchase_queue_items';
export const PURCHASE_QUOTES_TABLE = 'purchase_quotes';
export const PURCHASE_QUEUE_STATUSES = ['pending', 'quoted', 'purchased', 'not_purchased', 'removed'];

function normalizeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeSku(value) {
  return normalizeText(value).toUpperCase();
}

function toInteger(value) {
  return Number(value) || 0;
}

function clampToZero(value) {
  return Math.max(0, toInteger(value));
}

function uniqueValues(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `purchase-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatQueueDigestDate(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

export function buildPurchaseQueueItemKey(row = {}) {
  const sku = normalizeSku(row.sku);
  const model = normalizeText(row.model, 'produto').toLowerCase();
  return sku ? `sku:${sku}` : `model:${model}`;
}

function normalizeChannels(channels) {
  if (Array.isArray(channels)) return uniqueValues(channels.map((value) => normalizeText(value)));
  return uniqueValues(String(channels || '').split('+').map((value) => normalizeText(value)));
}

function buildBaseQueueRow(summaryRow, now) {
  return {
    id: createId(),
    item_key: buildPurchaseQueueItemKey(summaryRow),
    source_type: 'daily_sales',
    product_id: summaryRow.productId ? String(summaryRow.productId) : null,
    model: normalizeText(summaryRow.model, 'Produto'),
    sku: normalizeSku(summaryRow.sku),
    current_stock: toInteger(summaryRow.currentStock),
    last_purchase_price_cents: toInteger(summaryRow.lastPurchasePriceCents),
    last_sale_price_cents: toInteger(summaryRow.lastSalePriceCents),
    accumulated_quantity: clampToZero(summaryRow.totalQuantity),
    requested_quantity: 0,
    origin_channels: normalizeChannels(summaryRow.channels),
    status: 'pending',
    reason: '',
    first_seen_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    last_digest_date: formatQueueDigestDate(now),
    last_digest_quantity: clampToZero(summaryRow.totalQuantity),
  };
}

export function mergeSalesDigestIntoPurchaseQueue({ existingItems = [], summaryRows = [], now = new Date() }) {
  const existingMap = new Map((Array.isArray(existingItems) ? existingItems : []).map((item) => [item.item_key, item]));
  return (Array.isArray(summaryRows) ? summaryRows : []).map((summaryRow) => {
    const itemKey = buildPurchaseQueueItemKey(summaryRow);
    const existing = existingMap.get(itemKey);
    if (!existing) return buildBaseQueueRow(summaryRow, now);
    const digestDate = formatQueueDigestDate(now);
    const previousDigestQuantity = existing.last_digest_date === digestDate ? toInteger(existing.last_digest_quantity) : 0;
    const nextDigestQuantity = clampToZero(summaryRow.totalQuantity);
    const delta = nextDigestQuantity - previousDigestQuantity;
    const shouldReopenPurchased = existing.status === 'purchased' && delta > 0;
    return {
      ...existing,
      source_type: existing.source_type || 'daily_sales',
      product_id: summaryRow.productId ? String(summaryRow.productId) : (existing.product_id || null),
      model: normalizeText(summaryRow.model, existing.model || 'Produto'),
      sku: normalizeSku(summaryRow.sku) || normalizeSku(existing.sku),
      current_stock: toInteger(summaryRow.currentStock),
      last_purchase_price_cents: toInteger(summaryRow.lastPurchasePriceCents),
      last_sale_price_cents: toInteger(summaryRow.lastSalePriceCents),
      accumulated_quantity: clampToZero(toInteger(existing.accumulated_quantity) + delta),
      origin_channels: normalizeChannels([...normalizeChannels(existing.origin_channels), ...normalizeChannels(summaryRow.channels)]),
      status: shouldReopenPurchased ? 'pending' : existing.status,
      reason: shouldReopenPurchased ? '' : normalizeText(existing.reason),
      last_seen_at: now.toISOString(),
      last_digest_date: digestDate,
      last_digest_quantity: nextDigestQuantity,
    };
  });
}

export function applyPurchaseQueueStatusTransition(item, { status, reason = '', now = new Date() }) {
  if (!PURCHASE_QUEUE_STATUSES.includes(status)) throw new Error('Status de fila de compra invalido.');
  const normalizedReason = normalizeText(reason);
  if ((status === 'removed' || status === 'not_purchased') && !normalizedReason) throw new Error('Informe um motivo para retirar este item da lista de compra.');
  return { ...item, status, reason: status === 'pending' || status === 'purchased' || status === 'quoted' ? '' : normalizedReason, updated_at: now.toISOString(), purchased_at: status === 'purchased' ? now.toISOString() : null };
}

function formatCurrency(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toInteger(cents) / 100);
}

export function buildPurchaseQueueClipboardText(items = []) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return 'LISTA DE COMPRA\n\nNenhum item pendente na fila de compra.';
  return ['LISTA DE COMPRA', '', ...rows.flatMap((item, index) => [
    `${index + 1}. ${normalizeText(item.model, 'Produto')} | ${normalizeSku(item.sku) || 'SEM-SKU'}`,
    `Vendas do dia: ${toInteger(item.last_digest_quantity)} | Estoque atual: ${toInteger(item.current_stock)} | Solicitação: ${toInteger(item.requested_quantity)}`,
    `Menor orçamento: ${item.lowest_quote_price_cents == null ? 'Ainda não orçado' : formatCurrency(item.lowest_quote_price_cents)} | Status: ${normalizeText(item.status, 'pending')}`,
    '',
  ])].join('\n').trim();
}

function extractRows(response) {
  if (Array.isArray(response)) return response;
  return response?.data || response?.rows || response?.items || [];
}

async function loadRows(table) {
  return extractRows(await vpsClient.get(`/table-data/${table}?limit=5000&offset=0`));
}

async function loadPurchaseQueueRows() { return loadRows(PURCHASE_QUEUE_TABLE); }

export function enrichPurchaseQueueItems(items = [], quotes = []) {
  const quotesByItem = new Map();
  quotes.forEach((quote) => {
    const list = quotesByItem.get(String(quote.queue_item_id)) || [];
    list.push(quote);
    quotesByItem.set(String(quote.queue_item_id), list);
  });
  return items.map((item) => {
    const itemQuotes = (quotesByItem.get(String(item.id)) || []).sort((a, b) => toInteger(a.unit_price_cents) - toInteger(b.unit_price_cents));
    const lowestQuote = itemQuotes[0] || null;
    return { ...item, source_type: item.source_type || 'daily_sales', quotes: itemQuotes, quote_count: itemQuotes.length, lowest_quote: lowestQuote, lowest_quote_price_cents: lowestQuote ? toInteger(lowestQuote.unit_price_cents) : null };
  });
}

export async function getPurchaseQueueItems({ includeResolved = true } = {}) {
  const [items, quotes] = await Promise.all([loadPurchaseQueueRows(), loadRows(PURCHASE_QUOTES_TABLE)]);
  return enrichPurchaseQueueItems(items, quotes)
    .filter((row) => includeResolved || ['pending', 'quoted'].includes(row.status))
    .sort((a, b) => String(a.status || '').localeCompare(String(b.status || '')) || String(b.updated_at || '').localeCompare(String(a.updated_at || '')) || String(a.model || '').localeCompare(String(b.model || '')));
}

export async function getPurchaseQueueItem(id) {
  return (await getPurchaseQueueItems()).find((item) => String(item.id) === String(id)) || null;
}

export async function syncPurchaseQueueFromSummary(summaryRows = [], now = new Date()) {
  if (!Array.isArray(summaryRows) || !summaryRows.length) return getPurchaseQueueItems();
  const keys = uniqueValues(summaryRows.map((row) => buildPurchaseQueueItemKey(row)));
  const existingRows = (await loadPurchaseQueueRows()).filter((row) => keys.includes(row.item_key));
  const existingByKey = new Map(existingRows.map((row) => [row.item_key, row]));
  for (const row of mergeSalesDigestIntoPurchaseQueue({ existingItems: existingRows, summaryRows, now })) {
    const existing = existingByKey.get(row.item_key);
    const next = { ...row, id: existing?.id || row.id || createId(), updated_at: now.toISOString() };
    if (existing?.id) await vpsClient.patch(`/table-data/${PURCHASE_QUEUE_TABLE}/${encodeURIComponent(existing.id)}?pk=id`, next);
    else await vpsClient.post(`/table-data/${PURCHASE_QUEUE_TABLE}`, next);
  }
  return getPurchaseQueueItems();
}

export async function syncPurchaseQueueFromDashboardDigest(now = new Date()) {
  const digest = await getDashboardSalesDigest(now);
  return syncPurchaseQueueFromSummary(digest.summaryRows, now);
}

export async function createManualPurchaseRequest({ productId = null, model, sku = '', currentStock = 0, requestedQuantity = 1, sourceType = 'manual_new' }) {
  const name = normalizeText(model);
  if (!name) throw new Error('Informe o nome do item.');
  const now = new Date();
  const id = createId();
  const row = {
    id, item_key: `manual:${id}`, source_type: sourceType === 'manual_existing' ? 'manual_existing' : 'manual_new', product_id: productId ? String(productId) : null,
    model: name, sku: normalizeSku(sku), current_stock: clampToZero(currentStock), last_purchase_price_cents: 0, last_sale_price_cents: 0,
    accumulated_quantity: 0, requested_quantity: Math.max(1, clampToZero(requestedQuantity)), origin_channels: ['Solicitação manual'], status: 'pending', reason: '',
    first_seen_at: now.toISOString(), last_seen_at: now.toISOString(), last_digest_date: null, last_digest_quantity: 0, created_at: now.toISOString(), updated_at: now.toISOString(),
  };
  await vpsClient.post(`/table-data/${PURCHASE_QUEUE_TABLE}`, row);
  return getPurchaseQueueItem(id);
}

export async function createPurchaseQuote({ queueItemId, supplierName, unitPriceCents, quantity = 1, notes = '', quotedAt = new Date() }) {
  const item = await getPurchaseQueueItem(queueItemId);
  if (!item) throw new Error('Item da fila de compra nao encontrado.');
  const supplier = normalizeText(supplierName);
  if (!supplier) throw new Error('Informe a loja ou fornecedor.');
  if (toInteger(unitPriceCents) < 0) throw new Error('Informe um preço válido.');
  const quote = { id: createId(), queue_item_id: String(queueItemId), supplier_name: supplier, unit_price_cents: clampToZero(unitPriceCents), quantity: Math.max(1, clampToZero(quantity)), notes: normalizeText(notes), quoted_at: new Date(quotedAt).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  await vpsClient.post(`/table-data/${PURCHASE_QUOTES_TABLE}`, quote);
  if (item.status === 'pending') await vpsClient.patch(`/table-data/${PURCHASE_QUEUE_TABLE}/${encodeURIComponent(queueItemId)}?pk=id`, { status: 'quoted', updated_at: new Date().toISOString() });
  return getPurchaseQueueItem(queueItemId);
}

export async function markPurchaseQueueItemAsPurchased({ queueItemId, quoteId, quantity }) {
  const item = await getPurchaseQueueItem(queueItemId);
  const quote = item?.quotes?.find((candidate) => String(candidate.id) === String(quoteId));
  if (!item || !quote) throw new Error('Selecione um orçamento válido para confirmar a compra.');
  const purchasedQuantity = Math.max(1, clampToZero(quantity || quote.quantity));
  const unitPrice = clampToZero(quote.unit_price_cents);
  await vpsClient.patch(`/table-data/${PURCHASE_QUEUE_TABLE}/${encodeURIComponent(queueItemId)}?pk=id`, {
    status: 'purchased', reason: '', purchased_quote_id: quote.id, purchased_supplier_name: quote.supplier_name, purchased_unit_price_cents: unitPrice,
    purchased_quantity: purchasedQuantity, purchased_total_cents: unitPrice * purchasedQuantity, purchased_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  return getPurchaseQueueItem(queueItemId);
}

export async function updatePurchaseQueueItemStatus(id, status, reason = '', now = new Date()) {
  const current = (await loadPurchaseQueueRows()).find((row) => String(row.id) === String(id));
  if (!current) throw new Error('Item da fila de compra nao encontrado.');
  const next = applyPurchaseQueueStatusTransition(current, { status, reason, now });
  await vpsClient.patch(`/table-data/${PURCHASE_QUEUE_TABLE}/${encodeURIComponent(id)}?pk=id`, { status: next.status, reason: next.reason, purchased_at: next.purchased_at, updated_at: next.updated_at });
  return getPurchaseQueueItems();
}

export async function reopenPurchaseQueueItem(id, now = new Date()) { return updatePurchaseQueueItemStatus(id, 'pending', '', now); }
