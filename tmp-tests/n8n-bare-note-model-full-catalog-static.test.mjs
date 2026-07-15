import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const source = fs.readFileSync(
  new URL('./n8n-fix-bare-note-model-full-catalog.cjs', import.meta.url),
  'utf8',
);

assert.match(source, /implicitPhoneModelRequestV134/, 'bare Note family must be recognized as a phone model');
assert.match(source, /classifiedSearchQuery/, 'contextual classifier query must participate in model recognition');
assert.match(source, /requestedModelRequiresPlusV134/, 'Pro+ requests must preserve plus semantics');
assert.match(source, /productModelHasPlusV134/, 'plain Pro must not satisfy a Pro+ request');
assert.match(source, /SMARTPHONES_CATEGORY_ID/, 'specific bare models must query the complete phone catalog');
assert.match(source, /catalogProductsShown/, 'catalog validation must count every selectable model');
assert.match(source, /listHeaderPresent/, 'catalog validation must require the available-phone list');
assert.match(source, /finalQuestionPresent/, 'catalog validation must require the final selection question');
const require = createRequire(import.meta.url);
const { patchContactResponseCode } = require('./n8n-fix-bare-note-model-full-catalog.cjs');
const patchedContactResponse = patchContactResponseCode(
  "const name = 'Ana'; return [{json:{output: 'Prazer, ' + name + '! Salvei seu contato por aqui.|||Como posso ajudar você hoje na Mercado do Vale?',}}];",
);
assert.doesNotMatch(patchedContactResponse, /Como posso ajudar/, 'saving a name must not restart the product request');

console.log('n8n bare Note model full catalog static regression tests passed');
