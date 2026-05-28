import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('components/settings/ModelModal.tsx', 'utf8');

assert.match(
  source,
  /formatModelNameToken[\s\S]*se[\s\S]*toUpperCase/,
  'Model name formatter must preserve SE as an uppercase model acronym'
);

for (const [key, label] of [
  ['audio', 'Audio'],
  ['materials', 'Materiais'],
  ['weight', 'Peso'],
  ['dimensions', 'Dimensoes'],
  ['stylus_support', 'Suporte a Caneta'],
  ['keyboard_support', 'Suporte a Teclado'],
]) {
  assert.match(
    source,
    new RegExp(`${key}: '${label}'`),
    `Template label ${key} must be shown in Portuguese`
  );
}

for (const expected of [
  'Alto-falantes estereo',
  'Audio Hi-Res',
  'Frente de vidro',
  'estrutura de aluminio',
  'traseira de aluminio',
  'Sim (magnetico)',
  'Sim (pinos magneticos)',
]) {
  assert.ok(
    source.includes(expected),
    `Imported template values must translate "${expected}" to Portuguese`
  );
}

assert.match(
  source,
  /translateTemplateValuesToPortuguese\(visibleTemplateValues\)/,
  'Imported JSON template values must be translated before entering the modal state'
);

console.log('model modal Portuguese JSON fields regression passed');
