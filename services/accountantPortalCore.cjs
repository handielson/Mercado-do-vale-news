const FINAL_STATUSES = new Set([
  'approved', 'completed', 'confirmed', 'delivered', 'paid', 'processed',
  'processing', 'ready_to_ship', 'shipped', 'to_ship',
]);
const CANCELLED_STATUSES = new Set([
  'cancelled', 'canceled', 'refunded', 'return_refund', 'returned', 'to_return',
]);

function safeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeOperationalSale(row) {
  const status = String(row?.status || '').trim().toLowerCase();
  const channel = String(row?.channel || '').trim().toLowerCase();
  const occurredAt = safeDate(row?.occurred_at);
  const totalCents = Math.max(0, Math.round(Number(row?.total_cents || 0)));
  let operationalState = 'pending';
  if (CANCELLED_STATUSES.has(status)) operationalState = 'cancelled';
  else if (FINAL_STATUSES.has(status)) operationalState = 'completed';
  return {
    channel,
    externalSaleId: String(row?.external_sale_id || '').trim(),
    status,
    occurredAt: occurredAt ? occurredAt.toISOString() : '',
    statusCapturedAt: safeDate(row?.status_captured_at)?.toISOString() || '',
    totalCents,
    operationalState,
    customerName: String(row?.customer_name || '').trim(),
  };
}

function reconcileSale(sale, fiscal = {}) {
  const authorizedDocuments = Array.isArray(fiscal.documents)
    ? fiscal.documents.filter(document => String(document.status || '').toLowerCase() === 'authorized')
    : [];
  const authorizedDocument = authorizedDocuments[0];
  const reviewReasons = [];
  let documentTotalCents;
  let amountDifferenceCents;
  if (authorizedDocument) {
    if (authorizedDocuments.every(document => Number.isFinite(Number(document.totalCents)))) {
      documentTotalCents = authorizedDocuments.reduce((sum, document) => sum + Math.round(Number(document.totalCents)), 0);
      amountDifferenceCents = documentTotalCents - sale.totalCents;
      if (amountDifferenceCents !== 0) reviewReasons.push('amount_difference');
    }
    if (sale.operationalState === 'pending') reviewReasons.push('operational_pending_with_document');
    if (sale.operationalState === 'cancelled') reviewReasons.push('cancelled_with_document');
  }
  const details = authorizedDocument ? { document: authorizedDocument, authorizedModels: [...new Set(authorizedDocuments.map(document => document.model))], documentTotalCents, amountDifferenceCents, reviewReasons } : {};
  if (sale.operationalState === 'cancelled') return { ...sale, fiscalState: 'cancelled', ...details };
  if (sale.operationalState !== 'completed') return { ...sale, fiscalState: 'operational_pending', ...details };
  if (authorizedDocument) return { ...sale, fiscalState: 'invoiced', ...details };
  const classification = String(fiscal.classification || '').toLowerCase();
  if (classification === 'no_invoice') return { ...sale, fiscalState: 'no_invoice_confirmed' };
  return { ...sale, fiscalState: 'reconciliation_pending' };
}

function monthKey(iso) {
  return String(iso || '').slice(0, 7);
}

function buildRevenueReport(rows, fiscalBySale = new Map()) {
  const sales = (rows || [])
    .map(normalizeOperationalSale)
    .filter(sale => sale.channel && sale.externalSaleId && sale.occurredAt)
    .map(sale => reconcileSale(sale, fiscalBySale.get(`${sale.channel}:${sale.externalSaleId}`) || {}))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const totals = {
    operationalCents: 0,
    invoicedCents: 0,
    noInvoiceConfirmedCents: 0,
    reconciliationPendingCents: 0,
    cancelledCents: 0,
    operationalPendingCents: 0,
  };
  const months = new Map();
  for (const sale of sales) {
    const key = monthKey(sale.occurredAt);
    const month = months.get(key) || { competence: key, ...Object.fromEntries(Object.keys(totals).map(name => [name, 0])) };
    const field = {
      invoiced: 'invoicedCents',
      no_invoice_confirmed: 'noInvoiceConfirmedCents',
      reconciliation_pending: 'reconciliationPendingCents',
      cancelled: 'cancelledCents',
      operational_pending: 'operationalPendingCents',
    }[sale.fiscalState];
    if (sale.operationalState === 'completed') {
      totals.operationalCents += sale.totalCents;
      month.operationalCents += sale.totalCents;
    }
    if (field) {
      totals[field] += sale.totalCents;
      month[field] += sale.totalCents;
    }
    months.set(key, month);
  }
  return { totals, months: [...months.values()].sort((a, b) => b.competence.localeCompare(a.competence)), sales,
    reviewSales: sales.filter(sale => sale.reviewReasons?.length > 0) };
}

function validPeriod(from, to, maxDays = 366) {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(String(from || '')) || !pattern.test(String(to || ''))) return false;
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return false;
  if (fromDate.toISOString().slice(0, 10) !== from || toDate.toISOString().slice(0, 10) !== to) return false;
  const days = (toDate.getTime() - fromDate.getTime()) / 86400000;
  return days >= 0 && days <= maxDays;
}

module.exports = { buildRevenueReport, normalizeOperationalSale, reconcileSale, validPeriod };
