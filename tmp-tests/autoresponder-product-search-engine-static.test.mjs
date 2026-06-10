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
  'visibleOptions',
].forEach((needle) => {
  assert.ok(source.includes(needle), `product search flow must include ${needle}`);
});

[
  'Responda com o numero da opcao ou com o nome/modelo do produto',
  'Se quiser ver mais opcoes, digite "mais".',
  'vamos ficar com qual deles hoje?',
  'Responda "mais" para ver outras opcoes',
].forEach((needle) => {
  assert.ok(!source.includes(needle), `product search flow must not ship legacy instruction: ${needle}`);
});

for (const server of servers) {
  [
    'handleAutoresponderEngineProductSearchFlowV2',
    'AUTORESPONDER_ENGINE_V2',
    'function formatAutoresponderProductReplyInstructions(hasMore)',
    "status = 'awaiting_product_action'",
    'selected_product',
    'conversation_state: productReply.nextState',
    'upsertAutoresponderOptionsConversation',
  ].forEach((needle) => {
    assert.ok(server.source.includes(needle), `${server.file} must include ${needle}`);
  });

  [
    'Responda com o numero da opcao ou com o nome/modelo do produto.',
    'Se quiser ver mais opcoes, digite "mais".',
    'Responda "mais" para ver outras opcoes',
  ].forEach((needle) => {
    assert.ok(!server.source.includes(needle), `${server.file} must not ship legacy instruction: ${needle}`);
  });
}

console.log('autoresponder product search engine static checks passed');
