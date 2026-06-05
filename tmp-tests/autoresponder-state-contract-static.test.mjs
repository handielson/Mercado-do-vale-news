import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const types = readFileSync('services/autoresponder/engine/types.js', 'utf8');

[
  '@typedef {Object} ConversationState',
  "@property {'none'|'greeting'|'product_search'|'purchase'|'delivery'|'payment'|'customer_data'|'handoff'} flow",
  '@property {string} step',
  '@property {Object} data',
  '@property {string|null} last_intent',
  '@property {string|null} expires_at',
  '@typedef {Object} BotReply',
  '@typedef {Object} FlowHandler',
].forEach((needle) => {
  assert.ok(types.includes(needle), `types.js must include ${needle}`);
});

console.log('autoresponder state contract static checks passed');
