'use strict';

function isModelProductRead(request) {
  if (!['GET', 'HEAD'].includes(request.method)) return false;
  const route = String(request.routeOptions?.url || request.routerPath || '').split('?')[0];
  const pathname = String(request.url || '').split('?')[0];
  if (pathname === '/table-data/products' || pathname === '/pdv/product-search') return true;
  if (/^\/storefronts\/[^/]+\/products(?:\/[^/]+)?$/.test(pathname)) return true;
  const allowed = new Set(['/products', '/products/by-ids', '/products/:id', '/products/by-category/:categoryId', '/products/by-slug/:slug', '/products/by-ean/:ean', '/products/:id/combo']);
  if (route) return allowed.has(route);
  return /^\/products(?:\/by-ids|\/by-(?:category|slug|ean)\/[^/]+|\/[^/]+(?:\/combo)?)?$/.test(pathname)
    && !['/products/category-counts'].includes(pathname);
}
function productObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && typeof value.id === 'string' && ('sku' in value || 'model_id' in value)
    && ('specs' in value || 'price_retail' in value);
}
async function projectProductPayload(db, payload, applyProducts) {
  const products = [], positions = new Map();
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return;
    if (productObject(value)) { positions.set(value, products.length); products.push(value); }
    for (const child of Object.values(value)) collect(child);
  }
  collect(payload);
  if (!products.length) return payload;
  const projected = await applyProducts(db, products);
  function rebuild(value) {
    if (Array.isArray(value)) return value.map(rebuild);
    if (!value || typeof value !== 'object') return value;
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
    const replacement = positions.has(value) ? projected[positions.get(value)] : value;
    return Object.fromEntries(Object.entries(replacement).map(([key, child]) => [key, rebuild(child)]));
  }
  return rebuild(payload);
}
function registerSmartphoneModelSpecsBoundary(fastify, { db, applyProducts } = {}) {
  const loaded = applyProducts ? null : import('./smartphoneModelSpecs.mjs');
  fastify.addHook('preSerialization', async (request, reply, payload) => {
    if (reply.statusCode >= 400 || !isModelProductRead(request)) return payload;
    const apply = applyProducts || (await loaded).applyModelSpecsToProducts;
    return projectProductPayload(db, payload, apply);
  });
}
module.exports = { isModelProductRead, productObject, projectProductPayload, registerSmartphoneModelSpecsBoundary };
