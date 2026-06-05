import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/autoresponder/engine/flows/product-search.js', 'utf8');
const servers = ['vps_server.js', 'vps_server.cjs', 'server.js'].map((file) => ({
  file,
  source: readFileSync(file, 'utf8'),
}));

[
  'productSearchFlowHandler',
  "flow: 'product_search'",
  "step: 'awaiting_choice'",
  "flow: 'purchase'",
  "step: 'awaiting_action'",
  'findProducts',
  'findSelectedProduct',
  'formatProductSearchReplyInstructions',
  'Responda com o numero da opcao ou com o nome/modelo do produto',
  'Se quiser ver mais opcoes, digite "mais".',
  'vamos ficar com qual deles hoje?',
  'visibleOptions',
].forEach((needle) => {
  assert.ok(source.includes(needle), `product search flow must include ${needle}`);
});

assert.ok(
  !source.includes('Responda "mais" para ver outras opcoes'),
  'product search flow must not use the old ambiguous more-only instruction',
);

for (const server of servers) {
  [
    'handleAutoresponderEngineProductSearchFlowV2',
    'AUTORESPONDER_ENGINE_V2',
    'function formatAutoresponderProductReplyInstructions(hasMore)',
    'Responda com o numero da opcao ou com o nome/modelo do produto.',
    'Se quiser ver mais opcoes, digite "mais".',
    "status = 'awaiting_product_action'",
    'selected_product',
    'conversation_state: productReply.nextState',
    'upsertAutoresponderOptionsConversation',
  ].forEach((needle) => {
    assert.ok(server.source.includes(needle), `${server.file} must include ${needle}`);
  });

  assert.ok(
    !server.source.includes('Responda "mais" para ver outras opcoes'),
    `${server.file} must not use the old ambiguous more-only instruction`,
  );
}

console.log('autoresponder product search engine static checks passed');
