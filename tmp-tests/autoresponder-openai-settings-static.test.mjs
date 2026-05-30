import fs from 'node:fs';
import assert from 'node:assert/strict';

const serverFiles = ['vps_server.cjs', 'vps_server.js'];
const page = fs.readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');
const types = fs.readFileSync('types/autoResponder.ts', 'utf8');

for (const file of serverFiles) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(source, /addColumnIfMissing\('autoresponder_settings', 'ai_enabled'/, `${file} must migrate ai_enabled on VPS`);
  assert.match(source, /addColumnIfMissing\('autoresponder_settings', 'ai_model'/, `${file} must migrate ai_model on VPS`);
  assert.match(source, /addColumnIfMissing\('autoresponder_settings', 'openai_api_key'/, `${file} must migrate openai_api_key on VPS`);
  assert.match(source, /function sanitizeAutoresponderSettings/, `${file} must sanitize settings before returning them`);
  assert.match(source, /const \{ openai_api_key, \.\.\.safe \} = row;/, `${file} must remove the raw OpenAI key from settings responses`);
  assert.match(source, /has_openai_api_key/, `${file} must expose only key status`);
  assert.match(source, /openai_api_key_masked/, `${file} must expose only a masked key`);
  assert.match(source, /settings\?\.openai_api_key/, `${file} must use the VPS-saved key for AI replies`);
  assert.match(source, /key === 'openai_api_key' && !String\(body\[key\] \|\| ''\)\.trim\(\)/, `${file} must ignore blank OpenAI keys`);
}

assert.match(types, /ai_enabled\?: boolean \| number;/, 'settings type must include ai_enabled');
assert.match(types, /ai_model\?: string;/, 'settings type must include ai_model');
assert.match(types, /openai_api_key\?: string;/, 'settings type must include openai_api_key for PATCH payloads');
assert.match(types, /has_openai_api_key\?: boolean \| number;/, 'settings type must include key status');
assert.match(types, /openai_api_key_masked\?: string;/, 'settings type must include masked key');

assert.match(page, /settingsForm\.ai_enabled/, 'admin page must show the ChatGPT enabled toggle');
assert.match(page, /settingsForm\.ai_model/, 'admin page must show the model field');
assert.match(page, /settingsForm\.openai_api_key/, 'admin page must bind the OpenAI key input');
assert.match(page, /settingsForm\.has_openai_api_key/, 'admin page must show saved key status');
assert.match(page, /OPENAI_API_KEY/, 'admin page must label the OpenAI API key field');
assert.match(page, /Deixe em branco para manter a chave atual/, 'admin page must explain that blank keeps the current key');

console.log('autoresponder OpenAI settings static checks passed');
