import assert from 'node:assert/strict';
import {
  CATEGORY_SPEC_FIELD_METADATA,
  getCategoryDynamicSpecFields,
  getPrint3dDefaultSpecFields,
} from '../components/products/sections/categorySpecFieldCore.js';

const receptorConfig = {
  iks: 'required',
  sks: 'required',
  irda: 'required',
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
assert.equal(CATEGORY_SPEC_FIELD_METADATA.irda.type, 'select');
assert.deepEqual(CATEGORY_SPEC_FIELD_METADATA.irda.options, ['Sim', 'Não', 'Consulte']);

assert.deepEqual(
  getCategoryDynamicSpecFields(receptorConfig, { iks: 'Sim', irda: 'Não' }).map(field => field.key),
  ['serial']
);

console.log('category spec fields tests passed');

assert.deepEqual(getPrint3dDefaultSpecFields(null).map(field => field.key), ['material', 'size', 'finish']);
assert.deepEqual(getPrint3dDefaultSpecFields({material:'off',size:'required'}, [], {finish:'Fosco'}), []);
assert.deepEqual(getPrint3dDefaultSpecFields({custom_fields:[{technical_name:'specs.Tamanho'}]}, [{key:'Acabamento'}]).map(field=>field.key), ['material']);
assert.deepEqual(getPrint3dDefaultSpecFields({custom_fields:[{key:'material',requirement:'required'}]}).map(field=>field.key), ['size','finish']);
assert.equal(CATEGORY_SPEC_FIELD_METADATA.size.label, 'Tamanho');
assert.equal(CATEGORY_SPEC_FIELD_METADATA.finish.label, 'Acabamento');
