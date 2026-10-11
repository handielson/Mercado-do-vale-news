'use strict';
const { resolveStorefrontDescription } = require('./productStorefrontOffer.cjs');

// One response boundary for the public product routes, including nested combos.
function isProductRead(request) {
  if (!['GET', 'HEAD'].includes(request.method)) return false;
  const path = String(request.url || '').split('?')[0];
  return /^\/products(?:\/[^/]+|\/by-(?:category|slug|ean)\/[^/]+|\/[^/]+\/combo)?$/.test(path)
    || /^\/storefronts\/[^/]+\/products(?:\/[^/]+)?$/.test(path);
}

function filterProductPrices(value, access) {
  if (Array.isArray(value)) return value.map(item => filterProductPrices(item, access));
  if (!value || typeof value !== 'object') return value;
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  const projected = Object.fromEntries(Object.entries(value)
    .filter(([key]) => access.isAdmin || !['price_cost', 'cost_price', 'unit_cost', 'purchase_price'].includes(key))
    .filter(([key]) => access.isCommercial || !['price_reseller', 'price_wholesale'].includes(key))
    .map(([key, item]) => [key, filterProductPrices(item, access)]));
  // Keep the editor's stored description intact. Public product consumers use
  // the same backend-resolved value as both storefront offer routes.
  if (value.id && Object.hasOwn(value, 'parent_description')) {
    projected.catalog_description = resolveStorefrontDescription(value);
    delete projected.parent_description;
  }
  return projected;
}

function registerProductReadPrivacy(fastify, { getAuth }) {
  fastify.addHook('preSerialization', async (request, reply, payload) => {
    if (!isProductRead(request)) return payload;
    const headers = request.headers || {};
    const auth = headers.authorization ? await getAuth(request) : null;
    // Proxy/sync keys grant transport access, never a public catalog price tier.
    const isAdmin = Boolean(auth?.customerId && auth?.isAdmin);
    const isCommercial = isAdmin || Boolean(auth?.customerId
      && ['resale', 'reseller', 'wholesale'].includes(String(auth.customerType || '').toLowerCase()));
    // Never let a CDN/browser reuse an authenticated response for another visitor.
    reply.header('Vary', 'Authorization, X-Sync-Key, X-Api-Key');
    reply.header('Cache-Control', 'no-store');
    reply.header('CDN-Cache-Control', 'no-store');
    return filterProductPrices(payload, { isAdmin, isCommercial });
  });
}

module.exports = { registerProductReadPrivacy, filterProductPrices, isProductRead };
