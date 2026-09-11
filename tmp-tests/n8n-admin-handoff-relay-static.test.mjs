import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const relay = require('../services/n8nAdminHandoffRelay.cjs');

assert.deepEqual(relay.normalizeRelayCommand('RESPONDER A7K2 Tudo certo'), { action: 'responder', code: 'A7K2', message: 'Tudo certo' });
assert.deepEqual(relay.normalizeRelayCommand('liberar a7k2'), { action: 'liberar', code: 'A7K2', message: '' });
assert.deepEqual(relay.normalizeRelayCommand('ENCERRAR A7K2'), { action: 'encerrar', code: 'A7K2', message: '' });
assert.equal(relay.normalizeRelayCommand('RESPONDER A7K2'), null);
const notification = relay.buildAdminNotification({ code: 'A7K2', contactName: 'Cliente', phone: '5587000000000', message: 'Preciso de ajuda' });
for (const expected of ['RESPONDER A7K2 sua mensagem', '1. LIBERAR A7K2', '2. ENCERRAR A7K2']) assert.match(notification, new RegExp(expected.replace('.', '\\.')));

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.match(source, /normalizeRelayCommand/);
  assert.match(source, /notifyN8nHandoffAdmins/);
  assert.match(source, /handoffBy === 'bot-handoff-request'/);
  assert.match(source, /ensureN8nAdminHandoffSchema\(pool\)/);
}
const deploy = fs.readFileSync(new URL('../deploy-vps-server-only.cjs', import.meta.url), 'utf8');
assert.match(deploy, /n8nAdminHandoffRelay\.cjs/);

console.log('n8n admin handoff relay static checks passed');
