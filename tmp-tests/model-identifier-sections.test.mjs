import assert from 'node:assert/strict';
import { aggregateModelProducts, getModelIdentifierSections } from '../services/modelProductAggregator.js';

const units = [
  { id: 'stock', status: 'available', imei1: '111' },
  { id: 'sold', status: 'sold', imei1: '222', imei2: '333' },
  { id: 'reserved', status: 'reserved', serial: 'R1' },
  { id: 'repair', status: 'rma', serial: 'A1' },
  { id: 'missing', status: 'hidden', imei1: '777' },
];
const result = getModelIdentifierSections({ units, skuGroups: [{ identifiers: [
  { productId: 'cached-sold', imei1: '333' },
  { productId: 'cached-stock', imei1: '111' },
  { productId: 'unknown', imei1: '999' },
  { productId: 'duplicate', imei1: '999' },
] }] });
assert.deepEqual(result.available.map(unit => unit.id), ['stock']);
assert.deepEqual(result.sold.map(unit => unit.id), ['sold']);
assert.deepEqual(result.other.map(unit => unit.id), ['reserved', 'repair']);
assert.deepEqual(result.hidden.map(unit => unit.id), ['missing']);
assert.deepEqual(result.unconfirmed.map(unit => unit.productId), ['unknown']);
assert.deepEqual(getModelIdentifierSections({}).available, []);
assert.equal(units[1].status, 'sold');
const aggregate = aggregateModelProducts({
  model: { name: 'Teste' },
  products: [{ id: 'p1', sku: 'TESTE', status: 'active', stock_quantity: 2, price_cost: 1000, specs: { color: 'Preto' } }],
  units: [{ id: 'u1', product_id: 'p1', status: 'available', imei_1: '111', cost_price: 1000 },
    { id: 'u2', product_id: 'p1', status: 'hidden', imei_1: '777', cost_price: 1000 }],
});
assert.equal(aggregate.totals.availableCount, 1);
assert.equal(aggregate.totals.soldCount, 0);
assert.equal(aggregate.totals.investedValue, 2000);
assert.equal(getModelIdentifierSections(aggregate.memoryGroups[0].colors[0]).hidden.length, 1);
console.log('Model IMEI stock/sold separation passed');
