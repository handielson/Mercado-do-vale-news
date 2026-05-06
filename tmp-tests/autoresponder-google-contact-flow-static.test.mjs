import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

[
  'contact_name_status',
  'contact_name_suggestion',
  'contact_name_confirmed',
  'google_contact_resource_name',
].forEach((column) => {
  assert.match(source, new RegExp(column), `autoresponder conversations must persist ${column}`);
});

assert.match(
  source,
  /async function getAutoresponderContactNameState\(sender\)/,
  'autoresponder must load contact name confirmation state',
);

assert.match(
  source,
  /async function handleAutoresponderContactNameFlow\(\{ sender, message, contactFirstName \}\)/,
  'autoresponder must handle pending contact name confirmation before normal replies',
);

assert.match(
  source,
  /Seu nome e \$\{contactFirstName\}\?/,
  'autoresponder must ask the customer to confirm the detected first name',
);

assert.match(
  source,
  /Qual nome devo colocar no seu contato\?/,
  'autoresponder must ask for the correct name when the customer says no',
);

assert.match(
  source,
  /async function createOrUpdateGoogleContact\(\{ sender, name \}\)/,
  'autoresponder must expose a Google Contacts integration function',
);

assert.match(
  source,
  /https:\/\/people\.googleapis\.com\/v1\/people:createContact/,
  'Google Contacts integration must call People API createContact',
);

assert.match(
  source,
  /const contactFlowReply = await handleAutoresponderContactNameFlow\(\{ sender: senderKey, message, contactFirstName \}\)/,
  'webhook must check the contact name flow before product search',
);

assert.match(
  source,
  /await startAutoresponderContactNameConfirmation\(senderKey, contactFirstName\)/,
  'pure greeting with contact name must start the confirmation flow',
);

assert.match(
  source,
  /await markAutoresponderContactNameAwaitingInput\(senderKey\)/,
  'pure greeting without contact name must start the manual name capture flow',
);

assert.match(
  source,
  /Como devo chamar voce\?/,
  'pure greeting without contact name must ask how to call the customer',
);

assert.match(
  source,
  /return \{ replies: \[\{ message: greetingText \}, \{ message: contactPrompt\.trim\(\) \}\] \}/,
  'greeting contact prompts must be returned as a second Pro reply',
);

console.log('autoresponder google contact flow static checks passed');
