import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFamilyChildPrefill } from '../services/productClonePrefill.js';

test('nova variação herda dados comuns e recebe vínculo seguro com a família', () => {
  const child = buildFamilyChildPrefill({
    id: 'family-1',
    name: 'Chaveiro 3D',
    sku: 'CHA-PAI',
    is_parent: 1,
    is_print3d: true,
    images: ['https://cdn.test/chaveiro.jpg'],
    description: 'Descrição compartilhada',
    stock_quantity: 25,
    eans: ['7890000000000'],
    bling_id: 123,
    bling_parent_id: 99,
    shopee_item_id: 456,
    print3d_preorder_enabled: true,
    print3d_preorder_limit: 100,
  });

  assert.equal(child.parent_id, 'family-1');
  assert.equal(child.is_parent, false);
  assert.equal(child.product_format, 'variation');
  assert.equal(child.name, 'Chaveiro 3D - Nova variação');
  assert.equal(child.sku, '');
  assert.equal(child.stock_quantity, 0);
  assert.deepEqual(child.eans, []);
  assert.deepEqual(child.images, ['https://cdn.test/chaveiro.jpg']);
  assert.equal(child.description, 'Descrição compartilhada');
  assert.equal(child.is_print3d, true);
  assert.equal(child.bling_id, null);
  assert.equal(child.shopee_item_id, null);
  assert.equal(child.print3d_preorder_enabled, false);
  assert.equal(child.print3d_preorder_limit, null);
});

test('não cria variação para uma família ainda não salva', () => {
  assert.throws(() => buildFamilyChildPrefill({ name: 'Sem ID' }), /precisa estar salva/);
});
