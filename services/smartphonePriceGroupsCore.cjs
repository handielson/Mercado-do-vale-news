'use strict';

const crypto = require('crypto');
const { normalizePhysicalRamValue } = require('./physicalRamCore.cjs');
const SALE_FIELDS = ['price_retail', 'price_reseller', 'price_wholesale'];
function object(value) {
  if (typeof value === 'string') { try { return JSON.parse(value) || {}; } catch { return {}; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function text(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' '); }
function capacity(value) {
  const match = text(value).replace(/\s/g, '').match(/^(\d+(?:[.,]\d+)?)(gib|gb|g|tib|tb|t)?$/);
  if (!match) return '';
  const gb = Number(match[1].replace(',', '.')) * (match[2]?.startsWith('t') ? 1024 : 1);
  return gb > 0 ? `${gb}GB` : '';
}
function configuration(product, model = {}) {
  if (!product?.model_id || Number(product.is_parent) === 1 || Number(product.is_combo) === 1 || product.offer_type) return null;
  const specs = object(product.specs);
  const template = object(model.template_values);
  const spec = (...keys) => keys.map(k => specs[k]).find(v => v != null && v !== '') ?? keys.map(k => template[k]).find(v => v != null && v !== '');
  const ram = capacity(normalizePhysicalRamValue(spec('ram_fisica', 'memoria_ram_fisica', 'physical_ram', 'ram', 'memoria_ram', 'memory_ram')));
  const storage = capacity(spec('storage', 'armazenamento', 'memoria', 'capacity'));
  if (!ram || !storage) return null;
  const value = {
    company_id: product.company_id || model.company_id || null, model_id: String(product.model_id), ram, storage,
    version: text(spec('version', 'versao')), network: text(spec('rede_operadora', 'network', 'rede')),
    condition: text(spec('condition', 'condicao') || product.condition || 'new'),
  };
  return { ...value, id: crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex') };
}
function isSmartphoneCategory(name) { return /^(celular(?:es)?|smartphones?)(?:\b|$)/.test(text(name)); }
function prices(value) {
  const result = {};
  for (const field of SALE_FIELDS) {
    const n = Number(value?.[field]);
    if (!['string', 'number'].includes(typeof value?.[field]) || String(value[field]).trim() === '' || !Number.isSafeInteger(n) || n < 0 || n > 2147483647) return null;
    result[field] = n;
  }
  return result;
}
function samePrices(left, right) { return SALE_FIELDS.every(field => Number(left?.[field]) === Number(right?.[field])); }
function unanimousPrices(products) {
  const first = prices(products[0]);
  return first && products.every(p => prices(p) && samePrices(p, first)) ? first : null;
}
function revision(group, products) {
  return crypto.createHash('sha256').update(JSON.stringify({
    group: group ? [group.id, group.revision, ...SALE_FIELDS.map(f => Number(group[f]))] : null,
    products: [...products].sort((a, b) => String(a.id).localeCompare(String(b.id))).map(p => [p.id, p.price_cost, ...SALE_FIELDS.map(f => p[f])]),
  })).digest('hex');
}
module.exports = { SALE_FIELDS, object, configuration, isSmartphoneCategory, prices, samePrices, unanimousPrices, revision };
