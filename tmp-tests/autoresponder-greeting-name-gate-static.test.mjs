import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const removedPromptParts = [
  'Voce esta atras de celular novo?',
  'Quer que eu mande a lista do que temos?',
  'Ou deseja alguma outra coisa?',
];

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');

  assert.ok(source.includes("const AUTORESPONDER_NEEDS_PROMPT_FALLBACK = '';"), `${file} must not fall back to a commercial follow-up prompt`);
  for (const promptPart of removedPromptParts) {
    assert.ok(!source.includes(promptPart), `${file} must not include old commercial follow-up prompt text`);
  }
  assert.match(source, /if \(shouldConfirmContactName \|\| shouldAskContactName\) \{[\s\S]*return \{ replies: \[\{ message: greetingText \}, \{ message: contactPrompt\.trim\(\) \}\] \};[\s\S]*\}/, `${file} must return only the name prompt until the name is captured`);

  const testReplyGreeting = source.match(/if \(detectedIntent\.greetingOnly\) \{[\s\S]*?\n  \}\n\n  if \(detectedIntent\.storeStatusRequest\)/)?.[0] || '';
  assert.ok(testReplyGreeting, `${file} must keep a greeting-only branch in test replies`);
  assert.ok(!testReplyGreeting.includes('buildAutoresponderNeedsPromptReply'), `${file} test reply greeting must not build a needs prompt`);
  assert.ok(!testReplyGreeting.includes("intent: 'greeting_needs_prompt'"), `${file} test reply greeting must not use greeting_needs_prompt intent`);

  const webhookGreetingStart = source.indexOf('if (detectedIntent.greetingOnly) {', source.indexOf("url: '/autoresponder-webhook'"));
  const webhookGreetingEnd = source.indexOf('if (detectedIntent.warrantyRequest)', webhookGreetingStart);
  const webhookGreeting = webhookGreetingStart >= 0 && webhookGreetingEnd > webhookGreetingStart
    ? source.slice(webhookGreetingStart, webhookGreetingEnd)
    : '';
  assert.ok(webhookGreeting, `${file} must keep a greeting-only branch in webhook`);
  assert.ok(!webhookGreeting.includes('buildAutoresponderNeedsPromptReply'), `${file} webhook greeting must not build a needs prompt`);
  assert.ok(!webhookGreeting.includes("intent: 'greeting_needs_prompt'"), `${file} webhook greeting must not use greeting_needs_prompt intent`);
}

console.log('autoresponder greeting name gate static checks passed');
