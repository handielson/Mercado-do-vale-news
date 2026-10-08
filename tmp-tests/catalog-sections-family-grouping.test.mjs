import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as core from '../services/productGroupingCore.js';
import { getCatalogCardDisplayName } from '../components/catalog/modernProductCardState.js';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const grouping = { exports: {}, require: id => {
  if (id.endsWith('productGroupingCore.js')) return core;
  if (id.includes('field-standards')) return { ProductStatus: { ACTIVE: 'active' } };
  if (id === './colors') return { getColorHex: () => '#000000' };
  throw Error('Unexpected dependency ' + id);
} };
vm.runInNewContext(compile(readFileSync('services/productGrouping.ts', 'utf8')), grouping);
const source = readFileSync('components/catalog/CatalogSection.tsx', 'utf8');
const start = source.indexOf('const displayItems = React.useMemo(');
const end = source.indexOf('if (loading)', start);
const block = source.slice(start, end);
assert.ok(start >= 0 && end > start);
const child = (id, ram, storage, color, price) => ({ id, name: 'Divergent child ' + id,
  parent_id: 'family', parent_name: 'POCO X8 Pro 5G', model_id: 'phone', brand: 'Xiaomi',
  status: 'active', track_inventory: true, stock_quantity: 1, price_retail: price,
  specs: { ram, storage, color }, images: ['image'],
});
const products = [child('black', '8GB', '256GB', 'Preto', 200000),
  { id: 'independent', name: 'Produto independente', status: 'active', price_retail: 1000, specs: {}, images: ['image'] },
  child('white', '12GB', '512GB', 'Branco', 240000),
  child('green', '8GB', '256GB', 'Verde', 210000),
  { ...child('sold-out', '8GB', '256GB', 'Roxo', 190000), stock_quantity: 0 },
  { ...child('inactive', '8GB', '256GB', 'Azul', 190000), status: 'inactive' },
];
for (const section_type of ['recent', 'new', 'bestsellers', 'custom', 'featured']) {
  for (const max_products of [1, 2]) {
    const context = { products, section: { section_type, max_products }, colorHexMap: {},
      React: { useMemo: fn => fn() }, groupProductsByVariants: grouping.exports.groupProductsByVariants };
    vm.runInNewContext(compile(block + '\nexports.items = displayItems;'), { ...context, exports: context });
    assert.equal(context.items.length, max_products);
    const group = context.items[0].productGroup;
    assert.equal(group.groupKey, 'family:family');
    assert.equal(getCatalogCardDisplayName(context.items[0]), 'POCO X8 Pro 5G');
    assert.equal(group.variants.length, 2);
    assert.deepEqual(Array.from(group.variants[0].colors, c => c.name), ['Preto', 'Verde']);
    assert.deepEqual(Array.from(group.variants.flatMap(v => v.products), p => p.price_retail), [200000, 210000, 240000]);
    if (max_products === 2) assert.equal(context.items[1].product.id, 'independent');
  }
}
console.log('Sections group families before card limits; parent name, prices, memory, colors and ranking preserved.');
