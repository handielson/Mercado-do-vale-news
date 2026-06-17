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
assert.equal(memoryGroup.averageStockCost, 114000);
assert.equal(memoryGroup.investedValue, 339000);
assert.equal(memoryGroup.returnedValue, 122600);
assert.equal(memoryGroup.colors.length, 2);

const roxo = memoryGroup.colors.find((group) => group.color === 'Roxo');
assert.ok(roxo);
assert.equal(roxo.availableCount, 1);
assert.equal(roxo.soldCount, 1);
assert.equal(roxo.averageStockCost, 110000);
assert.equal(roxo.units.length, 2);
assert.equal(roxo.locations.length, 1);
assert.equal(roxo.locations[0].location_name, 'Loja');
assert.equal(roxo.units[0].locationLabel, 'Principal / Loja');
const roxoSoldUnit = roxo.units.find((unit) => unit.id === 'u2');
assert.equal(roxoSoldUnit.returnedValue, 122600);
assert.equal(roxoSoldUnit.profitValue, 11600);
assert.equal(roxoSoldUnit.saleUrl, '/admin/sales?sale=sale-1');
assert.equal(roxo.products[0].publicUrl, '/produto/redmi-15-roxo');
assert.equal(roxo.products[0].editUrl, '/admin/products/p-roxo/redmi-15-roxo');
assert.equal(roxo.products[0].modelPanelUrl, '/admin/products/models/model-redmi-15');

const incomplete = result.memoryGroups.find((group) => group.isIncomplete);
assert.ok(incomplete);
assert.equal(incomplete.missingFields.includes('storage'), true);

const locationOnlyResult = aggregateModelProducts({
  model,
  products: [
    {
      id: 'p-roxo-sem-serial',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256R2',
      slug: 'redmi-15-roxo-2',
      specs: { ram: '8GB', storage: '256GB', color: 'Roxo' },
      price_cost: 100000,
      price_retail: 120000,
      stock_quantity: 3,
      status: 'active',
    },
  ],
  units: [],
  locationsByProductId: {
    'p-roxo-sem-serial': [
      {
        deposit: { name: 'Loja Centro' },
        location: { name: 'Vitrine' },
        quantity: 2,
        reserved_quantity: 1,
      },
      {
        deposit_name: 'Estoque',
        location_name: '26081933-d030-4a38-a84b-d839e0035218',
        quantity: 1,
      },
    ],
  },
});

assert.equal(locationOnlyResult.totals.availableCount, 3);
assert.equal(locationOnlyResult.totals.stockCostValue, 300000);
assert.equal(locationOnlyResult.totals.averageStockCost, 100000);
assert.equal(locationOnlyResult.totals.investedValue, 300000);
assert.equal(locationOnlyResult.memoryGroups[0].colors[0].locations[0].label, 'Loja Centro / Vitrine');
assert.equal(locationOnlyResult.memoryGroups[0].colors[0].locations[1].label, 'Estoque / Local sem nome');
assert.equal(locationOnlyResult.memoryGroups[0].colors[0].products[0].availableCount, 3);

const duplicateSkuResult = aggregateModelProducts({
  model,
  products: [
    {
      id: 'p-titanio-a',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256T',
      slug: 'redmi-15-titanio-a',
      specs: { ram: '8GB', storage: '256GB', color: 'Titanio' },
      price_cost: 109400,
      stock_quantity: 3,
      status: 'active',
    },
    {
      id: 'p-titanio-b',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256T',
      slug: 'redmi-15-titanio-b',
      specs: { ram: '8GB', storage: '256GB', color: 'Titanio' },
      price_cost: 109400,
      stock_quantity: 3,
      status: 'active',
    },
    {
      id: 'p-titanio-c',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256T',
      slug: 'redmi-15-titanio-c',
      specs: { ram: '8GB', storage: '256GB', color: 'Titanio' },
      price_cost: 109400,
      stock_quantity: 3,
      status: 'active',
    },
  ],
  units: [],
  locationsByProductId: {
    'p-titanio-a': [{ location_id: 'loja-geral', deposit_name: 'Loja Principal', location_name: 'Estoque Geral', quantity: 3 }],
    'p-titanio-b': [{ location_id: 'loja-geral', deposit_name: 'Loja Principal', location_name: 'Estoque Geral', quantity: 3 }],
    'p-titanio-c': [{ location_id: 'loja-geral', deposit_name: 'Loja Principal', location_name: 'Estoque Geral', quantity: 3 }],
  },
});

