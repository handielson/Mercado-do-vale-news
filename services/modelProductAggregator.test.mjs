import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aggregateModelProducts } from './modelProductAggregator.js';

const model = { id: 'model-redmi-15', name: 'Redmi 15', brand: 'Xiaomi', category_name: 'Smartphones' };

const products = [
  {
    id: 'p-roxo',
    model_id: 'model-redmi-15',
    model: 'Redmi 15',
    name: 'Redmi 15',
    sku: 'R158256R',
    slug: 'redmi-15-roxo',
    specs: { ram: '8GB RAM', storage: '256GB', color: 'Roxo' },
    price_cost: 117600,
    price_retail: 122600,
    price_reseller: 117600,
    price_wholesale: 112600,
    stock_quantity: 2,
    status: 'active',
  },
  {
    id: 'p-preto',
    model_id: 'model-redmi-15',
    model: 'Redmi 15',
    name: 'Redmi 15',
    sku: 'R158256P',
    slug: 'redmi-15-preto',
    specs: { RAM: '8GB RAM', armazenamento: '256GB', Cor: 'Preto' },
    price_cost: 118000,
    price_retail: 123000,
    price_reseller: 118000,
    price_wholesale: 113000,
    stock_quantity: 1,
    status: 'active',
  },
  {
    id: 'p-incomplete',
    model_id: 'model-redmi-15',
    model: 'Redmi 15',
    name: 'Redmi 15',
    sku: 'R15BAD',
    specs: { ram: '8GB RAM', color: 'Azul' },
    price_cost: 100000,
    price_retail: 110000,
    stock_quantity: 1,
    status: 'active',
  },
];

const units = [
  { id: 'u1', product_id: 'p-roxo', imei_1: '111', imei_2: '222', serial_number: 'S1', status: 'available', cost_price: 110000, location_id: 'loc-a' },
  { id: 'u2', product_id: 'p-roxo', imei_1: '333', imei_2: '444', serial_number: 'S2', status: 'sold', cost_price: 111000, sale_id: 'sale-1' },
  { id: 'u3', product_id: 'p-preto', imei_1: '555', imei_2: '666', serial_number: 'S3', status: 'available', location_id: 'loc-b' },
  { id: 'u4', product_id: 'p-incomplete', imei_1: '777', status: 'available' },
];

const saleReturnByUnitId = {
  u2: 122600,
};

const locationsByProductId = {
  'p-roxo': [
    { location_id: 'loc-a', location_name: 'Loja', deposit_name: 'Principal', quantity: 1 },
  ],
  'p-preto': [
    { location_id: 'loc-b', location_name: 'Estoque', deposit_name: 'Principal', quantity: 1 },
  ],
};

const result = aggregateModelProducts({
  model,
  products,
  units,
  saleReturnByUnitId,
  locationsByProductId,
});

assert.equal(result.model.id, 'model-redmi-15');
assert.equal(result.memoryGroups.length, 2);

const memoryGroup = result.memoryGroups.find((group) => group.ram === '8GB RAM' && group.storage === '256GB');
assert.ok(memoryGroup);
assert.equal(memoryGroup.availableCount, 2);
assert.equal(memoryGroup.soldCount, 1);
assert.equal(memoryGroup.stockCostValue, 228000);
assert.equal(memoryGroup.investedValue, 339000);
assert.equal(memoryGroup.returnedValue, 122600);
assert.equal(memoryGroup.colors.length, 2);

const roxo = memoryGroup.colors.find((group) => group.color === 'Roxo');
assert.ok(roxo);
assert.equal(roxo.availableCount, 1);
assert.equal(roxo.soldCount, 1);
assert.equal(roxo.units.length, 2);
assert.equal(roxo.locations.length, 1);
assert.equal(roxo.locations[0].location_name, 'Loja');
assert.equal(roxo.products[0].publicUrl, '/produto/redmi-15-roxo');
assert.equal(roxo.products[0].editUrl, '/admin/products/p-roxo/redmi-15-roxo');
assert.equal(roxo.products[0].modelPanelUrl, '/admin/products/models/model-redmi-15');

const incomplete = result.memoryGroups.find((group) => group.isIncomplete);
assert.ok(incomplete);
assert.equal(incomplete.missingFields.includes('storage'), true);

const source = readFileSync(new URL('./modelProductAggregator.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /supabase|vercel|VITE_SUPABASE|SUPABASE/i);

console.log('model product aggregator tests passed');
