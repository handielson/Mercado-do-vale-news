import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { modelColorOptions } from '../services/modelColorOptions.mjs';

test('cores com fotos do modelo aparecem primeiro, mesmo inativas', () => {
  const colors = [
    { id: 'white', name: 'Branco', active: true },
    { id: 'blue', name: 'Azul Glaciar', active: false },
    { id: 'black', name: 'Preto', active: true },
    { id: 'unused', name: 'Rosa', active: false },
  ];
  const rows = [{ color_id: 'blue', images: ['foto.jpg'] }, { color_id: 'black', images: [] }];
  const result = modelColorOptions(colors, rows);
  assert.deepEqual(result.suggested.map(color => color.name), ['Azul Glaciar']);
  assert.deepEqual(result.options.map(color => color.name), ['Azul Glaciar', 'Branco', 'Preto']);
});

test('editor associa o modelo do pai ao seletor e mantém outras cores disponíveis', () => {
  const editor = readFileSync(new URL('../components/products/ProductFamilyEditor.tsx', import.meta.url), 'utf8');
  const selector = readFileSync(new URL('../components/products/selectors/ColorSelect.tsx', import.meta.url), 'utf8');
  assert.match(editor, /<ColorSelect modelId=\{parent\.model_id \|\| undefined\}/);
  assert.match(selector, /modelColorImagesService\.getByModel\(modelId\)/);
  assert.match(selector, /Cores com fotos neste modelo:/);
  assert.match(selector, /options=\{options\}/);
});
