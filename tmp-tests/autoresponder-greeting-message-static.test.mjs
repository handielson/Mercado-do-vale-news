import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /function getAutoresponderContactFirstName\(payload\)/,
  'autoresponder must extract the first contact name from the webhook payload',
);

assert.match(
  source,
  /payload\?\.senderName[\s\S]*payload\?\.contactName[\s\S]*payload\?\.pushName/,
  'autoresponder must support senderName, contactName and pushName payload fields',
);

assert.match(
  source,
  /function getAutoresponderGreetingReply\(message, contactFirstName = ''\)/,
  'autoresponder must build a dedicated greeting reply',
);

assert.match(
  source,
  /Como posso ajudar voce hoje\?/,
  'greeting reply must use the approved second line',
);

assert.match(
  source,
  /if \(isAutoresponderGreetingOnly\(message\)\) \{/,
  'pure greeting messages must be answered before product search fallback',
);

assert.match(
  source,
  /getAutoresponderGreetingReply\(message, contactFirstName\)/,
  'greeting replies must receive the contact first name',
);

console.log('autoresponder greeting message static checks passed');
