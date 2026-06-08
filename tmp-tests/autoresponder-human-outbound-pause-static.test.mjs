import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /function\s+isAutoresponderHumanOutboundPayload\(/,
    `${file} must detect outbound/human WhatsApp payloads before normal bot handling`,
  );

  assert.match(
    source,
    /payload\?\.key\?\.fromMe|payload\.key && payload\.key\.fromMe/,
    `${file} must recognize common WhatsApp key.fromMe outbound payloads`,
  );

  assert.match(
    source,
    /pauseAutoresponderConversationForHumanOutbound\(/,
    `${file} must pause the conversation when a human/operator message is detected`,
  );

  const routeStart = source.indexOf("url: '/autoresponder-webhook'");
  assert.ok(routeStart >= 0, `${file} must expose /autoresponder-webhook`);
  const routeBody = source.slice(routeStart, source.indexOf('} catch (err)', routeStart));
  const outboundIndex = routeBody.indexOf('isAutoresponderHumanOutboundPayload(payload)');
  const audioIndex = routeBody.indexOf('const isAudioPayload');
  const humanRequestIndex = routeBody.indexOf('if (detectedIntent.humanRequest)');

  assert.ok(outboundIndex >= 0, `${file} webhook must check outbound human payloads`);
  assert.ok(audioIndex >= 0, `${file} webhook must still process audio payloads`);
  assert.ok(humanRequestIndex >= 0, `${file} webhook must keep customer human-request branch`);
  assert.ok(
    outboundIndex < audioIndex && outboundIndex < humanRequestIndex,
    `${file} must pause outbound human replies before bot/audio/human-request reply logic`,
  );
}

console.log('autoresponder human outbound pause static checks passed');
