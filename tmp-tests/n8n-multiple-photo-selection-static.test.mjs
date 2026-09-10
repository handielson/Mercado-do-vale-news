import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./n8n-fix-multiple-photo-selection.cjs', import.meta.url), 'utf8');

assert.match(source, /itens_numero=\[15,16\]/, 'classifier guidance must teach multiple numbered photo choices');
assert.match(source, /salesFlowItemNumbers:/, 'classifier parser must preserve the complete number array');
assert.match(source, /explicitMultipleListSyntaxV343/, 'executor must have a deterministic fallback for strict list syntax');
assert.match(source, /requestedPhotoNumbersV343\.length > 1/, 'executor must branch for multiple photo selections');
assert.match(source, /selectedOption\.name/, 'captions must identify each independently selected model');
assert.match(source, /orderDraftCreated/, 'regression must prove a preview does not create an implicit order');
assert.match(source, /modelNameRejectedAsMultiSelection/, 'regression must cover numbers embedded in model names');
assert.match(source, /24 \* 60 \* 60 \* 1000/, 'numbered-list context must remain available for delayed replies');
assert.match(source, /workflow_entity[\s\S]*workflow_history/, 'production patch must align entity and active history');
assert.match(source, /n8n_n8n-runner=0[\s\S]*n8n_n8n=0/, 'runner and n8n must stop before the direct DB update');

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const extract = (value) => {
  const text = normalize(value);
  const strict = /^(?:(?:foto|fotos|imagem|imagens)\s+(?:do|dos|da|das)\s+)?(?:(?:numero|numeros|n|item|itens|opcao|opcoes)\s*)?\d{1,3}(?:\s*(?:,|;|\/|\+|&|e)\s*\d{1,3})+$/i.test(text);
  return strict ? (text.match(/\d{1,3}/g) || []).map(Number) : [];
};

assert.deepEqual(extract('Número 15,16'), [15, 16]);
assert.deepEqual(extract('fotos dos itens 2 e 7'), [2, 7]);
assert.deepEqual(extract('3/8/12'), [3, 8, 12]);
assert.deepEqual(extract('tem foto do Poco 7 Pro?'), [], 'model-family numbers must not become catalog choices');
assert.deepEqual(extract('iPhone 15 e 16'), [], 'product names must remain product names');

console.log('n8n multiple photo selection static regression checks passed');
