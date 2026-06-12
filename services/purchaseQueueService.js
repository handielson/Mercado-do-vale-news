import { getDashboardSalesDigest } from './dashboardSalesDigestService.js';
import { vpsClient } from './vpsClient';

export const PURCHASE_QUEUE_TABLE = 'purchase_queue_items';
export const PURCHASE_QUEUE_STATUSES = ['pending', 'purchased', 'not_purchased', 'removed'];

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

export function formatQueueDigestDate(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function buildPurchaseQueueItemKey(row = {}) {
  const sku = normalizeSku(row.sku);
  const model = normalizeText(row.model, 'produto').toLowerCase();
  return sku ? `sku:${sku}` : `model:${model}`;
}

function normalizeChannels(channels) {
  if (Array.isArray(channels)) return uniqueValues(channels.map((value) => normalizeText(value)));
  return uniqueValues(
    String(channels || '')
      .split('+')
      .map((value) => normalizeText(value)),
  );
}

function buildBaseQueueRow(summaryRow, now) {
  const itemKey = buildPurchaseQueueItemKey(summaryRow);
  return {
    item_key: itemKey,
    product_id: summaryRow.productId ? String(summaryRow.productId) : null,
    model: normalizeText(summaryRow.model, 'Produto'),
    sku: normalizeSku(summaryRow.sku),
    current_stock: toInteger(summaryRow.currentStock),
    last_purchase_price_cents: toInteger(summaryRow.lastPurchasePriceCents),
    last_sale_price_cents: toInteger(summaryRow.lastSalePriceCents),
    accumulated_quantity: clampToZero(summaryRow.totalQuantity),
    origin_channels: normalizeChannels(summaryRow.channels),
    status: 'pending',
    reason: '',
    first_seen_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    last_digest_date: formatQueueDigestDate(now),
    last_digest_quantity: clampToZero(summaryRow.totalQuantity),
  };
}

export function mergeSalesDigestIntoPurchaseQueue({
  existingItems = [],
  summaryRows = [],
  now = new Date(),
}) {
  const existingMap = new Map(
    (Array.isArray(existingItems) ? existingItems : []).map((item) => [item.item_key, item]),
  );

  return (Array.isArray(summaryRows) ? summaryRows : []).map((summaryRow) => {
    const itemKey = buildPurchaseQueueItemKey(summaryRow);
    const existing = existingMap.get(itemKey);
    const digestDate = formatQueueDigestDate(now);
    const channels = normalizeChannels([
      ...normalizeChannels(existing?.origin_channels),
      ...normalizeChannels(summaryRow.channels),
    ]);

    if (!existing) {
      return buildBaseQueueRow(summaryRow, now);
    }

    const previousDigestQuantity = existing.last_digest_date === digestDate
      ? toInteger(existing.last_digest_quantity)
      : 0;
    const nextDigestQuantity = clampToZero(summaryRow.totalQuantity);
    const delta = nextDigestQuantity - previousDigestQuantity;
    const nextAccumulated = clampToZero(toInteger(existing.accumulated_quantity) + delta);
    const shouldReopenPurchased = existing.status === 'purchased' && delta > 0;

    return {
      ...existing,
      product_id: summaryRow.productId ? String(summaryRow.productId) : (existing.product_id || null),
      model: normalizeText(summaryRow.model, existing.model || 'Produto'),
      sku: normalizeSku(summaryRow.sku) || normalizeSku(existing.sku),
      current_stock: toInteger(summaryRow.currentStock),
      last_purchase_price_cents: toInteger(summaryRow.lastPurchasePriceCents),
      last_sale_price_cents: toInteger(summaryRow.lastSalePriceCents),
      accumulated_quantity: nextAccumulated,
      origin_channels: channels,
      status: shouldReopenPurchased ? 'pending' : existing.status,
      reason: shouldReopenPurchased ? '' : normalizeText(existing.reason),
      last_seen_at: now.toISOString(),
      last_digest_date: digestDate,
      last_digest_quantity: nextDigestQuantity,
    };
  });
}

export function applyPurchaseQueueStatusTransition(item, {
  status,
  reason = '',
  now = new Date(),
}) {
  if (!PURCHASE_QUEUE_STATUSES.includes(status)) {
    throw new Error('Status de fila de compra invalido.');
  }

  const normalizedReason = normalizeText(reason);
  if ((status === 'removed' || status === 'not_purchased') && !normalizedReason) {
    throw new Error('Informe um motivo para retirar este item da lista de compra.');
  }

  return {
    ...item,
    status,
    reason: status === 'pending' || status === 'purchased' ? '' : normalizedReason,
    updated_at: now.toISOString(),
    purchased_at: status === 'purchased' ? now.toISOString() : null,
  };
}

function formatCurrency(cents) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(toInteger(cents) / 100);
}

