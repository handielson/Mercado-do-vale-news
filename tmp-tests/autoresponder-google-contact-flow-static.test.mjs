import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');
const deployedSource = readFileSync('vps_server.js', 'utf8');

function assertGoogleContactFlow(sourceText, label) {

[
  'contact_name_status',
  'contact_name_suggestion',
  'contact_name_confirmed',
  'google_contact_resource_name',
].forEach((column) => {
  assert.match(sourceText, new RegExp(column), `${label} autoresponder conversations must persist ${column}`);
});

assert.match(
  sourceText,
  /async function getAutoresponderContactNameState\(sender\)/,
  `${label} autoresponder must load contact name confirmation state`,
);

assert.match(
  sourceText,
  /async function handleAutoresponderContactNameFlow\(\{ sender, message, contactFirstName \}\)/,
  `${label} autoresponder must handle pending contact name confirmation before normal replies`,
);

assert.match(
  sourceText,
  /Seu nome e \$\{contactFirstName\}\?/,
  `${label} autoresponder must ask the customer to confirm the detected first name`,
);

assert.match(
  sourceText,
  /Qual nome devo colocar no seu contato\?/,
  `${label} autoresponder must ask for the correct name when the customer says no`,
);

assert.match(
  sourceText,
  /async function createOrUpdateGoogleContact\(\{ sender, name \}\)/,
  `${label} autoresponder must expose a Google Contacts integration function`,
);

assert.match(
  sourceText,
  /https:\/\/people\.googleapis\.com\/v1\/people:createContact/,
  `${label} Google Contacts integration must call People API createContact`,
);

assert.match(
  sourceText,
  /const contactFlowReply = await handleAutoresponderContactNameFlow\(\{ sender: senderKey, message, contactFirstName \}\)/,
  `${label} webhook must check the contact name flow before product search`,
);

assert.match(
  sourceText,
  /await startAutoresponderContactNameConfirmation\(senderKey, contactFirstName\)/,
  `${label} pure greeting with contact name must start the confirmation flow`,
);

assert.match(
  sourceText,
  /await markAutoresponderContactNameAwaitingInput\(senderKey\)/,
  `${label} pure greeting without contact name must start the manual name capture flow`,
);

assert.match(
  sourceText,
  /Qual seu nome para seguirmos com o atendimento\?/,
  `${label} pure greeting without contact name must ask for the customer name professionally`,
);

assert.match(
  sourceText,
  /return \{ replies: \[\{ message: greetingText \}, \{ message: contactPrompt\.trim\(\) \}\] \}/,
  `${label} greeting contact prompts must be returned as a second Pro reply`,
);

assert.match(
  sourceText,
  /const contactFlowReplies = Array\.isArray\(contactFlowReply\)/,
  `${label} contact name flow must support multiple Pro replies`,
);

assert.match(
  sourceText,
  /formatAutoresponderContactFollowUpReply\(\)/,
  `${label} saved contact flow must add the help question after saving the contact`,
);

assert.match(
  sourceText,
  /function getAutoresponderContactFirstNameFromName\(name\)/,
  `${label} must expose a helper to derive the first name from the confirmed full name`,
);

assert.match(
  sourceText,
  /formatAutoresponderContactSavedReply\(name, googleResult\)[\s\S]*?const firstName = getAutoresponderContactFirstNameFromName\(name\)/,
  `${label} saved-contact reply must address the customer by first name only`,
);

assert.match(
  sourceText,
  /getAutoresponderGreetingReply\(message, contactFirstName = '', settings = null\)[\s\S]*?getAutoresponderContactFirstNameFromName\(contactFirstName\)/,
  `${label} greeting must use only the first name even when a full name is available`,
);

assert.match(
  sourceText,
  /const typedName = normalizeAutoresponderContactName\(message\)[\s\S]*?confirmAutoresponderContactName\(sender, typedName\)/,
  `${label} manual name input must keep the full confirmed name for Google Contacts`,
);
}

assertGoogleContactFlow(source, 'cjs');
assertGoogleContactFlow(deployedSource, 'deployed');

console.log('autoresponder google contact flow static checks passed');
