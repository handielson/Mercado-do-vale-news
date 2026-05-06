import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /function formatAutoresponderProductReplyInstructions\(hasMore\)/,
  'expected a centralized product reply instruction helper',
);

assert.match(
  source,
  /Responda com o numero da opcao ou com o nome\/modelo do produto/,
  'expected customer instruction to choose by number or product name/model',
);

assert.match(
  source,
  /Se quiser ver mais opcoes, digite "mais"\./,
  'expected customer instruction to request more results when available',
);

assert.doesNotMatch(
  source,
  /Responda "mais" para ver outras opcoes/,
  'old ambiguous more-only instruction should be removed',
);

console.log('autoresponder choice instructions static checks passed');
