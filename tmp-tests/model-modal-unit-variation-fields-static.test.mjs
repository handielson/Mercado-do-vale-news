import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/settings/ModelModal.tsx', import.meta.url), 'utf8');

assert.match(
  source,
  /isModelVariationFieldKey/,
  'ModelModal deve ter classificador para campos de variacao do produto individual'
);

assert.match(
  source,
  /memoria_ram/,
  'classificador deve reconhecer Memoria RAM alem da chave tecnica ram'
);

assert.match(
  source,
  /armazenamento/,
  'classificador deve reconhecer Armazenamento alem da chave tecnica storage'
);

assert.match(
  source,
  /!isModelVariationFieldKey\(field\.key\).*!isModelVariationFieldKey\(field\.label\)/s,
  'campos visiveis do template devem ocultar RAM/armazenamento/cor por chave ou label'
);

assert.match(
  source,
  /!isModelVariationFieldKey\(key\)/,
  'valores salvos no template devem remover campos de variacao'
);
