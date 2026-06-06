import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs', 'server.js']) {
  const source = readFileSync(file, 'utf8');
  const forbidden = [
    "status: 'standalone_delivery_quote_ready'",
    'handleAutoresponderStandaloneDeliveryRequest',
  ];

  for (const needle of forbidden) {
    assert.ok(!source.includes(needle), `${file} must remove legacy non-purchase state: ${needle}`);
  }

  assert.ok(source.includes('conversation_state'), `${file} must use conversation_state`);
  assert.ok(source.includes('handleAutoresponderEngineDeliveryFlowV2'), `${file} must use delivery engine`);

  if (file !== 'server.js') {
    assert.ok(source.includes('shouldAutoresponderRuleAwaitStandaloneDeliveryCep(matchedRule, resolvedRuleText)'), `${file} must only keep standalone CEP as a post-rule compatibility path`);
    assert.ok(source.includes("'standalone_delivery_cep_prompt'"), `${file} must log the compatibility CEP prompt explicitly`);
  }
}

console.log('autoresponder no purchase flow outside purchase static checks passed');
