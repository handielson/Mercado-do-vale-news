import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBlingFamily, getIntakeBlingChild, intakeMappingKey, saveIntakeBlingMapping, photoQueueGroupKey } from '../services/modelBlingMapping.mjs';

const parent = { id: 100, codigo: 'PAI', nome: 'Modelo' };
const children = [{ id: 101, codigo: 'ROXO', nome: '8GB 256GB Roxo', situacao: 'A' }, { id: 102, codigo: 'VERDE', nome: '8GB 256GB Verde', situacao: 'A' }];
const intake = { id: 'one', company_id: 'company', matched_model_id: 'model', matched_color_id: 'purple', detected_color: 'Roxo', detected_ram: '8GB', detected_storage: '256GB', status: 'ready_to_finalize' };

test('family loads only real children; rejects a child, empty or malformed response', () => {
  for (const payload of [children, { data: children }, { variacoes: children }, { data: { variacoes: children } }]) {
    assert.equal(buildBlingFamily(parent, payload).children[0].sku, 'ROXO');
  }
  assert.throws(() => buildBlingFamily({ ...parent, variacao: { produtoPai: { id: 99 } } }, children));
  assert.throws(() => buildBlingFamily(parent, []));
  assert.throws(() => buildBlingFamily(parent, [{ id: 101 }]));
});

test('one confirmation persists across units, without guessing other colors, memories, models or companies', () => {
  const family = saveIntakeBlingMapping(buildBlingFamily(parent, children), intake, 101);
  assert.equal(getIntakeBlingChild(family, { ...intake, id: 'two', detected_ram: '8 GB' }).sku, 'ROXO');
  for (const change of [{ matched_color_id: 'green' }, { detected_ram: '6GB' }, { detected_storage: '128GB' }, { matched_model_id: 'other' }, { company_id: 'other' }]) {
    assert.equal(getIntakeBlingChild(family, { ...intake, ...change }), null);
  }
  assert.equal(getIntakeBlingChild(buildBlingFamily(parent, children), intake), null);
  assert.throws(() => saveIntakeBlingMapping(family, intake, 999));
  assert.equal(intakeMappingKey({ ...intake, detected_ram: '' }), null);
});

test('correction replaces prior choice; refresh invalidates removed/inactive children and changed parents', () => {
  const family = saveIntakeBlingMapping(buildBlingFamily(parent, children), intake, 101);
  const corrected = saveIntakeBlingMapping(family, intake, 102);
  assert.equal(corrected.mappings.length, 1);
  assert.equal(getIntakeBlingChild(corrected, intake).id, 102);
  assert.equal(getIntakeBlingChild(buildBlingFamily(parent, children.slice(1), family), intake), null);
  assert.equal(getIntakeBlingChild(buildBlingFamily(parent, [{ ...children[0], situacao: 'I' }], family), intake), null);
  assert.equal(buildBlingFamily({ ...parent, id: 200 }, children, family).mappings.length, 0);
});

test('queue groups ready and unregistered devices; preserves configuration and company boundaries', () => {
  assert.equal(photoQueueGroupKey(intake), photoQueueGroupKey({ ...intake, id: 'two', status: 'waiting_price_confirmation', detected_ram: '8 GB' }));
  const pending = { ...intake, matched_model_id: null, matched_color_id: null, detected_brand: 'realme', detected_model: 'C85 5G', status: 'waiting_model_registration' };
  assert.equal(photoQueueGroupKey(pending), photoQueueGroupKey({ ...pending, id: 'two', detected_brand: 'REALME', detected_color: 'roxo' }));
  for (const change of [{ detected_ram: '6GB' }, { detected_storage: '128GB' }, { matched_color_id: 'green' }, { company_id: 'other' }, { status: 'completed' }, { status: 'cancelled' }]) {
    assert.notEqual(photoQueueGroupKey(intake), photoQueueGroupKey({ ...intake, id: 'two', ...change }));
  }
  assert.notEqual(photoQueueGroupKey({ ...pending, detected_ram: null }), photoQueueGroupKey({ ...pending, id: 'two', detected_ram: null }));
});
