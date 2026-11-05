// stock-entry-only-v1 (entrada única, etapa 6): estoque e aparelhos entram só pela tela Entrada.
// O formulário "Novo produto" cadastra catálogo; depois oferece "Dar entrada no estoque".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { saveFamilyRegistration } from '../components/products/familyRegistration.js';
import { entryAfterRegistrationPath } from '../services/entryShortcuts.js';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = path => readFileSync(path, 'utf8');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(name)) out.push(full);
  }
  return out;
}

// TODO(etapa 6, Task 3): QuickRegisterForm.tsx é apagado na Task 3; aí esta lista fica vazia.
const DELETED_IN_TASK_3 = new Set([join('components', 'products', 'bulk', 'QuickRegisterForm.tsx')]);

// As definições (não chamadas): vpsApiService.createUnit/createUnitsBatch e o unitService.create,
// que embrulha vpsApiService.createUnit. Continuam para o script de manutenção e a leitura.
const DEFINITIONS = [
  { file: join('services', 'vpsApiService.ts'), line: /async createUnit(sBatch)?\(|\[vpsApiService\] createUnit(sBatch)? error/ },
  { file: join('services', 'units.ts'), line: /const data = await vpsApiService\.createUnit\(toPayload\(input\)\);/ },
];

// Review Focus 1
test('nenhum caminho do SPA cria unidade fora da Entrada', () => {
  const offenders = [];
  for (const file of [...walk('pages'), ...walk('components'), ...walk('services')]) {
    if (DELETED_IN_TASK_3.has(file)) continue;
    read(file).split('\n').forEach((line, index) => {
      const creates = /\bunitService\.create\b|\bcreateUnitsBatch\b|\bcreateUnit\b/.test(line)
        || /\.post\b[^\n]*['"`]\/(table-data\/)?units(\/batch|\/bulk)?['"`]/.test(line);
      if (!creates) return;
      if (DEFINITIONS.some(def => def.file === file && def.line.test(line))) return;
      offenders.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [], 'unidade só nasce pela Entrada (catalogEntryServer.cjs)');
});

// Review Focus 3 + Global Constraints (família, no cadastro e na edição)
test('editar família e adicionar cor nova com IMEI: cria só o produto filho, sem unidade', async () => {
  const created = [], updated = [], units = [];
  const api = {
    create: async data => { created.push(data); return { ...data, id: `id-${created.length}`, sku: `SKU-${created.length}` }; },
    update: async (id, data) => { updated.push(id); return { ...data, id }; },
    createUnit: async () => { units.push(1); const error = new Error('Entrada de estoque é feita pela tela Entrada (Admin → Entrada).'); error.status = 409; throw error; },
  };
  const checkpoint = { parent: { id: 'pai', sku: 'POCO' }, children: {} };
  const rows = [
    { key: 'preto', data: { id: 'filho-preto', name: 'Poco - Preto', sku: 'POCO-01', specs: { color: 'Preto' } }, inheritImages: true },
    { key: 'azul', data: { name: 'Poco - Azul', stock_quantity: 3, specs: { color: 'Azul', imei1: '869084081597944', imei2: '869084081597951', serial: 'AB12' } }, inheritImages: true },
  ];
  await saveFamilyRegistration({ name: 'Poco', sku: 'POCO' }, rows, checkpoint, api);
  assert.equal(units.length, 0, 'nenhuma chamada a createUnit');
  assert.deepEqual(updated, ['pai', 'filho-preto']);
  assert.equal(created.length, 1, 'a cor nova vira produto filho');
  assert.equal(created[0].parent_id, 'pai');
  assert.equal(created[0].stock_quantity, 0, 'filho novo nasce sem estoque');
  for (const key of ['imei1', 'imei2', 'serial']) assert.equal(created[0].specs[key], undefined, `${key} da linha é ignorado`);
  assert.equal(checkpoint.units, undefined);
  assert.equal(checkpoint.pendingUnits, undefined);
  assert.equal(rows[1].data.specs.imei1, '869084081597944', 'o rascunho da tela não é alterado');

  // Sem createUnit no api (o formulário não passa mais), a linha com IMEI não trava.
  await saveFamilyRegistration({ name: 'Poco' }, [{ key: 'n', data: { name: 'Poco - Verde', specs: { serial: 'X1' } }, inheritImages: true }],
    { parent: null, children: {} }, { create: async data => ({ ...data, id: data.name }), update: async (id, data) => ({ ...data, id }) });
});

test('familyRegistration não grava unidade nem guarda IMEI pendente', () => {
  const source = read('components/products/familyRegistration.js');
  assert.doesNotMatch(source, /createUnit|pendingUnits|checkpoint\.units/);
});

test('formulário em modo cadastro não cria unidade, lista de seriais nem estoque', () => {
  const form = read('components/products/ProductForm.tsx');
  for (const gone of [/unitService/, /serialList(?!: \[\],)/, /handleAddToBatchList/, /groupSerializedBatchItemsForUnits/, /Lista para Cadastro em Massa/, /onAddToBatchList/, /singleSerializedIdentity/, /isSerializedStockCalculated/, /handleBatchItemImageUpload/, /handleBatchItemBlingLink/, /buildSerializedBatchPlan/])
    assert.doesNotMatch(form, gone, `${gone} saiu do formulário`);
  assert.match(form, /serialList: \[\],/, 'rascunho continua mandando a lista vazia (o servidor de rascunhos exige o campo)');
  assert.match(form, /const isNewRegistration = !initialData \|\| Boolean\(initialDraft && !initialData\.id\);/);
  // cadastro novo: IMEI/serial fora dos specs e estoque 0, antes de salvar produto único ou família.
  const strip = form.indexOf('// stock-entry-only-v1: cadastro novo grava só o catálogo');
  assert(strip > form.indexOf('if (variationDraftMode) {'), 'depois do rascunho de variação');
  assert(strip < form.indexOf('const saved = await saveFamilyRegistration('), 'antes de salvar a família');
  assert.match(form.slice(strip, strip + 400), /if \(isNewRegistration\) \{\s*mergedData\.specs = stripSerializedIdentityFromSpecs\(mergedData\.specs \|\| \{\}\);\s*mergedData\.stock_quantity = 0;\s*\}/);
  // quantidade em estoque: só na edição; no cadastro, o aviso.
  const stock = form.slice(form.indexOf('{/* Campo: Quantidade em Estoque */}'), form.indexOf('{/* 6. PRECIFICAÇÃO */}'));
  assert.match(stock, /\{isNewRegistration \|\| \(variationDraftMode && !initialData\?\.id\) \? \([\s\S]*Estoque e aparelhos entram pela tela Entrada[\s\S]*\) : watch\('track_inventory'\) !== false && \(/);
  assert.match(stock, /value=\{watch\('stock_quantity'\) \|\| 0\}/, 'edição continua igual');
  // IMEI/serial somem no cadastro e nas linhas de família (cadastro e edição).
  assert.match(form, /hideUnitIdentity=\{isNewRegistration \|\| variationDraftMode\}/);
});

test('especificações escondem IMEI/serial e mostram o aviso da Entrada', () => {
  const specs = read('components/products/sections/ProductSpecifications.tsx');
  assert.match(specs, /if \(hideUnitIdentity && UNIT_IDENTITY_KEYS\.includes\(key\)\) return false;/);
  assert.match(specs, /data-unit-entry-hint[^>]*>\s*Estoque e aparelhos entram pela tela Entrada\./);
  assert.doesNotMatch(specs, /onAddToBatchList|Adicionar à Lista/);
});

test('entryAfterRegistrationPath: simples/variação, família com modelo, família sem modelo', () => {
  assert.equal(entryAfterRegistrationPath({ id: 'p1' }), '/admin/entrada?variacao=p1');
  assert.equal(entryAfterRegistrationPath({ id: 'v1', parent_id: 'pai' }), '/admin/entrada?variacao=v1');
  assert.equal(entryAfterRegistrationPath({ id: 'pai', is_parent: true, model_id: 'm 1' }, [{ id: 'c1' }]), '/admin/entrada?aba=manual&modelo=m%201');
  assert.equal(entryAfterRegistrationPath({ id: 'pai', is_parent: true }, [null, { id: 'c1' }, { id: 'c2' }]), '/admin/entrada?variacao=c1');
  assert.equal(entryAfterRegistrationPath({ id: 'pai', is_parent: true }, []), null);
  assert.equal(entryAfterRegistrationPath({}), null);
  assert.equal(entryAfterRegistrationPath(undefined), null);
});

function runBatchComplete({ isEditMode = false, savedProduct, snapshot, preview = false }) {
  const page = read('pages/admin/products/ProductFormPage.tsx');
  const start = page.indexOf('    const offerStockEntry = ');
  const end = page.indexOf('    const handleCancel = ');
  assert(start > 0 && end > start, 'offerStockEntry + handleBatchComplete');
  const snippet = page.slice(start, end) + '\nexports.complete=handleBatchComplete;';
  const toasts = [], navigations = [];
  const toast = (message, options) => toasts.push({ message, options });
  toast.info = toast; toast.success = toast;
  const ctx = {
    exports: {}, isEditMode, toast, navigate: path => navigations.push(path), draftMeta: { current: null },
    isLocalCatalogPreviewRuntime: () => preview, setDraftRevision() {}, handleSaveDraft: async () => {},
    productFormDraftsService: { setStatus: async () => {} }, entryAfterRegistrationPath,
  };
  vm.runInNewContext(ts.transpileModule(snippet, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, ctx);
  return ctx.exports.complete(savedProduct, snapshot).then(() => ({ toasts, navigations }));
}

test('depois do cadastro aparece "Dar entrada no estoque"; o 3D segue para a calculadora', async () => {
  const simple = await runBatchComplete({ savedProduct: { id: 'p1' } });
  assert.deepEqual(simple.navigations, ['/admin/products']);
  assert.equal(simple.toasts.length, 1);
  assert.equal(simple.toasts[0].options.action.label, 'Dar entrada no estoque');
  assert.match(simple.toasts[0].options.description, /Estoque e aparelhos entram pela tela Entrada/);
  simple.toasts[0].options.action.onClick();
  assert.deepEqual(simple.navigations, ['/admin/products', '/admin/entrada?variacao=p1']);

  const print3d = await runBatchComplete({ savedProduct: { id: 'p3', is_print3d: true } });
  assert.deepEqual(print3d.navigations, ['/admin/loja-3d/calculadora?product_id=p3#ficha-producao-3d']);
  print3d.toasts[0].options.action.onClick();
  assert.equal(print3d.navigations[1], '/admin/entrada?variacao=p3');

  const family = await runBatchComplete({ savedProduct: { id: 'pai', is_parent: true }, snapshot: { familyCheckpoint: { children: { a: { id: 'c1' }, b: { id: 'c2' } } } } });
  assert.deepEqual(family.navigations, ['/admin/products/pai']);
  family.toasts[0].options.action.onClick();
  assert.equal(family.navigations[1], '/admin/entrada?variacao=c1');

  const familyWithModel = await runBatchComplete({ savedProduct: { id: 'pai', is_parent: true, model_id: 'm1' }, snapshot: { familyCheckpoint: { children: { a: { id: 'c1' } } } } });
  familyWithModel.toasts[0].options.action.onClick();
  assert.equal(familyWithModel.navigations[1], '/admin/entrada?aba=manual&modelo=m1');

  const edit = await runBatchComplete({ isEditMode: true, savedProduct: { id: 'p1' } });
  assert.equal(edit.toasts.length, 0, 'edição não oferece entrada');
  const noProduct = await runBatchComplete({ savedProduct: undefined });
  assert.equal(noProduct.toasts.length, 0);
});
