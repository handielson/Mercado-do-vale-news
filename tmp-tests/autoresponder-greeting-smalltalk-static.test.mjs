import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runtimeFiles = ['vps_server.js', 'vps_server.cjs', 'server.js'];

for (const fileName of runtimeFiles) {
  const source = readFileSync(fileName, 'utf8');
  const greetingOnly = source.match(/function isAutoresponderGreetingOnly\(message\) \{[\s\S]*?\n\}/)?.[0] || '';

  assert.match(
    greetingOnly,
    /withoutGreeting[\s\S]*tudo bem[\s\S]*tudo bom[\s\S]*como vai/,
    `${fileName} must treat greeting plus small talk as a greeting-only message`
  );

  assert.match(
    greetingOnly,
    /\^\(tudo bem\|td bem\|tudo bom\|td bom\|como vai/,
    `${fileName} must include common small-talk greetings`
  );

  const webhookIndex = source.indexOf("url: '/autoresponder-webhook'");
  const greetingIndex = source.indexOf('if (detectedIntent.greetingOnly)', webhookIndex);
  const productFlowIndex = source.indexOf('handleAutoresponderEngineProductSearchFlowV2({', webhookIndex);
  assert.ok(webhookIndex >= 0, `${fileName} must expose the autoresponder webhook`);
  assert.ok(greetingIndex > webhookIndex, `${fileName} must handle greeting-only messages in the webhook`);
  if (productFlowIndex >= 0) {
    assert.ok(
      greetingIndex < productFlowIndex,
      `${fileName} must answer greetings before active product-search contextual fallback`
    );
  }
}

console.log('autoresponder greeting smalltalk static checks passed');