const duplicateTitanio = duplicateSkuResult.memoryGroups[0].colors[0];
assert.equal(duplicateTitanio.availableCount, 3);
assert.equal(duplicateTitanio.stockCostValue, 328200);
assert.equal(duplicateTitanio.skuGroups.length, 1);
assert.equal(duplicateTitanio.skuGroups[0].sku, 'R158256T');
assert.equal(duplicateTitanio.skuGroups[0].availableCount, 3);

const serializedDivergenceResult = aggregateModelProducts({
  model,
  products: [
    {
      id: 'p-roxo-a',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256R',
      slug: 'redmi-15-roxo-a',
      specs: { ram: '8GB', storage: '256GB', color: 'Roxo', imei1: '860176074323905', imei2: '860176074323913' },
      price_cost: 102600,
      stock_quantity: 1,
      status: 'active',
    },
    {
      id: 'p-roxo-b',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256R',
      slug: 'redmi-15-roxo-b',
      specs: { ram: '8GB', storage: '256GB', color: 'Roxo', imei1: '860176074350221', imei2: '860176074350239' },
      price_cost: 102600,
      stock_quantity: 0,
      status: 'active',
    },
    {
      id: 'p-roxo-c',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256R',
      slug: 'redmi-15-roxo-c',
      specs: { ram: '8GB', storage: '256GB', color: 'Roxo', imei1: '860176074227403', imei2: '860176074227411' },
      price_cost: 102600,
      stock_quantity: 1,
      status: 'active',
    },
  ],
  units: [],
  locationsByProductId: {
    'p-roxo-a': [{ location_id: 'entrada', deposit_name: 'Deposito', location_name: 'Entrada / Conferencia', quantity: 1 }],
    'p-roxo-b': [],
    'p-roxo-c': [{ location_id: 'geral', deposit_name: 'Loja Principal', location_name: 'Estoque Geral', quantity: 1 }],
  },
});

const divergentRoxo = serializedDivergenceResult.memoryGroups[0].colors[0];
assert.equal(divergentRoxo.availableCount, 3);
assert.equal(divergentRoxo.stockCostValue, 307800);
assert.equal(divergentRoxo.skuGroups[0].registeredCount, 3);
assert.equal(divergentRoxo.skuGroups[0].locationCount, 2);
assert.equal(divergentRoxo.skuGroups[0].stockQuantityCount, 2);
assert.equal(divergentRoxo.skuGroups[0].hasStockDivergence, true);
assert.equal(divergentRoxo.stockDivergences.length, 1);
assert.equal(divergentRoxo.skuGroups[0].identifiers.length, 3);
assert.deepEqual(
  divergentRoxo.skuGroups[0].identifiers.map((item) => item.imei1),
  ['860176074323905', '860176074350221', '860176074227403']
);

const serializedStockQuantityNoiseResult = aggregateModelProducts({
  model,
  products: [
    {
      id: 'p-roxo-noise-a',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256R',
      slug: 'redmi-15-roxo-noise-a',
      specs: { ram: '8GB', storage: '256GB', color: 'Roxo', imei1: '860176074323905' },
      price_cost: 102600,
      stock_quantity: 2,
      status: 'active',
    },
    {
      id: 'p-roxo-noise-b',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256R',
      slug: 'redmi-15-roxo-noise-b',
      specs: { ram: '8GB', storage: '256GB', color: 'Roxo', imei1: '860176074350221' },
      price_cost: 102600,
      stock_quantity: 2,
      status: 'active',
    },
    {
      id: 'p-roxo-noise-c',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256R',
      slug: 'redmi-15-roxo-noise-c',
      specs: { ram: '8GB', storage: '256GB', color: 'Roxo', imei1: '860176074227403' },
      price_cost: 102600,
      stock_quantity: 1,
      status: 'active',
    },
  ],
  units: [],
  locationsByProductId: {
    'p-roxo-noise-a': [{ location_id: 'geral', deposit_name: 'Loja Principal', location_name: 'Estoque Geral', quantity: 3 }],
    'p-roxo-noise-b': [{ location_id: 'geral', deposit_name: 'Loja Principal', location_name: 'Estoque Geral', quantity: 3 }],
    'p-roxo-noise-c': [{ location_id: 'geral', deposit_name: 'Loja Principal', location_name: 'Estoque Geral', quantity: 3 }],
  },
});

