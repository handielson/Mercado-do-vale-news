import assert from 'node:assert/strict';
import {
  CATEGORY_SPEC_FIELD_METADATA,
  getCategoryDynamicSpecFields,
} from '../components/products/sections/categorySpecFieldCore.js';

const receptorConfig = {
  iks: 'required',
  sks: 'required',
  serial: 'required',
  ram: 'off',
  custom_fields: [],
  ean_autofill_config: { enabled: true },
};

assert.deepEqual(
  getCategoryDynamicSpecFields(receptorConfig).map(field => field.key),
  ['serial']
);

assert.equal(CATEGORY_SPEC_FIELD_METADATA.iks.type, 'select');
assert.deepEqual(CATEGORY_SPEC_FIELD_METADATA.iks.options, ['Sim', 'Não', 'Consulte']);
assert.equal(CATEGORY_SPEC_FIELD_METADATA.sks.type, 'select');
assert.deepEqual(CATEGORY_SPEC_FIELD_METADATA.sks.options, ['Sim', 'Não', 'Consulte']);

assert.deepEqual(
  getCategoryDynamicSpecFields(receptorConfig, { iks: 'Sim' }).map(field => field.key),
  ['serial']
);

console.log('category spec fields tests passed');
