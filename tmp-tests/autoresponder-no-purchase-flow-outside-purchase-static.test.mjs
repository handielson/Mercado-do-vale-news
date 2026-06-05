import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs', 'server.js']) {
  const source = readFileSync(file, 'utf8');
  const forbidden = [
    "status: 'awaiting_standalone_delivery_cep'",
    "status: 'standalone_delivery_quote_ready'",
    'handleAutoresponderStandaloneDeliveryRequest',
    'handleAutoresponderStandaloneDeliveryCepLookup',
    'standalone_delivery_address_lookup',
    'standalone_shipping_options',
    'standalone_shipping_quote',
  ];

  for (const needle of forbidden) {
    assert.ok(!source.includes(needle), `${file} must remove legacy non-purchase state: ${needle}`);
  }

  assert.ok(source.includes('conversation_state'), `${file} must use conversation_state`);
  assert.ok(source.includes('handleAutoresponderEngineDeliveryFlowV2'), `${file} must use delivery engine`);
}

console.log('autoresponder no purchase flow outside purchase static checks passed');
