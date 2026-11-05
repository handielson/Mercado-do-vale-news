import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeProductCondition, productCondition, productConditionLabel, productConditionNote, isNotNewCondition, PRODUCT_CONDITIONS } from './productCondition.js';

test('normaliza variações de escrita', () => {
  for (const [input, expected] of [['', 'new'], ['Novo', 'new'], ['seminovo', 'seminovo'], ['Semi-novo', 'seminovo'], ['semi novo', 'seminovo'], ['usado', 'used'], ['USED', 'used'], ['open_box', 'open_box'], ['Caixa aberta', 'open_box'], ['xyz', 'new']]) {
    assert.equal(normalizeProductCondition(input), expected, input);
  }
});

test('lê do produto (specs objeto ou JSON) e dá rótulo', () => {
  assert.equal(productCondition({ specs: { condition: 'seminovo' } }), 'seminovo');
  assert.equal(productCondition({ specs: '{"condicao":"usado"}' }), 'used');
  assert.equal(productCondition({ specs: { condition: 'used' } }), 'used');
  assert.equal(productConditionLabel('seminovo'), 'Seminovo');
  assert.equal(productConditionLabel('used'), 'Usado');
  assert.deepEqual(PRODUCT_CONDITIONS.map(c => c.value), ['new', 'seminovo', 'used', 'open_box']);
  assert.equal(isNotNewCondition('new'), false);
  assert.equal(isNotNewCondition('seminovo'), true);
});

test('observação só vale para não-novo, sem espaços extras e com limite', () => {
  assert.equal(productConditionNote({ specs: { condition: 'used', condition_note: '  Trocado a placa  principal pela assistência ' } }), 'Trocado a placa principal pela assistência');
  assert.equal(productConditionNote({ specs: { condition: 'new', condition_note: 'x' } }), '');
  assert.equal(productConditionNote({ specs: { condition: 'seminovo', condition_note: 'a'.repeat(400) } }).length, 300);
});
