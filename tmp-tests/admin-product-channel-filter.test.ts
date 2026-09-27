import assert from 'node:assert/strict';
import { filterAdminProducts } from '../hooks/adminProductFilters';
import type { Product } from '../types/product';

const filters = { search: '', status: 'all', sortBy: 'newest', imageStatus: 'all', parentVisibility: 'hide_parents', brand: 'all', categoryId: 'all', shopeeStatus: 'all', videoStatus: 'all' } as const;
const products = [
  { id: 'a', name: 'Azul', sku: 'A', status: 'active', images: ['photo'], brand: 'Marca A' },
  { id: 'b', name: 'Branco', sku: 'B', status: 'active', images: [], parent_id: 'parent' },
  { id: 'parent', name: 'Pai', is_parent: true, status: 'active' },
] as Product[];
const ids = (items: Product[]) => items.map(item => item.id).sort();
for (const salesChannel of ['shopee', 'tiktok', 'mercado_livre', 'loja_3d', 'mercado_do_vale', 'bling'] as const) {
  assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel, channelStatus: 'linked' }, new Set(['a']))), ['a']);
  assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel, channelStatus: 'unlinked' }, new Set(['a']))), ['b']);
  assert.deepEqual(filterAdminProducts(products, { ...filters, salesChannel, channelStatus: 'unlinked' }, null), [], 'falha de consulta não significa sem vínculo');
  assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel, channelStatus: 'all' }, null)), ['a', 'b']);
}
assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel: 'tiktok', channelStatus: 'linked' }, new Set(['parent']))), ['b'], 'TikTok respeita vínculo no pai, como o card');
assert.deepEqual(filterAdminProducts(products, { ...filters, salesChannel: 'mercado_livre', channelStatus: 'linked' }, new Set(['parent'])), [], 'Mercado Livre não herda vínculo de outra variação');
assert.deepEqual(filterAdminProducts(products, { ...filters, salesChannel: 'loja_3d', channelStatus: 'linked', search: 'Branco' }, new Set(['a'])), [], 'busca e canal são combinados');
assert.deepEqual(ids(filterAdminProducts(products, { ...filters, salesChannel: 'all', channelStatus: 'all' }, null)), ['a', 'b'], 'limpar recupera todos os produtos');
console.log('Filtros dos seis canais: OK');
