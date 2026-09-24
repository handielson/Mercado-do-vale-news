const INTERNAL_WINDOW_MS = 23 * 60 * 60 * 1000;
const JUSTIFICATION = 'Pedido cancelado antes do envio; operacao comercial nao realizada.';

// The marketplace response must be fresh. Historic mobile_sale_events are snapshots.
function marketplaceCancellationEvidence(channel, order, expectedOrderId) {
  const id = String(channel === 'shopee' ? order?.order_sn || '' : order?.id || '');
  const status = String(channel === 'shopee' ? order?.order_status || '' : order?.status || '').toUpperCase();
  if (!id || id !== String(expectedOrderId || '')) return { cancelled: false, open: false, shipped: false, reason: 'marketplace_order_mismatch' };
  const shipped = channel === 'shopee'
    ? Number(order?.pickup_done_time || 0) > 0 || Number(order?.actual_shipping_time || 0) > 0
    : Number(order?.rts_time || 0) > 0 || Number(order?.shipped_time || 0) > 0 || Number(order?.delivered_time || 0) > 0;
  if (status !== 'CANCELLED') return { cancelled: false,
    open: !shipped && ['UNPAID','TO_CONFIRM','TO_SHIP','READY_TO_SHIP','PROCESSED','IN_CANCEL','AWAITING_SHIPMENT','AWAITING_COLLECTION','ON_HOLD'].includes(status),
    shipped, status, reason: 'marketplace_order_not_cancelled' };
  const cancelBy = String(channel === 'shopee' ? order?.cancel_by || '' : order?.cancellation_initiator || order?.cancelled_by || order?.cancel_by || '').toUpperCase();
  return { cancelled: true, open: false, shipped, status, buyerInitiated: cancelBy === 'BUYER',
    reason: shipped ? 'shipment_recorded' : 'marketplace_cancelled' };
}

function assessNfeCancellation({ document, profile, sefaz, marketplace, now = new Date() }) {
  const blockers = [];
  if (String(document?.model || '') !== '55') blockers.push('not_nfe_model_55');
  if (String(document?.status || '') !== 'authorized') blockers.push('document_not_authorized');
  if (!['shopee', 'tiktok'].includes(String(document?.channel || ''))) blockers.push('unsupported_sales_channel');
  if (String(profile?.uf || '') !== 'PE' || String(document?.access_key || '').slice(0, 2) !== '26') blockers.push('issuer_uf_mismatch');
  if (!/^[0-9]{44}$/.test(String(document?.access_key || '')) ||
      String(document?.access_key || '').slice(6, 20) !== String(profile?.cnpj || '').replace(/\D/g, '')) blockers.push('issuer_access_key_mismatch');
  if (sefaz?.situation !== 'authorized' || sefaz?.cStat !== '100') blockers.push('sefaz_not_authorized');
  if (!/^[0-9]{15}$/.test(String(sefaz?.authorizationProtocol || ''))) blockers.push('authorization_protocol_missing');
  const authorizedAt = String(sefaz?.authorizedAt || '');
  const authorizationMs = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:[+-]\d\d:\d\d|Z)$/.test(authorizedAt)
    ? Date.parse(authorizedAt) : NaN;
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(authorizationMs) || !Number.isFinite(nowMs) || authorizationMs > nowMs) blockers.push('authorization_time_unverified');
  else if (nowMs - authorizationMs >= INTERNAL_WINDOW_MS) blockers.push('internal_23h_window_elapsed');
  if (!marketplace?.cancelled) blockers.push('marketplace_cancellation_unverified');
  if (marketplace?.shipped) blockers.push('shipment_recorded');
  return {
    eligible: blockers.length === 0,
    blockers,
    alert: marketplace?.open && sefaz?.situation === 'authorized' ? 'open_order_with_authorized_nfe' : null,
    justification: JUSTIFICATION,
    internalDeadline: Number.isFinite(authorizationMs) ? new Date(authorizationMs + INTERNAL_WINDOW_MS).toISOString() : null,
  };
}

module.exports = { INTERNAL_WINDOW_MS, JUSTIFICATION, marketplaceCancellationEvidence, assessNfeCancellation };
