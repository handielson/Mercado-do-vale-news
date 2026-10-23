import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModelParentPrefill } from '../services/modelParentPrefill.js';

test('a model opens a parent registration with its identity and no sellable stock', () => {
  const draft = buildModelParentPrefill({ id: 'poco-x8-5g', name: 'Poco X8 5G', category_id: 'smartphones' }, 'Xiaomi');
  assert.equal(draft.model_id, 'poco-x8-5g');
  assert.equal(draft.model, 'Poco X8 5G');
  assert.equal(draft.brand, 'Xiaomi');
  assert.equal(draft.category_id, 'smartphones');
  assert.equal(draft.is_parent, true);
  assert.equal(draft.product_format, 'parent');
  assert.equal(draft.track_inventory, false);
  assert.deepEqual(draft.images, []);
  assert.throws(() => buildModelParentPrefill({ id: 'model', name: 'Modelo' }, ''), /marca/);
});

test('the registration path rechecks the family and returns to the saved parent', () => {
  const dashboard = readFileSync(new URL('../pages/admin/products/ModelProductAggregatorPage.tsx', import.meta.url), 'utf8');
  const productForm = readFileSync(new URL('../pages/admin/products/ProductFormPage.tsx', import.meta.url), 'utf8');
  const modelPhotos = readFileSync(new URL('../components/settings/ModelParentImages.tsx', import.meta.url), 'utf8');
  const modelsPage = readFileSync(new URL('../pages/admin/settings/ModelsPage.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /await productService\.listParentsByModel\(modelId\)/);
  assert.match(dashboard, /buildModelParentPrefill\(data\.model, brand\?\.name\)/);
  assert.match(modelsPage, /await productService\.listParentsByModel\(model\.id\)/);
  assert.match(modelsPage, /Produto pai, fotos e variaç[õo]es/);
  assert.match(productForm, /if \(savedProduct\?\.is_parent && savedProduct\.id\)/);
  assert.match(modelPhotos, /Criar produto pai e variaç[õo]es/);
});
