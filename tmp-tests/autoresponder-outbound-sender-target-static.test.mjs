import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  const fnStart = source.indexOf('function getAutoresponderPayloadSender(payload, outbound = false)');
  assert.ok(fnStart >= 0, `${file} must define getAutoresponderPayloadSender`);
  const fnBody = source.slice(fnStart, source.indexOf('\n}\n', fnStart) + 3);
  const outboundStart = fnBody.indexOf('const preferredPaths = outbound');
  const senderIndex = fnBody.indexOf("'sender'", outboundStart);
  const toIndex = fnBody.indexOf("'to'", outboundStart);
  const remoteJidIndex = fnBody.indexOf("'key.remoteJid'", outboundStart);
  const fromIndex = fnBody.indexOf("'from'", outboundStart);

  assert.ok(toIndex >= 0, `${file} outbound payloads must prefer the customer recipient number`);
  assert.ok(remoteJidIndex >= 0, `${file} outbound payloads must support WhatsApp remoteJid`);
  assert.ok(senderIndex > toIndex, `${file} outbound payloads must not pause the store sender before the customer recipient`);
  assert.ok(fromIndex > remoteJidIndex, `${file} outbound payloads must not prefer the store from number before remoteJid`);
}

console.log('autoresponder outbound sender target static checks passed');