const roxoWithNoisyStockQuantity = serializedStockQuantityNoiseResult.memoryGroups[0].colors[0];
assert.equal(roxoWithNoisyStockQuantity.availableCount, 3);
assert.equal(roxoWithNoisyStockQuantity.skuGroups[0].registeredCount, 3);
assert.equal(roxoWithNoisyStockQuantity.skuGroups[0].locationCount, 3);
assert.equal(roxoWithNoisyStockQuantity.skuGroups[0].stockQuantityCount, 5);
assert.equal(roxoWithNoisyStockQuantity.skuGroups[0].hasStockDivergence, false);
assert.equal(roxoWithNoisyStockQuantity.stockDivergences.length, 0);

const serializedLocationOvercountResult = aggregateModelProducts({
  model,
  products: [
    {
      id: 'p-roxo-over-a',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256R',
      slug: 'redmi-15-roxo-over-a',
      specs: { ram: '8GB', storage: '256GB', color: 'Roxo', imei1: '860176074323905' },
      price_cost: 102600,
      stock_quantity: 1,
      status: 'active',
    },
    {
      id: 'p-roxo-over-b',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256R',
      slug: 'redmi-15-roxo-over-b',
      specs: { ram: '8GB', storage: '256GB', color: 'Roxo', imei1: '860176074227403' },
      price_cost: 102600,
      stock_quantity: 1,
      status: 'active',
    },
    {
      id: 'p-roxo-over-c',
      model_id: 'model-redmi-15',
      name: 'Redmi 15',
      sku: 'R158256R',
      slug: 'redmi-15-roxo-over-c',
      specs: { ram: '8GB', storage: '256GB', color: 'Roxo', imei1: '860176074350221' },
      price_cost: 102600,
      stock_quantity: 1,
      status: 'active',
    },
  ],
  units: [],
  locationsByProductId: {
    'p-roxo-over-a': [{ location_id: 'entrada', deposit_name: 'Deposito', location_name: 'Entrada / Conferencia', quantity: 3 }],
    'p-roxo-over-b': [{ location_id: 'geral', deposit_name: 'Loja Principal', location_name: 'Estoque Geral', quantity: 1 }],
    'p-roxo-over-c': [],
  },
});

const roxoWithOvercountedLocations = serializedLocationOvercountResult.memoryGroups[0].colors[0];
assert.equal(roxoWithOvercountedLocations.availableCount, 3);
assert.equal(roxoWithOvercountedLocations.skuGroups[0].registeredCount, 3);
assert.equal(roxoWithOvercountedLocations.skuGroups[0].locationCount, 4);
assert.equal(roxoWithOvercountedLocations.skuGroups[0].hasStockDivergence, false);
assert.equal(roxoWithOvercountedLocations.stockDivergences.length, 0);

const serializedSkuWithSiblingFallbackResult = aggregateModelProducts({
  model: { id: 'model-athomics', name: 'Athomics Inspire Lite' },
  products: [
    {
      id: 'p-rail-units',
      model_id: 'model-athomics',
      name: 'Athomics Inspire Lite',
      sku: 'RAIL',
      slug: 'athomics-inspire-lite-serializado',
      specs: {},
      price_cost: 27500,
      price_retail: 45000,
      stock_quantity: 24,
      status: 'active',
    },
    {
      id: 'p-rail-fallback',
      model_id: 'model-athomics',
      name: 'Athomics Inspire Lite',
      sku: 'RAIL',
      slug: 'athomics-inspire-lite-cadastro',
      specs: {},
      price_cost: 27500,
      price_retail: 45000,
      stock_quantity: 137,
      status: 'active',
    },
  ],
  units: [
    { id: 'rail-u1', product_id: 'p-rail-units', status: 'available', serial_number: 'AT1', cost_price: 27500 },
    { id: 'rail-u2', product_id: 'p-rail-units', status: 'available', serial_number: 'AT2', cost_price: 27500 },
    { id: 'rail-u3', product_id: 'p-rail-units', status: 'available', serial_number: 'AT3', cost_price: 27500 },
    { id: 'rail-u4', product_id: 'p-rail-units', status: 'available', serial_number: 'AT4', cost_price: 27500 },
    { id: 'rail-u5', product_id: 'p-rail-units', status: 'available', serial_number: 'AT5', cost_price: 27500 },
    { id: 'rail-u6', product_id: 'p-rail-units', status: 'available', serial_number: 'AT6', cost_price: 27500 },
    { id: 'rail-u7', product_id: 'p-rail-units', status: 'sold', serial_number: 'AT7', cost_price: 27500, sale_id: 'sale-rail-1' },
    { id: 'rail-u8', product_id: 'p-rail-units', status: 'sold', serial_number: 'AT8', cost_price: 27500, sale_id: 'sale-rail-2' },
  ],
  saleReturnByUnitId: {
    'rail-u7': 45000,
    'rail-u8': 45000,
  },
  locationsByProductId: {
    'p-rail-units': [{ location_id: 'entrada', deposit_name: 'Deposito', location_name: 'Entrada / Conferencia', quantity: 18 }],
    'p-rail-fallback': [{ location_id: 'loja', deposit_name: 'Loja Principal', location_name: 'Estoque Geral', quantity: 6 }],
  },
});

