import assert from 'node:assert/strict';
import { filterAdminProducts } from '../hooks/adminProductFilters';
import type { Product } from '../types/product';

const filters = { search: '', status: 'all', sortBy: 'newest', imageStatus: 'all', parentVisibility: 'hide_parents', brand: 'all', categoryId: 'all', shopeeStatus: 'all', shopeeStore: 'all', videoStatus: 'all' } as const;
const products = [
  { id: 'a', name: 'Azul', sku: 'A', status: 'active', images: ['photo'], brand: 'Marca A', shopee_store_codes: ['M'] },
  { id: 'b', name: 'Branco', sku: 'B', status: 'active', images: [], parent_id: 'parent', shopee_store_codes: ['G'] },
  { id: 'c', name: 'Cinza', sku: 'C', status: 'active', images: [], shopee_store_codes: ['M', 'G'] },
  { id: 'd', name: 'Dourado', sku: 'D', status: 'active', images: [] },
  { id: 'parent', name: 'Pai', is_parent: true, status: 'active' },
] as Product[];
const ids = (items: Product[]) => items.map(item => item.id).sort();
for (const salesChannel of ['shopee', 'tiktok', 'mercado_livre', 'loja_3d', 'mercado_do_vale', 'bling'] as const) {
  assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel, channelStatus: 'linked' }, new Set(['a']))), ['a']);
  assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel, channelStatus: 'unlinked' }, new Set(['a']))), ['b', 'c', 'd']);
  assert.deepEqual(filterAdminProducts(products, { ...filters, salesChannel, channelStatus: 'unlinked' }, null), [], 'falha de consulta não significa sem vínculo');
  assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel, channelStatus: 'all' }, null)), ['a', 'b', 'c', 'd']);
}
assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel: 'tiktok', channelStatus: 'linked' }, new Set(['parent']))), ['b'], 'TikTok respeita vínculo no pai, como o card');
assert.deepEqual(filterAdminProducts(products, { ...filters, salesChannel: 'mercado_livre', channelStatus: 'linked' }, new Set(['parent'])), [], 'Mercado Livre não herda vínculo de outra variação');
assert.deepEqual(filterAdminProducts(products, { ...filters, salesChannel: 'loja_3d', channelStatus: 'linked', search: 'Branco' }, new Set(['a'])), [], 'busca e canal são combinados');
assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel: 'all', channelStatus: 'all' }, null)), ['a', 'b', 'c', 'd'], 'limpar recupera todos os produtos');
assert.deepEqual(ids(filterAdminProducts(products, { ...filters, shopeeStore: 'M' }, null)), ['a', 'c'], 'loja Shopee Mercado do Vale usa o código M dos cards');
assert.deepEqual(ids(filterAdminProducts(products, { ...filters, shopeeStore: 'G' }, null)), ['b', 'c'], 'loja Shopee Glaucia usa o código G dos cards');
assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel: 'shopee', shopeeStore: 'M', channelStatus: 'linked' }, new Set(['a', 'b', 'c']))), ['a', 'c'], 'vinculados consideram somente a loja Mercado do Vale');
assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel: 'shopee', shopeeStore: 'M', channelStatus: 'unlinked' }, new Set(['a', 'b', 'c']))), ['b', 'd'], 'não enviados consideram somente a loja Mercado do Vale');
assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel: 'shopee', shopeeStore: 'G', channelStatus: 'linked' }, new Set(['a', 'b', 'c']))), ['b', 'c'], 'vinculados consideram somente a loja Glaucia');
assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel: 'shopee', shopeeStore: 'G', channelStatus: 'unlinked' }, new Set(['a', 'b', 'c']))), ['a', 'd'], 'não enviados consideram somente a loja Glaucia');
assert.deepEqual(ids(filterAdminProducts([
  { id: 'legacy-m', name: 'Legado M', status: 'active', shopee_item_id: 123 },
] as Product[], { ...filters, shopeeStore: 'M' }, null)), ['legacy-m'], 'vínculo principal legado continua classificado como Mercado do Vale');
console.log('Filtros dos seis canais e lojas Shopee: OK');
