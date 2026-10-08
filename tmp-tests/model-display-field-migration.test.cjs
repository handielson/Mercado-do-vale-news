const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { migrateObject, buildPlan } = require('../services/modelDisplayFieldMigration.cjs');
test('moves display rate without using touch sampling rate and remains idempotent', () => {
  const result = migrateObject({ fps_do_display: 'Até 120Hz, toque 240Hz', nfc: 'Sim' });
  assert.deepEqual(result.value, { celular_fps_display: '120', nfc: 'Sim' });
  assert.equal(migrateObject(result.value).changed, false);
});
test('existing canonical value is preserved and conflict goes to backup audit', () => {
  const result = migrateObject({ fps_do_display: '120 Hz', celular_fps_display: '90' });
  assert.deepEqual(result.value, { celular_fps_display: '90' });
  assert.equal(result.conflict.old, '120 Hz');
});
test('unknown legacy value without canonical value blocks definition removal', () => {
  const plan = buildPlan({ models: [{ id: 'm', template_values: { fps_do_display: 'desconhecido' } }], fields: [{ id: 'f', key: 'fps_do_display' }] });
  assert.equal(plan.blocked.length, 1);
  assert.equal(plan.removeDefinition, false);
});
test('migrates category references, preserving other settings and fields', () => {
  const plan = buildPlan({ categories: [{ id: 'c', config: { fps_do_display: 'required', custom_fields: [{ field_id: 'f' }, { key: 'nfc' }], mercado_livre: { category_id: 'MLB1055' } } }], fields: [{ id: 'f', key: 'fps_do_display' }] });
  const after = JSON.parse(plan.changes[0].after);
  assert.equal(after.celular_fps_display, 'required');
  assert.deepEqual(after.custom_fields, [{ key: 'nfc' }]);
  assert.deepEqual(after.mercado_livre, { category_id: 'MLB1055' });
  assert.equal(plan.deletedFields.length, 1);
});
test('model fallback version choices are loaded from the canonical table; marketplace namespace is not a text field', () => {
  const source = fs.readFileSync('components/settings/ModelModal.tsx', 'utf8');
  assert.match(source, /const choiceFields = \[\.\.\.customFields, \.\.\.buildCategoryFallbackFields\(categoryConfig, customFields\)\]/);
  assert.match(source, /const relationFields = choiceFields\.filter/);
  assert.match(source.slice(source.indexOf('const NON_TEMPLATE_CATEGORY_KEYS'), source.indexOf('const GLOBAL_SPEC_FIELD_BLOCKLIST')), /'mercado_livre'/);
});
test('real model template fallback resolves version table and does not turn marketplace settings into a text input', () => {
  const source = fs.readFileSync('components/settings/ModelModal.tsx', 'utf8').replace(/\r\n/g, '\n');
  const code = source.slice(source.indexOf('const NON_TEMPLATE_CATEGORY_KEYS'), source.indexOf('/**\n * TemplateFieldInput Component'));
  const context = { getFieldDefinition: () => undefined, isModelUnitFieldKey: () => false, isModelVariationFieldKey: () => false, exports: {} };
  vm.runInNewContext(ts.transpileModule(code + '\nexports.build = buildCategoryFallbackFields;', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
  const fields = context.exports.build({ versao: 'optional', mercado_livre: { category_id: 'MLB1055' } }, [], { mercado_livre: { attributes: { BRAND: 'Xiaomi' } } });
  assert.equal(fields.length, 1);
  assert.equal(fields[0].key, 'versao');
  assert.equal(fields[0].field_type, 'table_relation');
  assert.equal(fields[0].table_config.table_name, 'versions');
});
