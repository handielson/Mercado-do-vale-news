import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const relay = require('../services/n8nAdminHandoffRelay.cjs');

assert.deepEqual(relay.normalizeRelayCommand('RESPONDER A7K2 Tudo certo'), { action: 'responder', code: 'A7K2', message: 'Tudo certo' });
assert.deepEqual(relay.normalizeRelayCommand('liberar a7k2'), { action: 'liberar', code: 'A7K2', message: '' });
assert.deepEqual(relay.normalizeRelayCommand('ENCERRAR A7K2'), { action: 'encerrar', code: 'A7K2', message: '' });
assert.deepEqual(relay.normalizeRelayCommand('1 A7K2 Tudo certo'), { action: 'responder_liberar', code: 'A7K2', message: 'Tudo certo' });
assert.deepEqual(relay.normalizeRelayCommand('1. A7K2 Tudo certo'), { action: 'responder_liberar', code: 'A7K2', message: 'Tudo certo' });
assert.deepEqual(relay.normalizeRelayCommand('2 A7K2 Vou encerrar por aqui'), { action: 'responder_encerrar', code: 'A7K2', message: 'Vou encerrar por aqui' });
assert.deepEqual(relay.normalizeRelayCommand('1 A7K2'), { action: 'liberar', code: 'A7K2', message: '' });
assert.deepEqual(relay.normalizeRelayCommand('2 A7K2'), { action: 'encerrar', code: 'A7K2', message: '' });
assert.equal(relay.normalizeRelayCommand('RESPONDER A7K2'), null);
assert.equal(relay.normalizeRelayCommand('1. blz'), null);
const notification = relay.buildAdminNotification({ code: 'A7K2', contactName: 'Cliente', phone: '5587000000000', message: 'Preciso de ajuda' });
for (const expected of ['1. A7K2 sua resposta', '2. A7K2 sua resposta', 'RESPONDER A7K2 sua mensagem', 'LIBERAR A7K2', 'ENCERRAR A7K2']) assert.match(notification, new RegExp(expected.replace('.', '\\.')));

const queries = [];
const logged = [];
const pool = {
  async query(sql, params) {
    queries.push({ sql, params });
    if (/SELECT \* FROM n8n_bot_handoffs/.test(sql)) return [[{
      remote_jid: '5587000000000@s.whatsapp.net', phone: '5587000000000', code: 'A7K2', status: 'open',
    }]];
    return [{ affectedRows: 1 }];
  },
};
const released = await relay.handleRelayCommand({
  pool,
  command: relay.normalizeRelayCommand('1 A7K2 Tudo certo'),
  admin: { phone: '5587996246812' },
  sendText: async (_identity, message) => ({ ok: message === 'Tudo certo', body: { key: { id: 'WA-1' } } }),
  logMessage: async (entry) => { logged.push(entry); },
});
assert.equal(released.action, 'responder_liberar');
assert.match(released.reply, /devolvido para a IA/);
assert.equal(logged[0].message, 'Tudo certo');
assert.ok(queries.some(({ sql, params }) => /SET status=\?/.test(sql) && params[0] === 'released'));
assert.ok(queries.some(({ sql }) => /human_handoff_until=NULL/.test(sql)));

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