const athomicsIncomplete = serializedSkuWithSiblingFallbackResult.memoryGroups[0];
const athomicsColor = athomicsIncomplete.colors[0];
assert.equal(serializedSkuWithSiblingFallbackResult.totals.availableCount, 6);
assert.equal(serializedSkuWithSiblingFallbackResult.totals.soldCount, 2);
assert.equal(serializedSkuWithSiblingFallbackResult.totals.stockCostValue, 165000);
assert.equal(serializedSkuWithSiblingFallbackResult.totals.investedValue, 220000);
assert.equal(serializedSkuWithSiblingFallbackResult.totals.returnedValue, 90000);
assert.equal(athomicsColor.availableCount, 6);
assert.equal(athomicsColor.soldCount, 2);
assert.equal(athomicsColor.skuGroups[0].sku, 'RAIL');
assert.equal(athomicsColor.skuGroups[0].availableCount, 6);

const nonSerializedSaleItemResult = aggregateModelProducts({
  model: { id: 'model-kaidi-kd-750', name: 'Kaidi KD-750' },
  products: [
    {
      id: 'p-kd-750-cinza',
      model_id: 'model-kaidi-kd-750',
      name: 'Fone de Ouvido Bluetooth Hifi Stereo, Kaidi KD-750 Cor:Cinza',
      sku: 'KD-750CIN',
      slug: 'fone-de-ouvido-bluetooth-hifi-stereo-kaidi-kd-750',
      specs: { color: 'Cinza' },
      price_cost: '6200.00',
      price_retail: '14390.00',
      stock_quantity: 4,
      status: 'active',
    },
  ],
  units: [],
  sales: [
    {
      id: 'a822a615-716b-4f47-bf6f-979937ce5cf4',
      payment_status: 'paid',
    },
  ],
  saleItems: [
    {
      sale_id: 'a822a615-716b-4f47-bf6f-979937ce5cf4',
      product_id: 'p-kd-750-cinza',
      product_sku: 'KD-750CIN',
      quantity: 1,
      unit_price: '14390.00',
      total: '14390.00',
      unit_cost: 6200,
      serialized_unit_id: null,
    },
  ],
  locationsByProductId: {
    'p-kd-750-cinza': [
      { location_id: 'loja', deposit_name: 'Loja Principal', location_name: 'Estoque Geral', quantity: 4 },
    ],
  },
});

assert.equal(nonSerializedSaleItemResult.totals.availableCount, 4);
assert.equal(nonSerializedSaleItemResult.totals.soldCount, 1);
assert.equal(nonSerializedSaleItemResult.totals.stockCostValue, 24800);
assert.equal(nonSerializedSaleItemResult.totals.investedValue, 31000);
assert.equal(nonSerializedSaleItemResult.totals.returnedValue, 14390);
assert.equal(nonSerializedSaleItemResult.memoryGroups[0].colors[0].soldCount, 1);
assert.equal(nonSerializedSaleItemResult.memoryGroups[0].colors[0].returnedValue, 14390);

const source = readFileSync(new URL('./modelProductAggregator.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /supabase|vercel|VITE_SUPABASE|SUPABASE/i);

console.log('model product aggregator tests passed');
