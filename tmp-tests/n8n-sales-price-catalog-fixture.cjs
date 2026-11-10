'use strict';
const assert = require('node:assert/strict');

// Contract tests unrelated to recotação simulate a catalog whose prices have
// not changed. Prefer their original API fixtures when supplied.
function priceCatalogFixture(state, products = []) {
  const productsById = new Map(products.map(row => [row.id, row]));
  for (const conversation of Object.values(state.salesPostList || {})) {
    const draft = conversation.orderDraft;
    for (const option of conversation.options || []) {
      for (const variant of option.colors || []) {
        const id = variant.productId;
        if (!id || productsById.has(id)) continue;
        const memory = String(variant.memory || option.memory || '').split('/');
        const price = variant.priceCents || option.priceCents ||
          (draft?.productId === id && (draft.unitPriceCents || Math.round(Number(String(draft.price || '').replace(/[^\d,]/g, '').replace(',', '.')) * 100)));
        if (!price) continue;
        productsById.set(id, {
          id, name: option.name, model_name: option.name, model_id: option.name,
          status: 'active', stock_quantity: 1, price_retail: price,
          specs: { color: variant.color, ram: memory[0], storage: memory[1] },
        });
      }
    }
  }
  return { async httpRequest({ url }) {
    const endpoint = new URL(url);
    if (endpoint.pathname === '/payment-fees') return [{ channel: 'presencial', installments: 12, applied_fee_pct: 11.9 }];
    assert.equal(endpoint.pathname, '/products');
    return endpoint.searchParams.get('in_ids').split(',').map(id => productsById.get(id)).filter(Boolean);
  } };
}
module.exports = { priceCatalogFixture };
