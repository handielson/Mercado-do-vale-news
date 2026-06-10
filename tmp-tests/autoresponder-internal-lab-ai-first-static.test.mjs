import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const fileName of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(fileName, 'utf8');

  assert.match(
    source,
    /function splitAutoresponderAiReplyMessages\(replyText, maxMessages = 2\)/,
    `${fileName} must split AI text into up to two WhatsApp messages`
  );

  assert.match(
    source,
    /function formatAutoresponderAiReplyMessages\(replyText, settings, shouldPrefixGreeting\)/,
    `${fileName} must format split AI replies consistently`
  );
  assert.match(
    source,
    /const AUTORESPONDER_DEFAULT_SIGNATURE_MESSAGE = '';/,
    `${fileName} must not ship the old default signature footer`
  );
  assert.match(
    source,
    /\^pitoco,\\s\*assistente virtual do mercado do vale/i,
    `${fileName} must suppress the legacy Pitoco signature if it is still stored in settings`
  );

  const webhookIndex = source.indexOf("url: '/autoresponder-webhook'");
  assert.ok(webhookIndex >= 0, `${fileName} must expose the autoresponder webhook`);

  const internalLabAiIndex = source.indexOf('if (detectedIntent.greetingOnly && isAutoresponderAiEnabled(settings) && !hasActivePurchaseFlow)', webhookIndex);
  const firstGreetingIndex = source.indexOf('if (detectedIntent.greetingOnly)', webhookIndex);
  const contactPromptIndex = source.indexOf("intent: 'contact_name_prompt'", webhookIndex);

  assert.ok(
    internalLabAiIndex > webhookIndex,
    `${fileName} must route AI-enabled greeting messages through AI first`
  );
  assert.ok(
    internalLabAiIndex < firstGreetingIndex,
    `${fileName} must call AI before the legacy fixed greeting branch`
  );
  assert.ok(
    internalLabAiIndex < contactPromptIndex,
    `${fileName} must call AI before the old contact-name prompt`
  );

  const internalLabAiBlock = source.slice(internalLabAiIndex, firstGreetingIndex);
  assert.match(
    internalLabAiBlock,
    /buildAutoresponderAiFirstReply\(\{ message, contactFirstName, settings, sender: senderKey \}\)/,
    `${fileName} internal-lab greeting branch must use the AI-first helper`
  );
  assert.match(
    internalLabAiBlock,
    /formatAutoresponderAiReplyMessages\(aiFirst\.text, settings, false\)/,
    `${fileName} internal-lab AI branch must not prepend legacy greeting text`
  );
  assert.match(
    internalLabAiBlock,
    /return \{ replies: formatAutoresponderProReplies\(replyMessages\) \};/,
    `${fileName} internal-lab AI branch must return split pro replies`
  );
}

console.log('autoresponder internal lab AI-first static checks passed');
