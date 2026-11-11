'use strict';

// product-promotions-list-v1: promoções de preço dos produtos (ativas e agendadas) para a Central de Promoções.
// Uma linha por versão (modelo + RAM + armazenamento + mesma promoção); a edição é na Página do Produto.
const specValue = (specs, keys) => {
  let data = specs;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = {}; } }
  for (const key of keys) { const value = data && data[key]; if (value !== undefined && value !== null && String(value).trim()) return String(value).trim(); }
  return '';
};
const isoOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function selectCurrentProductPromotions(rows, now = Date.now()) {
  const groups = new Map();
  for (const row of rows || []) {
    const retail = Math.round(Number(row.price_retail) || 0);
    const promo = Math.round(Number(row.price_promo) || 0);
    if (!(promo > 0 && retail > promo)) continue;
    const start = isoOrNull(row.promo_start);
    const end = isoOrNull(row.promo_end);
    if (end && Date.parse(end) < now) continue; // encerrada não entra
    const status = start && Date.parse(start) > now ? 'scheduled' : 'active';
    const ram = specValue(row.specs, ['ram', 'memoria_ram', 'ram_gb']);
    const storage = specValue(row.specs, ['storage', 'armazenamento', 'storage_gb']);
    const color = specValue(row.specs, ['color', 'cor']);
    const key = [row.model_id || `produto:${row.id}`, ram, storage, promo, start || '', end || ''].join('|');
    let group = groups.get(key);
    if (!group) {
      group = {
        key, modelId: row.model_id || null, modelName: String(row.model_name || row.name || '').trim(), version: [ram, storage].filter(Boolean).join('/'),
        productIds: [], firstProductId: String(row.id), colors: [], retailCents: retail, promoCents: promo,
        discountPct: Math.round(((retail - promo) / retail) * 100), start, end, status, stock: 0,
      };
      groups.set(key, group);
    }
    group.productIds.push(String(row.id));
    if (color && !group.colors.includes(color)) group.colors.push(color);
    group.stock += Math.max(0, Math.trunc(Number(row.available_stock) || 0));
  }
  return [...groups.values()].sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1)
    || (a.end ? Date.parse(a.end) : Infinity) - (b.end ? Date.parse(b.end) : Infinity)
    || a.modelName.localeCompare(b.modelName, 'pt-BR'));
}

module.exports = { selectCurrentProductPromotions };
