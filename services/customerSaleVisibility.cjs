'use strict';

// Regras de visibilidade de venda para a area da cliente.
// Venda cancelada/estornada continua inteira no banco e no painel admin
// (e no diario do aparelho), mas a cliente deixa de ver os dados que
// identificam o aparelho, que pode voltar ao estoque e ser vendido a outra pessoa.

const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'refunded']);
const DEVICE_FIELDS_TO_MASK = ['imei', 'imei_1', 'imei_2', 'imei1', 'imei2'];
const DEVICE_FIELDS_TO_DROP = ['serial', 'serialized_unit_id', 'serialized_unit'];

function isCancelledSale(sale) {
  if (!sale || typeof sale !== 'object') return false;
  const status = String(sale.payment_status || sale.status || '').trim().toLowerCase();
  return CANCELLED_STATUSES.has(status);
}

function maskDeviceIdentifier(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text.length <= 8) return '•'.repeat(text.length);
  return `${text.slice(0, 4)}${'•'.repeat(text.length - 8)}${text.slice(-4)}`;
}

function sanitizeCustomerSaleItems(sale, items) {
  const list = Array.isArray(items) ? items : [];
  if (!isCancelledSale(sale)) return list;
  return list.map((item) => {
    const copy = { ...item };
    let masked = false;
    for (const key of DEVICE_FIELDS_TO_MASK) {
      if (copy[key] != null && copy[key] !== '') { copy[key] = maskDeviceIdentifier(copy[key]); masked = true; }
    }
    for (const key of DEVICE_FIELDS_TO_DROP) {
      if (Object.prototype.hasOwnProperty.call(copy, key)) {
        if (copy[key] != null && copy[key] !== '') masked = true;
        copy[key] = null;
      }
    }
    if (masked) copy.device_masked = true;
    return copy;
  });
}

function sanitizeCustomerSale(sale) {
  if (!sale || typeof sale !== 'object' || !isCancelledSale(sale)) return sale;
  // O log de finalizacao guarda IMEI/serial e o estado do PDV: e interno.
  return { ...sale, finalization_log: null, device_masked: true };
}

// O cancelamento entra no caixa uma vez: quando a venda passa a cancelada
// com caixa vinculado, ou quando o caixa e vinculado agora. Um PUT seguinte
// na mesma venda (ex.: ajuste de observacao) nao gera outro evento.
function shouldRecordSaleCancellationCashEvent(before, after) {
  if (!after || !after.refund_cash_session_id || !isCancelledSale(after)) return false;
  if (!before || !isCancelledSale(before)) return true;
  return String(before.refund_cash_session_id || '') !== String(after.refund_cash_session_id || '');
}

module.exports = {
  isCancelledSale,
  maskDeviceIdentifier,
  sanitizeCustomerSaleItems,
  sanitizeCustomerSale,
  shouldRecordSaleCancellationCashEvent,
};
