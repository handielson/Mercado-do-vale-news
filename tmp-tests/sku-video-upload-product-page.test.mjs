// sku-video-upload-v1: vídeo de cada variação enviado pela Página do Produto, sempre salvo como <SKU>.mp4.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const serviceSource = fs.readFileSync('services/productVideoUpload.ts', 'utf8');
const compiled = ts.transpileModule(serviceSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require: () => ({}) });

test('nome do vídeo é sempre o SKU da variação, qualquer que seja o arquivo original', () => {
  assert.equal(exports.productVideoFileName('REAL0001-01'), 'REAL0001-01.mp4');
  assert.equal(exports.productVideoFileName('  REAL0001-01 '), 'REAL0001-01.mp4');
  for (const bad of ['', '../X', 'A B', 'X?y']) assert.throws(() => exports.productVideoFileName(bad), /SKU definitivo/);
});

test('Página do Produto oferece envio de vídeo por SKU usando o envio canônico', () => {
  const page = fs.readFileSync('pages/admin/products/ModelProductAggregatorPage.tsx', 'utf8');
  assert.match(page, /import \{ SkuVideoUpload \} from '..\/..\/..\/components\/products\/SkuVideoUpload'/);
  assert.match(page, /<SkuVideoUpload sku=\{product\.sku\} \/>/);
  const ui = fs.readFileSync('components/products/SkuVideoUpload.tsx', 'utf8');
  assert.match(ui, /uploadProductVideo\(file, code/);
  assert.match(ui, /productVideoFileName\(code\)/);
  // F5 logo após o envio não pode reaproveitar o "não existe" guardado pelo navegador.
  assert.equal((ui.match(/checkVideoBySku\(code, \{ noCache: true \}\)/g) || []).length, 2);
  assert.doesNotMatch(ui, /checkVideoBySku\(code\)/);
  assert.match(ui, /accept="video\/mp4,\.mp4"/);
  assert.match(ui, /foi renomeado para/);
});
