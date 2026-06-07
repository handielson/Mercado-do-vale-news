import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');
const messages = readFileSync('services/autoresponder/engine/messages.js', 'utf8');

assert.match(messages, /'purchase\.variation_prompt'/, 'message catalog must include purchase.variation_prompt');
assert.match(page, /'purchase\.variation_prompt'/, 'admin defaults must expose purchase.variation_prompt');
assert.match(page, /messageKey:\s*'purchase\.variation_prompt'/, 'admin map/editor must use editable purchase.variation_prompt');

const variationCardStart = page.indexOf("id: 'variation'");
assert.notEqual(variationCardStart, -1, 'admin must keep variation map card');
const nextCardStart = page.indexOf("id: 'fulfillment'", variationCardStart);
assert.notEqual(nextCardStart, -1, 'variation card must be followed by fulfillment card');
const variationCard = page.slice(variationCardStart, nextCardStart);
assert.doesNotMatch(variationCard, /botText:/, 'variation map card must not use hardcoded botText');

for (const file of ['vps_server.cjs', 'vps_server.js', 'server.js']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /purchase\.variation_prompt/, `${file} must define purchase.variation_prompt default`);
  assert.match(source, /function buildAutoresponderVariationPrompt\(variations,\s*settings\s*=\s*null\)/, `${file} variation prompt must receive settings`);
  assert.match(source, /getAutoresponderConversationFlowMessage\(settings,\s*'purchase\.variation_prompt'/, `${file} must resolve editable variation prompt`);
  assert.match(source, /\{opcoes\}/, `${file} editable variation prompt must support {opcoes} placeholder`);
}

console.log('autoresponder variation prompt editable static checks passed');
