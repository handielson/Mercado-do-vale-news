import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeFrequentMenuItems, menuItemForPath } from '../services/adminMenuFrequent.mjs';

const items = [
  { to: '/admin', label: 'Dashboard' }, { to: '/admin/products', label: 'Produtos' }, { to: '/admin/products/drafts', label: 'Rascunhos' },
  { to: '/admin/pdv', label: 'PDV' }, { to: '/admin/inventory', label: 'Estoque' }, { to: '/admin/products/labels', label: 'Etiquetas' },
];
const row = (pathname, customer_id = 'c1', created_at = '2026-11-02T10:00:00Z') => ({ pathname, customer_id, created_at });

test('caminho vira o item mais específico', () => {
  assert.equal(menuItemForPath('/admin/products/abc/edit', items).label, 'Produtos');
  assert.equal(menuItemForPath('/admin/products/drafts', items).label, 'Rascunhos');
  assert.equal(menuItemForPath('/admin', items).label, 'Dashboard');
  assert.equal(menuItemForPath('/admin/xyz', items), null, 'Dashboard não engole tudo');
});

test('ordena por visitas e desempata pela mais recente; só desta pessoa', () => {
  const rows = [row('/admin/pdv'), row('/admin/pdv'), row('/admin/products/1/edit'), row('/admin/products'), row('/admin/products/labels', 'c1', '2026-11-02T12:00:00Z'),
    row('/admin/inventory', 'c1', '2026-11-01T12:00:00Z'), ...Array(9).fill(row('/admin/inventory', 'outro'))];
  assert.deepEqual(computeFrequentMenuItems(rows, items, { customerId: 'c1' }).map(i => i.label), ['PDV', 'Produtos', 'Etiquetas', 'Estoque']);
  assert.equal(computeFrequentMenuItems(rows, items, { customerId: 'c1', limit: 2 }).length, 2);
});

test('sem visitas desta pessoa usa o histórico geral; sem histórico, vazio', () => {
  assert.equal(computeFrequentMenuItems([row('/admin/pdv', 'outro')], items, { customerId: 'c1' })[0].label, 'PDV');
  assert.deepEqual(computeFrequentMenuItems(null, items), []);
});

test('menu mostra "Mais usados" só sem busca e com itens', () => {
  const layout = fs.readFileSync(new URL('../layouts/AdminLayout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /data-menu-frequent/);
  assert.match(layout, /!search\.trim\(\) && frequentItems\.length > 0/);
});