function formatProtectedCurrency(cents, masked = false) {
  return masked ? 'R$ ••••••' : formatCurrency(cents);
}

export function buildPurchaseQueueClipboardText(items = [], options = {}) {
  const masked = Boolean(options?.masked);
  const rows = Array.isArray(items) ? items : [];
  const lines = [
    'LISTA DE COMPRA',
    '',
  ];

  if (rows.length === 0) {
    lines.push('Nenhum item pendente na fila de compra.');
    return lines.join('\n');
  }

  rows.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${normalizeText(item.model, 'Produto')} | ${normalizeSku(item.sku) || 'SEM-SKU'}`,
      `Estoque atual: ${toInteger(item.current_stock)} | Qtde acumulada: ${toInteger(item.accumulated_quantity)}`,
      `Ult. compra: ${formatProtectedCurrency(item.last_purchase_price_cents, masked)} | Ult. venda: ${formatCurrency(item.last_sale_price_cents)}`,
      `Origens: ${normalizeChannels(item.origin_channels).join(', ') || 'Nao informado'} | Status: ${normalizeText(item.status, 'pending')}`,
      `Motivo: ${normalizeText(item.reason, '-')}`,
      '',
    );
  });

  return lines.join('\n').trim();
}

function extractRows(response) {
  if (Array.isArray(response)) return response;
  return response?.data || response?.rows || response?.items || [];
}

async function loadPurchaseQueueRows() {
  const response = await vpsClient.get(`/table-data/${PURCHASE_QUEUE_TABLE}?limit=5000&offset=0`);
  return extractRows(response);
}

export async function getPurchaseQueueItems({
  includeResolved = true,
} = {}) {
  const rows = await loadPurchaseQueueRows();
  return rows
    .filter((row) => includeResolved || row.status === 'pending')
    .sort((a, b) =>
      String(a.status || '').localeCompare(String(b.status || '')) ||
      String(b.updated_at || '').localeCompare(String(a.updated_at || '')) ||
      String(a.model || '').localeCompare(String(b.model || ''))
    );
}

export async function syncPurchaseQueueFromSummary(summaryRows = [], now = new Date()) {
  if (!Array.isArray(summaryRows) || summaryRows.length === 0) {
    return getPurchaseQueueItems();
  }

  const itemKeys = uniqueValues(summaryRows.map((row) => buildPurchaseQueueItemKey(row)));
  const existingRows = (await loadPurchaseQueueRows()).filter((row) => itemKeys.includes(row.item_key));

  const upsertRows = mergeSalesDigestIntoPurchaseQueue({
    existingItems: existingRows || [],
    summaryRows,
    now,
  }).map((row) => ({
    ...row,
    updated_at: now.toISOString(),
  }));

  const existingByKey = new Map(existingRows.map((row) => [row.item_key, row]));
  for (const row of upsertRows) {
    const existing = existingByKey.get(row.item_key);
    if (existing?.id) {
      await vpsClient.patch(`/table-data/${PURCHASE_QUEUE_TABLE}/${encodeURIComponent(existing.id)}?pk=id`, row);
    } else {
      await vpsClient.post(`/table-data/${PURCHASE_QUEUE_TABLE}`, row);
    }
  }

  return getPurchaseQueueItems();
}

export async function syncPurchaseQueueFromDashboardDigest(now = new Date()) {
  const digest = await getDashboardSalesDigest(now);
  return syncPurchaseQueueFromSummary(digest.summaryRows, now);
}

export async function updatePurchaseQueueItemStatus(id, status, reason = '', now = new Date()) {
  const current = (await loadPurchaseQueueRows()).find((row) => String(row.id) === String(id));
  if (!current) throw new Error('Item da fila de compra nao encontrado.');

  const nextRow = applyPurchaseQueueStatusTransition(current, { status, reason, now });
  await vpsClient.patch(`/table-data/${PURCHASE_QUEUE_TABLE}/${encodeURIComponent(id)}?pk=id`, {
    status: nextRow.status,
    reason: nextRow.reason,
    purchased_at: nextRow.purchased_at,
    updated_at: nextRow.updated_at,
  });

  return getPurchaseQueueItems();
}

export async function reopenPurchaseQueueItem(id, now = new Date()) {
  return updatePurchaseQueueItemStatus(id, 'pending', '', now);
}
