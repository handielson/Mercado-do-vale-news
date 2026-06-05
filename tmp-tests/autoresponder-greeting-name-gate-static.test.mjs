import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const expectedPrompt = 'Quer que eu mande a lista de celulares disponiveis?';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');

  assert.ok(source.includes(`const AUTORESPONDER_NEEDS_PROMPT_FALLBACK = '${expectedPrompt}';`), `${file} must use a single-question commercial follow-up prompt`);
  assert.match(source, /const contactNameSaved = \['saved_to_google', 'google_pending'\]\.includes\(contactNameStatus\);/, `${file} must gate the commercial follow-up by saved contact state`);
  assert.match(source, /if \(shouldConfirmContactName \|\| shouldAskContactName\) \{[\s\S]*return \{ replies: \[\{ message: greetingText \}, \{ message: contactPrompt\.trim\(\) \}\] \};[\s\S]*\}/, `${file} must return only the name prompt until the name is captured`);
  assert.match(source, /if \(contactNameSaved\) \{[\s\S]*buildAutoresponderNeedsPromptReply/, `${file} must only build the needs prompt after the contact name is saved`);
}

console.log('autoresponder greeting name gate static checks passed');
