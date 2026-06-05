import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const flow = readFileSync('services/autoresponder/engine/flows/delivery.js', 'utf8');

[
  'deliveryFlowHandler',
  "flow: 'delivery'",
  "step: 'awaiting_cep'",
  'lookupCep',
  'calculateShippingOptions',
  'buildContextualFallback',
].forEach((needle) => {
  assert.ok(flow.includes(needle), `delivery flow must include ${needle}`);
});

console.log('autoresponder delivery flow engine static checks passed');
