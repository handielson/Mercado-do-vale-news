'use strict';

// receipt-stock-location-v1: local do estoque (com quantidade em cada local) e estoque total do SKU
// para o comprovante de separação (Shopee, Mercado Livre e TikTok). Aceita a resposta antiga da API
// (só "locations") e a nova (location_details + stock_total).

function formatUnits(quantity) {
  const value = Math.max(0, Math.round(Number(quantity) || 0));
  return `${value} un.`;
}

function receiptStockInfo(entry) {
  if (!entry) return { stockLocation: '', stockTotal: null, productUrl: '' };
  if (typeof entry === 'string') return { stockLocation: entry, stockTotal: null, productUrl: '' };
  const allDetails = Array.isArray(entry.location_details) ? entry.location_details.filter((item) => item && item.label) : [];
  // Locais zerados só atrapalham quem separa: somem quando algum local tem peça.
  const details = (allDetails.some((item) => Number(item.quantity) > 0) ? allDetails.filter((item) => Number(item.quantity) > 0) : allDetails)
    .slice().sort((a, b) => Number(b.quantity) - Number(a.quantity)); // maior quantidade primeiro (é o que aparece se a linha cortar)
  const locations = details.length
    ? details.map((item) => `${String(item.label).trim()} (${formatUnits(item.quantity)})`)
    : (Array.isArray(entry.locations) ? entry.locations.filter(Boolean).map(String) : []);
  const total = Number(entry.stock_total);
  // receipt-product-qr-v1: só links https do próprio site viram QR.
  const productUrl = /^https:\/\/(www\.)?mercadodovale\.com\.br\/produto\//.test(String(entry.product_url || '')) ? String(entry.product_url) : '';
  return { stockLocation: locations.join(' | '), stockTotal: Number.isFinite(total) && entry.stock_total !== null ? Math.max(0, total) : null, productUrl };
}

function receiptStockMap(items) {
  return Object.fromEntries((Array.isArray(items) ? items : []).map((item) => [String(item?.sku || '').trim().toUpperCase(), receiptStockInfo(item)]));
}

module.exports = { receiptStockInfo, receiptStockMap, formatUnits };
