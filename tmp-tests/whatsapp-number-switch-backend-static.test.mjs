import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('vps_server.cjs', 'utf8');

const endpoints = [
  ['GET', '/n8n-bot/whatsapp-switch/status'],
  ['POST', '/n8n-bot/whatsapp-switch/start'],
  ['POST', '/n8n-bot/whatsapp-switch/disconnect'],
  ['POST', '/n8n-bot/whatsapp-switch/connect'],
  ['POST', '/n8n-bot/whatsapp-switch/confirm'],
  ['POST', '/n8n-bot/whatsapp-switch/keep-paused'],
];

for (const [method, path] of endpoints) {
  const routeRegex = new RegExp(`fastify\\.${method.toLowerCase()}\\('${path.replace(/\//g, '\\/')}', \\{ preHandler: requireSyncKey \\}`);
  assert.match(source, routeRegex, `${method} ${path} must exist and require sync auth`);
}

assert.match(source, /async function getN8nBotWhatsAppSwitchStatus\(/, 'backend must expose consolidated switch status helper');
assert.match(source, /function sanitizeN8nBotEvolutionConnectResult\(/, 'backend must sanitize Evolution connect payloads before returning them');
assert.match(source, /function pickFirstN8nBotString\(/, 'backend must read QR values from multiple Evolution payload shapes');
assert.match(source, /raw\?\.data\?\.qrcode/, 'backend must support nested Evolution QR payloads');
assert.match(source, /EXPECTED_N8N_BOT_WEBHOOK_URL = 'https:\/\/n8n\.mercadodovale\.com\.br\/webhook\/whatsapp'/, 'backend must validate the production webhook URL');
assert.match(source, /setN8nBotGlobalControl\(\{\s*paused: true,\s*reason: 'Troca de numero WhatsApp iniciada'/s, 'start endpoint must pause the bot before switching');
assert.match(source, /setN8nBotGlobalControl\(\{\s*paused: false,\s*reason: ''/s, 'confirm endpoint must be able to reactivate the bot after validation');
assert.match(source, /before\.evolution\?\.state === 'open'/, 'switch connect endpoint must explain when the current WhatsApp is already connected');
assert.match(source, /const connect = \{ ok: result\.ok, status: result\.status, \.\.\.sanitizeN8nBotEvolutionConnectResult\(result\.body\) \}/, 'switch connect endpoint must return sanitized Evolution connect payloads');
assert.match(source, /callN8nBotEvolutionApi\(`\/instance\/logout\/\$\{encodeURIComponent\(instanceName\)\}`, 'DELETE'\)/, 'switch disconnect must use Evolution DELETE logout endpoint');
assert.doesNotMatch(source, /callN8nBotEvolutionApi\(`\/instance\/logout\/\$\{encodeURIComponent\(instanceName\)\}`, 'POST'\)/, 'switch disconnect must not use POST logout');

console.log('whatsapp number switch backend static checks passed');
