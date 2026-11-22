// agent-lock-v1: trava de emergência dos agentes; destravar só com o código mandado no WhatsApp dos admins.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAgentMonitorLock } = require('../services/agentMonitorLock.cjs');

function poolMemoria() {
  const db = new Map();
  return { db, pool: { async query(sql, params = []) {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (q.startsWith('CREATE TABLE')) return [{}];
    if (q.startsWith('SELECT valor')) return [db.has(params[0]) ? [{ valor: db.get(params[0]) }] : []];
    if (q.startsWith('INSERT INTO agent_monitor_settings')) { db.set(params[0], params[1]); return [{}]; }
    throw new Error('sql inesperado ' + q);
  } } };
}

test('travar avisa no WhatsApp; destravar exige o código que só chega no WhatsApp', async () => {
  const { pool } = poolMemoria();
  const msgs = [];
  let t = 1000;
  const lock = createAgentMonitorLock({ pool, sendAdmins: async (m) => { msgs.push(m); return 1; }, now: () => t, random: () => 42 });
  assert.deepEqual(await lock.estado(), { travado: false });
  await lock.travar({ motivo: 'chave nova no servidor', por: 'Sentinela' });
  assert.equal((await lock.estado()).travado, true);
  assert.match(msgs[0], /TRAVADOS[\s\S]*chave nova no servidor/);
  await assert.rejects(lock.exigirDestravado(), (e) => e.statusCode === 423);
  await assert.rejects(lock.destravar({ codigo: '000042' }), /Peça um código novo/, 'sem pedir código não destrava');
  await lock.pedirCodigo();
  assert.match(msgs.at(-1), /\*000042\*/);
  await assert.rejects(lock.destravar({ codigo: '111111' }), /Código errado/);
  assert.deepEqual(await lock.destravar({ codigo: '000042' }), { ok: true, travado: false });
  assert.equal((await lock.estado()).travado, false);
  await lock.exigirDestravado();
});

test('código expira em 10 min, 5 tentativas no máximo e 3 pedidos por hora', async () => {
  const { pool } = poolMemoria();
  let t = 0;
  const lock = createAgentMonitorLock({ pool, sendAdmins: async () => 1, now: () => t, random: () => 7 });
  await lock.travar({ motivo: 'x' });
  await lock.pedirCodigo();
  t = 11 * 60e3;
  await assert.rejects(lock.destravar({ codigo: '000007' }), /Peça um código novo/);
  await lock.pedirCodigo();
  for (let i = 0; i < 5; i++) await assert.rejects(lock.destravar({ codigo: '999999' }), /errado/);
  await assert.rejects(lock.destravar({ codigo: '000007' }), /esgotadas/);
  await lock.pedirCodigo();
  await assert.rejects(lock.pedirCodigo(), /Muitos pedidos/);
});

test('com a trava, mensagem a cliente e fechar atendimento são recusados', async () => {
  const { createBotMonitorApi } = require('../services/botMonitorApi.cjs');
  const { pool } = poolMemoria();
  const api = createBotMonitorApi({ pool, key: 'k'.repeat(40), fetchImpl: async () => ({ ok: true, json: async () => ({}) }), evolution: { url: 'https://e', key: 'k', instance: 'i' } });
  await api.trava.travar({ motivo: 'teste' }).catch(() => {});
  await assert.rejects(api.sendToCustomer({ remote_jid: 'x@s.whatsapp.net', text: 'oi' }), (e) => e.statusCode === 423);
  await assert.rejects(api.closeHandoffs({}), (e) => e.statusCode === 423);
});
