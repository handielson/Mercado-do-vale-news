import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.cjs', 'utf8');
const deployServer = readFileSync('vps_server.js', 'utf8');
const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');
const types = readFileSync('types/autoResponder.ts', 'utf8');
const schemaInstaller = readFileSync('tools/install-autoresponder-schema-vps-dry-run.cjs', 'utf8');

[
  'AUTORESPONDER_DEFAULT_SIGNATURE_MESSAGE',
  'getAutoresponderSignatureMessage',
  'appendAutoresponderSignatureMessage',
  'signature_enabled',
  'signature_message',
  "addColumnIfMissing('autoresponder_settings', 'signature_enabled'",
  "addColumnIfMissing('autoresponder_settings', 'signature_message'",
].forEach((token) => {
  assert.ok(server.includes(token), `vps_server.cjs must include ${token}`);
  assert.ok(deployServer.includes(token), `vps_server.js must include ${token}`);
});

assert.match(
  server,
  /formatted\[formatted\.length - 1\] = appendAutoresponderSignatureMessage/,
  'multi-message replies should append signature to the final bot message',
);

[
  'signature_enabled',
  'signature_message',
  'Usar assinatura virtual',
  'Assinatura das respostas',
].forEach((token) => {
  assert.ok(page.includes(token), `AutoResponderPage must include ${token}`);
});

assert.ok(types.includes('signature_enabled: boolean | number'), 'settings type must expose signature_enabled');
assert.ok(types.includes('signature_message: string'), 'settings type must expose signature_message');
assert.ok(schemaInstaller.includes('signature_enabled TINYINT(1) NOT NULL DEFAULT 1'), 'schema installer must create signature_enabled');
assert.ok(schemaInstaller.includes('signature_message TEXT NULL'), 'schema installer must create signature_message');

console.log('autoresponder virtual signature static checks passed');
