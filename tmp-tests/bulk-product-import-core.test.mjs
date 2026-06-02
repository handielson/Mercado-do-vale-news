import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildBulkImportPayload,
  buildBulkImportPlan,
  buildBulkProductTemplateExampleRows,
  buildBulkProductTemplateHeaders,
  normalizeBulkImportRow,
  validateBulkImportRows,
} from '../services/bulkProductImportCore.js';

const receptorConfig = {
  serial: 'required',
  iks: 'required',
  sks: 'required',
  ram: 'off',
  storage: 'off',
};

const smartphoneConfig = {
  imei1: 'required',
  imei2: 'optional',
  serial: 'required',
  color: 'required',
  ram: 'required',
  storage: 'required',
  version: 'optional',
  battery_health: 'optional',
};

const receptorHeaders = buildBulkProductTemplateHeaders({ categoryConfig: receptorConfig });
assert.ok(receptorHeaders.includes('specs.serial'), 'receiver template must include serial');
assert.ok(!receptorHeaders.includes('specs.iks'), 'receiver product template must not include model-level IKS');
assert.ok(!receptorHeaders.includes('specs.sks'), 'receiver product template must not include model-level SKS');

const receptorExampleRows = buildBulkProductTemplateExampleRows({
  category: { id: 'cat-receptor', name: 'Receptores' },
  categoryConfig: receptorConfig,
});
assert.equal(receptorExampleRows.length, 1, 'template must include one editable example row');
assert.equal(receptorExampleRows[0].categoria_id, 'cat-receptor');
assert.equal(receptorExampleRows[0].categoria_nome, 'Receptores');
assert.equal(receptorExampleRows[0]['specs.serial'], 'SN123456789');
assert.equal(receptorExampleRows[0]['specs.iks'], undefined, 'template example must not include IKS');
assert.equal(receptorExampleRows[0]['specs.sks'], undefined, 'template example must not include SKS');

const smartphoneHeaders = buildBulkProductTemplateHeaders({ categoryConfig: smartphoneConfig });
for (const key of ['specs.imei1', 'specs.imei2', 'specs.serial', 'specs.color', 'specs.ram', 'specs.storage', 'specs.version']) {
  assert.ok(smartphoneHeaders.includes(key), `smartphone template must include ${key}`);
}

const normalized = normalizeBulkImportRow({
  SKU: ' rn13-pre ',
  Nome: 'Redmi Note 13',
  preco_varejo: '1.499,90',
  garantia_tipo: 'marca',
  'Specs Serial': ' SN-001 ',
  'IMEI 1': '123456789012345',
});
assert.equal(normalized.sku, 'RN13-PRE');
assert.equal(normalized.name, 'Redmi Note 13');
assert.equal(normalized.price_retail, 149990);
assert.equal(normalized.warranty_type, 'brand');
assert.equal(normalized.specs.serial, 'SN-001');
assert.equal(normalized.specs.imei1, '123456789012345');

const validationRows = [
  normalizeBulkImportRow({
    sku: 'SKU-001',
    nome: 'Produto 1',
    modelo_id: 'model-1',
    categoria_id: 'cat-1',
    preco_custo: '100',
    preco_varejo: '150',
    preco_revenda: '140',
    preco_atacado: '130',
    'specs.serial': 'SER-001',
    'specs.imei1': '123',
  }),
  normalizeBulkImportRow({
    sku: 'SKU-001',
    nome: 'Produto 2',
    modelo_id: 'model-1',
    categoria_id: 'cat-1',
    preco_custo: '100',
    preco_varejo: '150',
    preco_revenda: '140',
    preco_atacado: '130',
    'specs.serial': 'SER-001',
    'specs.imei1': '123456789012346',
  }),
  normalizeBulkImportRow({
    sku: '',
    nome: '',
    modelo_id: '',
    categoria_id: '',
    preco_varejo: '',
  }),
];

const validations = validateBulkImportRows(validationRows, { categoryConfig: smartphoneConfig });
assert.ok(validations[0].errors.some((error) => error.code === 'invalid_imei'), 'invalid IMEI must be reported');
assert.ok(validations[1].errors.some((error) => error.code === 'duplicate_batch_sku'), 'batch duplicated SKU must be reported');
assert.ok(validations[1].errors.some((error) => error.code === 'duplicate_batch_serialized_identifier'), 'batch duplicated serial must be reported');
assert.ok(validations[2].errors.some((error) => error.code === 'required_sku'), 'missing SKU must be reported');
assert.ok(validations[2].errors.some((error) => error.code === 'required_price'), 'missing required prices must be reported');

const existingProduct = {
  id: 'prod-1',
  sku: 'SKU-EXIST',
  name: 'Produto Existente',
  images: ['https://cdn.example/prod-1.webp'],
  specs: { serial: 'OLD-SERIAL', color: 'Preto' },
  bling_id: 123,
};

const planRows = [
  normalizeBulkImportRow({
    acao: 'upsert',
    sku: 'SKU-EXIST',
    nome: 'Produto Atualizado',
    modelo_id: 'model-1',
    categoria_id: 'cat-1',
    preco_custo: '100',
    preco_varejo: '150',
    preco_revenda: '140',
    preco_atacado: '130',
    'specs.serial': 'SER-NEW',
    bling_id: '',
  }),
  normalizeBulkImportRow({
    acao: 'upsert',
    sku: 'SKU-NEW',
    nome: 'Produto Novo',
    modelo_id: 'model-1',
    categoria_id: 'cat-1',
    preco_custo: '100',
    preco_varejo: '150',
    preco_revenda: '140',
    preco_atacado: '130',
    'specs.serial': 'SER-002',
  }),
];

const updatePlan = buildBulkImportPlan(planRows, {
  categoryConfig: receptorConfig,
  existingProductsBySku: new Map([['SKU-EXIST', existingProduct]]),
}, { updateExisting: true });
assert.equal(updatePlan.items[0].action, 'update');
assert.equal(updatePlan.items[0].existingProduct.id, 'prod-1');
assert.equal(updatePlan.items[1].action, 'create');

const skipPlan = buildBulkImportPlan(planRows, {
  categoryConfig: receptorConfig,
  existingProductsBySku: new Map([['SKU-EXIST', existingProduct]]),
}, { updateExisting: false });
assert.equal(skipPlan.items[0].action, 'skip');
assert.equal(skipPlan.items[0].debug.reason, 'existing_sku_update_disabled');

const payload = buildBulkImportPayload(planRows[0], existingProduct, {
  updateMode: 'filled_only',
  preserveImages: true,
});
assert.deepEqual(payload.images, existingProduct.images, 'bulk update payload must preserve existing images');
assert.equal(payload.bling_id, 123, 'empty Bling cell must preserve existing Bling link');
assert.equal(payload.specs.serial, 'SER-NEW');
assert.equal(payload.specs.color, 'Preto');

const coreSource = readFileSync(new URL('../services/bulkProductImportCore.js', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../services/bulk-products.ts', import.meta.url), 'utf8');
for (const [label, source] of [['core', coreSource], ['service', serviceSource]]) {
  assert.doesNotMatch(
    source,
    /@supabase\/supabase-js|services\/supabase|SUPABASE_|VITE_SUPABASE|supabase\.from/i,
    `${label} bulk import code must not depend on Supabase`
  );
}

console.log('bulk product import core tests passed');
