// agent-commands-v1: "agentes ..." do admin vira comando admin; o resto continua igual.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, patchComando, MARK, NODE } = require('../scripts/n8n-agent-commands.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const ADMIN = '5587999990000';

const run = (code, text, from = ADMIN) => {
  const source = { remoteJid: `${from}@s.whatsapp.net`, conversation: text };
  const payload = { adminNumbers: [{ phone: ADMIN, active: 1 }], control: { paused: false } };
  const $ = () => ({ first: () => ({ json: source }) });
  return new Function('$', '$json', code)($, payload)[0].json;
};

test('Comando Admin: "agentes ..." do admin vira comando; cliente e frases comuns não', { skip: !snapshot && 'sem snapshot do n8n' }, () => {
  const live = JSON.parse(fs.readFileSync(snapshot, 'utf8')).nodes.find((n) => n.name === NODE).parameters.jsCode;
  const code = patchComando(live);
  assert.equal(patchComando(code), code, 'idempotente');
  assert.ok(code.includes(MARK));
  for (const t of ['agentes', 'Agentes status', 'agentes pausar alertas', 'agente aprovar 3', 'agentes reativar todos'])
    assert.equal(run(code, t).n8nBotAdminCommand, true, t);
  for (const t of ['agentes vendem muito?', 'quero falar com os agentes', 'oi'])
    assert.equal(run(code, t).n8nBotAdminCommand, false, t);
  assert.equal(run(code, 'agentes status', '5587911112222').n8nBotAdminCommand, false, 'cliente comum não manda comando');
  assert.equal(run(code, 'pausar').n8nBotAdminCommand, true, 'comandos antigos continuam');
  assert.equal(run(code, 'pausar').adminCommandAction, 'pausar');
  assert.equal(run(code, 'agentes pausar alertas').adminCommandAction, '', 'não confunde com pausar o robô');
});

test('patch do workflow só mexe no nó de comando admin', { skip: !snapshot && 'sem snapshot do n8n' }, () => {
  const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const after = patchWorkflow(before);
  assert.deepEqual(after.connections, before.connections);
  const mudou = after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name);
  assert.deepEqual(mudou, before.nodes.find((n) => n.name === NODE).parameters.jsCode.includes(MARK) ? [] : [NODE]);
});
