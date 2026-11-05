// entrada-ajustes (v1.2.804, Task C): nova tentativa do produto único não zera o estoque, e o
// rascunho antigo com lista de seriais avisa que os aparelhos entram pela tela Entrada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  singleRetryUpdatePayload,
  legacyDraftSerialCount,
  legacyDraftSerialNotice,
  LEGACY_DRAFT_SERIAL_ENTRY_PATH,
  takeLegacyDraftSerialNotice,
} from '../components/products/productFormRecovery.js';

const read = path => readFileSync(path, 'utf8');

test('nova tentativa do cadastro novo omite stock_quantity e usa o SKU do checkpoint', () => {
  const merged = { name: 'Poco X8', sku: 'NOVO', stock_quantity: 0, price_retail: 100 };
  const payload = singleRetryUpdatePayload(merged, { id: 'p1', sku: 'MDV-1' }, true);
  assert.equal('stock_quantity' in payload, false, 'sem stock_quantity o servidor mantém o saldo');
  assert.equal(payload.sku, 'MDV-1');
  assert.equal(payload.name, 'Poco X8');
  assert.equal(merged.stock_quantity, 0, 'o objeto do primeiro envio não é alterado');
});

test('fora do cadastro novo, a nova tentativa mantém o stock_quantity do formulário', () => {
  const payload = singleRetryUpdatePayload({ name: 'X', stock_quantity: 3 }, { id: 'p1', sku: 'S' }, false);
  assert.equal(payload.stock_quantity, 3);
});

test('ProductForm: primeiro envio continua com estoque 0 e a nova tentativa usa o payload sem estoque', () => {
  const form = read('components/products/ProductForm.tsx');
  assert.match(form, /if \(isNewRegistration\) \{\s*mergedData\.specs = stripSerializedIdentityFromSpecs\(mergedData\.specs \|\| \{\}\);\s*mergedData\.stock_quantity = 0;\s*\}/);
  assert.match(form, /await productService\.update\(singleSaveCheckpoint\.current\.id, singleRetryUpdatePayload\(mergedData, singleSaveCheckpoint\.current, isNewRegistration\)\)/);
  assert.match(form, /: await onSubmit\(mergedData\) as Product \| undefined;/, 'primeiro cadastro manda mergedData (estoque 0)');
  assert.doesNotMatch(form, /productService\.update\(singleSaveCheckpoint\.current\.id, \{ \.\.\.mergedData/);
});

test('legacyDraftSerialCount conta só itens da serialList do snapshot', () => {
  assert.equal(legacyDraftSerialCount({ serialList: [{ imei1: '1' }, { imei1: '2' }] }), 2);
  assert.equal(legacyDraftSerialCount({ serialList: [] }), 0);
  assert.equal(legacyDraftSerialCount({}), 0);
  assert.equal(legacyDraftSerialCount(null), 0);
  assert.equal(legacyDraftSerialCount({ serialList: 'x' }), 0);
});

test('aviso do rascunho antigo: texto e link do Bipar', () => {
  assert.equal(legacyDraftSerialNotice(1), 'Este rascunho tinha 1 aparelho(s) na lista de seriais. Dê entrada deles pela tela Entrada.');
  assert.equal(legacyDraftSerialNotice(3), 'Este rascunho tinha 3 aparelho(s) na lista de seriais. Dê entrada deles pela tela Entrada.');
  assert.equal(LEGACY_DRAFT_SERIAL_ENTRY_PATH, '/admin/entrada?aba=bipar');
});

test('aviso aparece uma vez por rascunho (storage) e nunca para rascunho sem lista', () => {
  const memory = new Map();
  const storage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
  const draft = { id: 'd1', snapshot: { serialList: [{ imei1: '1' }, { imei1: '2' }] } };
  assert.equal(takeLegacyDraftSerialNotice(draft, storage), 2);
  assert.equal(takeLegacyDraftSerialNotice(draft, storage), 0, 'segunda abertura: sem aviso');
  assert.equal(takeLegacyDraftSerialNotice({ id: 'd2', snapshot: { serialList: [] } }, storage), 0);
  assert.equal(memory.has('mdv:legacy-serial-notice:d2'), false);
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(takeLegacyDraftSerialNotice(draft, broken), 2, 'storage bloqueado: mostra');
  assert.equal(takeLegacyDraftSerialNotice(draft, null), 2);
});

test('ProductFormPage mostra o aviso uma vez ao abrir o rascunho, com link para a Entrada', () => {
  const page = read('pages/admin/products/ProductFormPage.tsx');
  assert.match(page, /takeLegacyDraftSerialNotice\(draft, storage\)/, 'conta ao carregar o rascunho');
  assert.match(page, /data-legacy-serial-notice/);
  assert.match(page, /legacyDraftSerialNotice\(legacySerialCount\)/);
  assert.match(page, /to=\{LEGACY_DRAFT_SERIAL_ENTRY_PATH\}/);
  assert.match(page, /onClick=\{\(\) => setLegacySerialCount\(0\)\}/, 'o aviso pode ser fechado');
  // o próximo salvamento manda a lista vazia, então o aviso não volta ao reabrir.
  assert.match(read('components/products/ProductForm.tsx'), /serialList: \[\],/);
});

test('código morto do cadastro em lote antigo saiu', async () => {
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync('components/products/ProductEntryForm.tsx'), false);
  assert.equal(existsSync('components/products/entry'), false);
  assert.doesNotMatch(read('tmp-tests/unique-validation-vps-products-static.test.mjs'), /BatchEntryGrid/);
  assert.doesNotMatch(read('tmp-tests/print3d-product-specifications-render.test.cjs'), /serializedBatch/);
});
