import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs', 'server.js']) {
  const source = readFileSync(file, 'utf8');
  [
    'AUTORESPONDER_ENGINE_V2',
    'handleAutoresponderEngineDeliveryFlowV2',
    'deliveryFlowHandler',
    'normalizeConversationState',
    'conversation_state',
  ].forEach((needle) => {
    assert.ok(source.includes(needle), `${file} must include ${needle}`);
  });
}

console.log('autoresponder delivery engine integration static checks passed');
