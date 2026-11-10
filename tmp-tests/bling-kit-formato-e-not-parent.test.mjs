import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBlingImportSelection,
  isBlingKitProduct,
  isBlingStructureProduct,
} from '../services/blingVariationImport.ts';

test('formato E identifica um kit vendável e formato V identifica um pai', () => {
  assert.equal(isBlingKitProduct({ id: 1, formato: 'E' }), true);
  assert.equal(isBlingStructureProduct({ id: 1, formato: 'E' }), false);
  assert.equal(isBlingStructureProduct({ id: 2, formato: 'V' }), true);
});

test('selecionar um kit não expande um grupo de variações', () => {
  const kit = { id: 1, formato: 'E', codigo: 'KIT5SLNBKUPG' };
  const linkedProduct = { id: 2, formato: 'S', variacao: { produtoPai: { id: kit.id } } };

  assert.deepEqual(buildBlingImportSelection([kit], [kit, linkedProduct]), {
    products: [kit],
    missingParentIds: [],
  });
});

test('selecionar uma variação traz primeiro o pai V e inclui os irmãos', () => {
  const parent = { id: 1, formato: 'V' };
  const first = { id: 2, formato: 'S', variacao: { produtoPai: { id: parent.id } } };
  const sibling = { id: 3, formato: 'S', variacao: { produtoPai: { id: parent.id } } };
  const kit = { id: 4, formato: 'E' };

  const result = buildBlingImportSelection([first], [kit, parent, first, sibling]);
  assert.equal(result.products[0], parent);
  assert.deepEqual(new Set(result.products), new Set([parent, first, sibling]));
  assert.equal(result.products.length, 3);
  assert.deepEqual(result.missingParentIds, []);
});

test('kit de quantidade do Bling vira quantity_kit ligado ao produto base', async () => {
  const { parseBlingKitComponents, buildBlingKitOfferLink } = await import('../services/blingVariationImport.ts');
  const detail = { formato: 'E', estrutura: { componentes: [{ produto: { id: 16711751146 }, quantidade: 5 }] } };
  const components = parseBlingKitComponents(detail);
  assert.deepEqual(components, [{ blingId: 16711751146, quantity: 5 }]);

  const link = buildBlingKitOfferLink(components, (id) => (id === 16711751146 ? 'slnbkug-local' : null));
  assert.deepEqual(link, {
    offer_type: 'quantity_kit',
    offer_parent_product_id: 'slnbkug-local',
    combo_children: [{ id: 'slnbkug-local', quantity: 5 }],
  });
});

test('kit com vários componentes vira product_combo e soma componentes repetidos', async () => {
  const { parseBlingKitComponents, buildBlingKitOfferLink } = await import('../services/blingVariationImport.ts');
  const components = parseBlingKitComponents({ estrutura: { componentes: [
    { produto: { id: 1 }, quantidade: 1 },
    { produto: { id: 2 }, quantidade: 2 },
    { produto: { id: 1 }, quantidade: 1 },
  ] } });
  const link = buildBlingKitOfferLink(components, (id) => `local-${id}`);
  assert.equal(link.offer_type, 'product_combo');
  assert.equal(link.offer_parent_product_id, null);
  assert.deepEqual(link.combo_children, [{ id: 'local-1', quantity: 2 }, { id: 'local-2', quantity: 2 }]);
});

test('kit sem componente importado falha com mensagem clara em vez de virar produto solto', async () => {
  const { buildBlingKitOfferLink } = await import('../services/blingVariationImport.ts');
  assert.throws(() => buildBlingKitOfferLink([{ blingId: 99, quantity: 5 }], () => null), /kit_componente_nao_importado.*99/);
  assert.throws(() => buildBlingKitOfferLink([], () => 'x'), /kit_sem_componentes/);
});

test('import do Bling liga o kit aos componentes depois de gravar o produto', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../services/blingService.ts', import.meta.url), 'utf8');
  assert.match(source, /estrutura: data\.estrutura/);
  assert.match(source, /if \(isBlingKitProduct\(enriched\)\)[\s\S]*buildBlingKitOfferLink[\s\S]*vpsApiService\.updateCombo\(persistedProductId/);
});
