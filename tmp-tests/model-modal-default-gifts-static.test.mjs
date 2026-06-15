import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modal = readFileSync('components/settings/ModelModal.tsx', 'utf8');
assert.match(modal, /SMARTPHONE_DEFAULT_GIFTS/, 'model modal must define default smartphone gifts');
assert.match(modal, /1 capa protetora/, 'default gifts must include protective case');
assert.match(modal, /1 capa extra/, 'default gifts must include extra case');
assert.match(modal, /1 pelicula 3D aplicada/, 'default gifts must include applied 3D film');
assert.match(modal, /Usar lista padrão/, 'model modal must expose a button to apply the default gift list');
assert.match(
  modal,
  /handleTemplateValueChange\('brindes',\s*SMARTPHONE_DEFAULT_GIFTS\)/,
  'default gift button must fill the brindes field while keeping it editable',
);
