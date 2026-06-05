import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(
    source,
    /function buildAutoresponderStoreStatusReplyMessages/,
    `${file} must build store-status reply arrays`
  );
  assert.match(
    source,
    /async function buildAutoresponderAiIntentPlan/,
    `${file} must use ChatGPT as the first intent reader`
  );
  assert.match(
    source,
    /detectedIntent\.storeStatusRequest \|\| aiIntentPlan\?\.storeStatusRequest/,
    `${file} must allow ChatGPT to trigger store-status handling`
  );
  assert.match(
    source,
    /const greetingText = getAutoresponderGreetingReply\(message, contactFirstName, settings\);[\s\S]*return formatAutoresponderReplies\(\[greetingText, statusText\], settings, false\);/,
    `${file} must send greeting before store status when both intents are present`
  );
  assert.match(
    source,
    /replies: formatAutoresponderProReplies\(replyMessages\)/,
    `${file} test reply must return multiple store-status messages`
  );
  assert.match(
    source,
    /return \{ replies: formatAutoresponderProReplies\(replyMessages\) \};/,
    `${file} webhook must return multiple store-status messages`
  );
  assert.match(
    source,
    /Vou chamar um atendente para te ajudar melhor com isso\./,
    `${file} must hand off to a human when no safe system answer is found`
  );
}

console.log('autoresponder greeting store status static checks passed');
