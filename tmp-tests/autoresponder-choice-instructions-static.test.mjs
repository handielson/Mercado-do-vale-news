import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');
const helperMatch = source.match(/function formatAutoresponderProductReplyInstructions\(hasMore\) \{[\s\S]*?\n\}/);
assert.ok(helperMatch, 'expected a centralized product reply instruction helper');
const helperSource = helperMatch[0];

assert.match(
  source,
  /function formatAutoresponderProductReplyInstructions\(hasMore\)/,
  'expected a centralized product reply instruction helper',
);

assert.doesNotMatch(
  helperSource,
  /vamos ficar com qual/i,
  'legacy AutoResponder WA choice footer should be removed from product replies',
);

assert.doesNotMatch(
  helperSource,
  /Se quiser, me diga a faixa de preco, marca ou uso que eu filtro melhor/,
  'old refinement instruction should be removed',
);

assert.doesNotMatch(
  helperSource,
  /Responda com o numero da opcao ou com o nome\/modelo do produto/,
  'old number/name instruction should be removed from product result footer',
);

assert.doesNotMatch(
  helperSource,
  /Se quiser ver mais opcoes/i,
  'legacy more-options footer should be removed from product replies',
);

console.log('autoresponder choice instructions static checks passed');
