// agent-commands-v2: formas curtas do admin viram comando dos agentes (e batem com a API).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const m = require('../scripts/n8n-agent-commands-short.cjs');
const { parseAgentCommand } = require('../services/botMonitorApi.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';

test('a expressão do n8n reconhece o mesmo que a API', { skip }, () => {
  const code = m.patchWorkflow(JSON.parse(fs.readFileSync(snapshot, 'utf8'))).nodes.find((n) => n.name === m.NODE).parameters.jsCode;
  const line = code.split('\n').filter((l) => /agentTextV2|^\s+\|\| agentTextV2/.test(l)).join('\n');
  const match = new Function('source', `${line}\nreturn Boolean(agentMatchV1);`);
  for (const t of ['17 aprovar', 'aprovar 17', 'agentes aprovar 17', '16 reprovar, se o cliente pediu celular não vamos mostrar capas', '#16 recusa', 'agentes', 'agentes pausar alertas',
    '17', 'aprova o 17?', 'Boa tarde', '2 reais', 'quero aprovar o crédito', 'Fez a correção?']) {
    assert.equal(match({ conversation: t }), Boolean(parseAgentCommand(t)), t);
  }
});

test('patch idempotente e só no Comando Admin', { skip }, () => {
  const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const after = m.patchWorkflow(before);
  assert.deepEqual(m.patchWorkflow(after), after);
  assert.deepEqual(after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name), [m.NODE]);
});
