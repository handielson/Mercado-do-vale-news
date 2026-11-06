// fixed-variation-specs-v1: o card da variação fixa mostra RAM e armazenamento para conferência.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVariationSpecs, variationSpecItems } from '../components/entrada/fixedVariationSpecs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('lê RAM física primeiro, armazenamento e cor', () => {
  assert.deepEqual(readVariationSpecs({ specs: { ram: '6GB+6GB', ram_fisica: '6GB', storage: '128GB', color: 'Cinza' } }), { ram: '6GB', storage: '128GB', color: 'Cinza' });
  assert.deepEqual(readVariationSpecs({ specs: { ram: '8GB', storage: '256GB' } }), { ram: '8GB', storage: '256GB', color: '' });
});

test('specs em texto JSON, inválido ou ausente não quebram o card', () => {
  assert.deepEqual(readVariationSpecs({ specs: '{"ram":"4GB","storage":"64GB"}' }), { ram: '4GB', storage: '64GB', color: '' });
  assert.deepEqual(readVariationSpecs({ specs: '{quebrado' }), { ram: '', storage: '', color: '' });
  assert.deepEqual(readVariationSpecs(null), { ram: '', storage: '', color: '' });
});

test('celular/tablet sempre mostra RAM e Armazenamento; faltando aparece como não informado', () => {
  assert.deepEqual(variationSpecItems({ ram: '6GB', storage: '128GB', color: 'Cinza' }, { isPhone: true }).map(i => `${i.label}=${i.value}`),
    ['RAM=6GB', 'Armazenamento=128GB', 'Cor=Cinza']);
  const missing = variationSpecItems({ ram: '', storage: '', color: '' }, { isPhone: true });
  assert.deepEqual(missing.map(i => [i.label, i.value, i.missing]), [['RAM', 'não informado', true], ['Armazenamento', 'não informado', true]]);
});

test('acessório sem RAM/armazenamento não mostra linhas vazias', () => {
  assert.deepEqual(variationSpecItems({ ram: '', storage: '', color: '' }, { isPhone: false }), []);
  assert.deepEqual(variationSpecItems({ ram: '', storage: '', color: 'Preto' }, { isPhone: false }).map(i => i.label), ['Cor']);
});

test('o card da variação fixa carrega e mostra a configuração', () => {
  const card = fs.readFileSync(path.join(root, 'components/entrada/FixedVariationCard.tsx'), 'utf8');
  assert.match(card, /specs: readVariationSpecs\(product\)/);
  assert.match(card, /<VariationSpecs variation=\{variation\} \/>/);
  assert.match(card, /aria-label="Configuração da variação"/);
});
