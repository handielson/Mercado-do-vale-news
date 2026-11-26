'use strict';
// card-machine-list-v1: textos de cartão em lista com emojis, sem cartão virtual nem link.
// MDV_N8N_SALES_SNAPSHOT=<workflow.json> node --test tmp-tests/n8n-card-machine-list.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('../scripts/n8n-card-machine-list.cjs');
const snapshotPath = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshotPath || !fs.existsSync(snapshotPath) ? 'sem MDV_N8N_SALES_SNAPSHOT' : false;

test('cartão em lista com emojis, sem redação e sem cartão virtual/link', { skip }, () => {
  const raw = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const before = raw.nodes ? raw : raw.workflow;
  const after = M.patchWorkflow(before);
  M.assertExpectedGraph(before, after);
  assert.deepEqual(after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name), M.CHANGED);
  assert.equal(JSON.stringify(M.patchWorkflow(after)), JSON.stringify(after));
  const code = after.nodes.find((n) => n.name === M.NODE).parameters.jsCode;
  for (const text of Object.values(M.TEXTS)) {
    assert.ok(code.includes(text), text);
    const lines = text.split('||');
    assert.ok(lines.length >= 3 && lines.every((line) => /^\p{Extended_Pictographic}/u.test(line)), 'cada linha começa com emoji');
    assert.equal(lines.at(-1), M.NO_VIRTUAL);
  }
  assert.doesNotMatch(code, /presencial|dividimos em até 12x\. 💳\|\|As parcelas|No cartão o valor é sem desconto\./);
  // juros do cartão: a lista vem primeiro e a PayJoy pendente continua depois em outra mensagem.
  const start = code.indexOf('// card-interest-answer-v1: resposta da equipe');
  const block = code.slice(start, code.indexOf('if (usedPhonePolicyV529) {', start));
  const ctx = { output: '', payjoyFollowupKind: '', remembered: [], approved: false, denied: false, officialLink: 'https://app.payjoy.com/br/x',
    source: { conversationIntent: 'juros_cartao' }, payjoyPendingV5: true, payjoyAcceptV5: false };
  vm.runInNewContext(`const remember = (s) => remembered.push(s); ${block} if (false) {}`, ctx);
  assert.equal(ctx.output, M.TEXTS.juros + '|||E sobre a PayJoy: quer que eu envie o link para você fazer a análise? 😊');
});
