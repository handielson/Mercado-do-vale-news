import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModelPhotoVariationRows } from '../components/products/familyRegistration.js';

const parent = { name: 'Fone XXX', model_id: 'model-1', sku: 'FONE-XXX', images: ['foto-pai.jpg'], specs: {}, category_id: 'audio' };
const colors = [
  { id: 'white', name: 'Branco' }, { id: 'black', name: 'Preto' },
  { id: 'blue', name: 'Azul' }, { id: 'yellow', name: 'Amarelo' },
];
const photos = [
  { color_id: 'white', images: ['branco.jpg'] },
  { color_id: 'black', images: ['preto.jpg'] },
  { color_id: 'blue', images: ['azul.jpg'] },
  { color_id: 'yellow', images: [] },
];

test('fotos por cor preparam filhos com dados herdados do pai e suas fotos próprias', () => {
  const rows = buildModelPhotoVariationRows(parent, [], colors, photos);
  assert.deepEqual(rows.map(row => row.data.specs.color), ['Branco', 'Preto', 'Azul']);
  assert.deepEqual(rows.map(row => row.data.images[0]), ['branco.jpg', 'preto.jpg', 'azul.jpg']);
  assert.ok(rows.every(row => row.data.model_id === parent.model_id && row.data.category_id === parent.category_id));
  assert.ok(rows.every(row => row.inheritImages === false && row.data.sku === ''));
});

test('sincronização não cria outra variação de uma cor já cadastrada, mesmo com memórias diferentes', () => {
  const existing = [{ key: 'existing', data: { specs: { color: 'Branco', ram: '8GB', storage: '256GB' } } }];
  const first = buildModelPhotoVariationRows(parent, existing, colors, photos);
  assert.deepEqual(first.map(row => row.data.specs.color), ['Preto', 'Azul']);
  assert.deepEqual(buildModelPhotoVariationRows(parent, [...existing, ...first], colors, photos), []);
});

test('celulares exigem completar RAM e armazenamento dos novos filhos antes de salvar', () => {
  const form = readFileSync(new URL('../components/products/ProductForm.tsx', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../components/products/ProductFamilyEditor.tsx', import.meta.url), 'utf8');
  assert.match(form, /isSmartphoneModel\(\{ category_name: familyCategoryName \}\)/);
  assert.match(form, /!row\.data\.id && \(!row\.data\.specs\?\.ram \|\| !row\.data\.specs\?\.storage\)/);
  assert.match(editor, /smartphone && !row\.data\.id/);
  assert.match(editor, /\['ram', 'storage'\]/);
});
