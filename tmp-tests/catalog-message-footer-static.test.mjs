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
  !source.includes('Digite o número ou o modelo escolhido') &&
  !source.includes('Digite o numero ou o modelo escolhido') &&
  !source.includes('Digite o nÃºmero ou o modelo escolhido'),
  'copied catalog message must not ask the customer to type a number or model',
);

assert(
  !/Total:\s*\$\{grouped\.length\}/.test(source),
  'copied catalog message must not include a model counter footer',
);

assert(
  source.includes('catalogUrl') &&
  source.includes('?categoria=') &&
  source.includes('Veja no site'),
  'copied category message must include the category/search link',
);

console.log('catalog WhatsApp footer is short, has category link, and has no model counter');
