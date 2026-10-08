import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const source = readFileSync('services/catalogSectionsService.ts', 'utf8');
const filterStart = source.indexOf('if (section.filter_categories');
const filterEnd = source.indexOf('// Replace with Pinned products', filterStart);

assert(filterStart >= 0 && filterEnd > filterStart, 'catalog section category expansion block should exist');

const filterSource = source.slice(filterStart, filterEnd);

assert(
  /import\s+\{\s*vpsApiService\s+\}\s+from\s+['"]@\/services\/vpsApiService['"]/.test(source),
  'catalogSectionsService should import vpsApiService for category expansion',
);

assert(
  /vpsApiService\.getCategories\(\)/.test(filterSource),
  'catalog section category expansion should load category hierarchy from VPS',
);

assert(
  !/supabase\s*\.\s*from\('categories'\)|\.from\('categories'\)/.test(filterSource),
  'catalog section category expansion must not read categories directly from Supabase',
);

assert(
  /cat\.parent_id\s*&&\s*parentSet\.has\(cat\.parent_id\)/.test(filterSource),
  'catalog section category expansion should preserve parent-child expansion behavior',
);

console.log('catalog section category expansion VPS static checks passed');

// Executa o service real: os produtos desejados ficam alem do limite global da amostra.
const rows = [
  ...Array.from({ length: 300 }, (_, i) => ({ id: 'other-' + i, category_id: 'other', images: ['image'] })),
  { id: 'phone-parent', category_id: 'phones', images: ['image'] },
  { id: 'phone-child', category_id: 'smartphones', images: ['image'] },
  { id: 'tablet', category_id: 'tablets', images: ['image'] },
];
const requests = [];
const events = [];
const modules = {
  '@/services/catalogConfigService': { catalogConfigService: {
    getSettings: async () => ({}), applyVisibilityRules: products => products,
  } },
  '@/services/productNormalizer': { normalizeProduct: product => product },
  '@/services/vpsProxyBase': { buildVpsUrl: path => 'https://test.invalid' + path },
  '@/services/vpsApiService': { vpsApiService: { getCategories: async () => {
    events.push('categories'); return [{ id: 'smartphones', parent_id: 'phones' }];
  } } },
  '@/services/authSession': { buildAuthHeaders: async () => ({}), getCurrentAuthUserId: async () => null },
  '@/services/vpsAuthService': { vpsAuthService: { getStoredToken: () => null } },
};
const context = { exports: {}, require: id => modules[id] || {}, URLSearchParams, AbortSignal,
  console: { log() {}, warn() {}, error() {} }, fetch: async url => {
    events.push('products'); const params = new URL(url).searchParams; requests.push(params);
    let selected = rows;
    if (params.has('category')) selected = selected.filter(p => params.get('category').split(',').includes(p.category_id));
    if (params.has('in_ids')) selected = selected.filter(p => params.get('in_ids').split(',').includes(p.id));
    return { ok: true, json: async () => selected.slice(0, Number(params.get('limit'))) };
  } };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText, context);
const service = context.exports.catalogSectionsService;
const section = { id: 'test', title: 'Phones', section_type: 'custom', max_products: 1, filter_categories: ['phones', 'tablets'] };
const products = await service.getProductsForSection(section, true);
assert.deepEqual(Array.from(products, p => p.id), ['phone-parent', 'phone-child', 'tablet']);
assert.deepEqual(requests[0].get('category').split(','), ['phones', 'tablets', 'smartphones']);
assert.deepEqual(events, ['categories', 'products']);
assert.equal(requests[0].get('limit'), '20');
requests.length = 0;
const pinned = await service.getProductsForSection({ ...section, pinned_product_ids: ['other-1'] }, true);
assert.deepEqual(Array.from(pinned, p => p.id), ['other-1']);
assert.ok(requests.every(p => !p.has('category')), 'Produtos fixados preservam a prioridade sobre o filtro de categoria');
requests.length = 0;
await service.getProductsForSection({ ...section, filter_categories: [] }, true);
assert.ok(!requests[0].has('category'));
assert.ok(!source.includes('@mv:section_products:v7:'), 'Cache anterior nao pode restaurar amostras incompletas');
console.log('Section category filtering precedes the limited fetch; subcategories, pins and unfiltered sections preserved.');
