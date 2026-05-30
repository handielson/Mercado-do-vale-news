import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('utils/catalogMessageGenerator.ts'), 'utf8');

assert(
  source.includes('Gostou de algum desses?'),
  'copied catalog message must end with the shorter customer question',
);

assert(
  !source.includes('Qual desses aparelhos deseja mais informações?') &&
  !source.includes('Qual desses aparelhos deseja mais informaÃ§Ãµes?'),
  'copied catalog message must not use the old long question',
);

assert(
  !/Total:\s*\$\{grouped\.length\}/.test(source),
  'copied catalog message must not include a model counter footer',
);

console.log('catalog WhatsApp footer is short and has no model counter');
