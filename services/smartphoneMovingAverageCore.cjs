'use strict';
const prices = require('./smartphonePriceGroupsCore.cjs');
// Six decimal places below a cent. JSON stores integers as strings, never floats.
const SCALE = 1000000n;
const physical = unit => ['available', 'reserved'].includes(unit?.status);
const cents = value => value != null && String(value).trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 2147483647 ? Number(value) : null;
function fail(message) { throw Object.assign(new Error(message), { statusCode: 409 }); }
function empty() { return { version: 1, groups: {}, units: {} }; }
function group(state, config) {
  return state.groups[config.id] ||= { configuration: config, quantity: 0, value: '0', unknown: 0, carry: '0' };
}
function average(g) {
  return !g || !g.quantity || g.unknown || BigInt(g.value) < 0n ? null : Number((BigInt(g.value) / BigInt(g.quantity) + SCALE / 2n) / SCALE);
}
function enter(g, unit, value) {
  g.quantity++;
  if (value == null) g.unknown++;
  else g.value = String(BigInt(g.value) + value);
  unit.in_stock = true;
}
function leave(g, unit, strict) {
  if (strict && (g.unknown || BigInt(g.value) < 0n)) fail('Confira o valor de compra dos aparelhos desta configuração antes de vender.');
  const value = g.unknown ? null : BigInt(g.value) / BigInt(g.quantity);
  const amount = value == null ? null : (value + BigInt(g.carry) + SCALE / 2n) / SCALE;
  if (value != null) {
    g.value = String(BigInt(g.value) - value);
    unit.exit_carry = String(value - amount * SCALE);
    g.carry = String(BigInt(g.carry) + BigInt(unit.exit_carry));
  } else {
    // Unknown purchase amounts cannot silently become a zero-cost sale.
    if (unit.purchase == null) g.unknown--;
    else g.value = String(BigInt(g.value) - BigInt(unit.purchase) * SCALE);
    unit.exit_carry = '0';
  }
  g.quantity--;
  unit.in_stock = false;
  unit.exit_value = value == null ? null : String(value);
  unit.exit_cost = amount == null ? null : Number(amount);
  if (!g.quantity) { g.value = '0'; g.unknown = 0; g.carry = '0'; }
  return unit.exit_cost;
}
function applyUnit(state, product, current, model, { baseline = false, strictSale = false } = {}) {
  const id = current?.id;
  if (!id) return null;
  const config = prices.configuration(product, model);
  const old = state.units[id];
  const nextStock = Boolean(config && physical(current));
  let snapshot = null;
  if (old?.in_stock && (!nextStock || old.group !== config?.id)) {
    const cost = leave(state.groups[old.group], old, strictSale);
    if (current.status === 'sold' && current.sale_id && !baseline) {
      snapshot = { sale_id: current.sale_id, unit_id: id, configuration_id: old.group,
        unit_cost: cost, purchase_cost: old.purchase };
    }
  }
  if (!config) { if (old) old.in_stock = false; return snapshot; }
  const g = group(state, config);
  const purchase = cents(current.cost_price);
  const unit = old || { group: config.id, in_stock: false, purchase, exit_value: null, exit_cost: null, exit_carry: '0' };
  if (nextStock && !unit.in_stock) {
    // Returns/reclassification restore the book value removed, not today's IMEI price.
    const value = !baseline && unit.exit_value != null ? BigInt(unit.exit_value) : purchase == null ? null : BigInt(purchase) * SCALE;
    enter(g, unit, value);
    if (!baseline && unit.exit_value != null) g.carry = String(BigInt(g.carry) - BigInt(unit.exit_carry || '0'));
    unit.exit_value = null; unit.exit_cost = null; unit.exit_carry = '0';
  } else if (nextStock && unit.purchase !== purchase) {
    if (unit.purchase == null) g.unknown--;
    else g.value = String(BigInt(g.value) - BigInt(unit.purchase) * SCALE);
    if (purchase == null) g.unknown++;
    else g.value = String(BigInt(g.value) + BigInt(purchase) * SCALE);
  }
  unit.purchase = purchase; unit.group = config.id;
  state.units[id] = unit;
  return snapshot;
}
function initialize(rows, model) {
  const state = empty();
  for (const { product, unit } of rows) applyUnit(state, product, unit, model, { baseline: true });
  return state;
}
function applyEvent(state, event, model) {
  const before = prices.object(event.before_data), after = prices.object(event.after_data);
  if (after.product && after.product.model_id !== model.id) {
    if (before.product?.model_id === model.id && before.unit) return applyUnit(state, before.product, { ...before.unit, status: 'deleted' }, model);
    return null;
  }
  if (after.unit && after.product) return applyUnit(state, after.product, after.unit, model);
  if (before.unit) return applyUnit(state, before.product, { ...before.unit, status: 'deleted' }, model);
  return null;
}
module.exports = { SCALE, empty, cents, physical, average, initialize, applyUnit, applyEvent };
