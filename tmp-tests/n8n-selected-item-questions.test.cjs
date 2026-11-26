'use strict';
// selected-item-question-v1 + card-interest-answer-v1 (conversas 558781242854 e 558791545841, 26/11).
// MDV_N8N_SALES_SNAPSHOT=<workflow.json> node --test tmp-tests/n8n-selected-item-questions.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('../scripts/n8n-selected-item-questions.cjs');

const snapshotPath = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshotPath || !fs.existsSync(snapshotPath) ? 'sem MDV_N8N_SALES_SNAPSHOT' : false;
const load = () => {
  const raw = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const before = raw.nodes ? raw : raw.workflow;
  const after = M.patchWorkflow(before);
  const code = (wf, name) => wf.nodes.find((n) => n.name === name).parameters.jsCode;
  return { before, after, code };
};
const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const slice = (code, start, end) => {
  const a = code.indexOf(start); const b = code.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `trecho ${start} não encontrado`);
  return code.slice(a, b);
};

const option = (memory, colors, price) => ({ name: 'Redmi Note 17', memory, price,
  colors: colors.map((color, i) => ({ color, productId: memory + color, stock: 1 })),
  memoryOptions: [{ memory, price, productIds: colors.map((color) => memory + color) }] });
const state = () => ({ flow: 'sales_post_list', step: 'awaiting_purchase_confirmation', updatedAt: new Date().toISOString(),
  orderDraft: { productId: '4GB/128GBVerde', name: 'Redmi Note 17', memory: '4GB/128GB', color: 'Verde' },
  options: [option('4GB/128GB', ['Verde'], 'R$ 1.385,00'), option('6GB/128GB', ['Preto'], 'R$ 1.499,00'), option('8GB/256GB', ['Preto', 'Roxo'], 'R$ 1.659,00'),
    { ...option('8GB/256GB', ['Roxo'], 'R$ 1.389,00'), name: 'Realme C73' }] });

function decide(resolverCode, text, active) {
  const block = slice(resolverCode, `// ${M.MARK_ITEM}: pergunta sobre o aparelho do card`, 'const metaOrderStateV1');
  const ctx = { normalize, text, getActivePostList: () => active, Date };
  vm.runInNewContext(`${block}; this.out = selectedItemQuestionV1 || cardInterestQuestionV1 || null;`, ctx);
  return ctx.out;
}

test('patch só muda Resolver, Pós-lista e Pagamento; idempotente', { skip }, () => {
  const { before, after } = load();
  M.assertExpectedGraph(before, after);
  const changed = after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name).sort();
  assert.deepEqual(changed, [...M.CHANGED].sort());
  assert.equal(JSON.stringify(M.patchWorkflow(after)), JSON.stringify(after));
  for (const name of M.CHANGED) new Function('$', '$json', '$input', '$getWorkflowStaticData', `return (async () => {${after.nodes.find((n) => n.name === name).parameters.jsCode}\n})`);
});

test('Resolver: RAM e versão do aparelho do card ficam no pós-lista; juros do cartão vão para a política', { skip }, () => {
  const { after, code } = load();
  const r = code(after, M.RESOLVER);
  assert.equal(decide(r, 'Quanto tem de ram', state()).intencao, 'pergunta_memoria_item');
  assert.equal(decide(r, 'Tem quanto de ram', state()).acao, 'continuar_pedido');
  const pro = decide(r, 'Aí não é o pro', state());
  assert.equal(pro.intencao, 'pergunta_versao_item'); assert.equal(pro.versao, 'pro');
  assert.equal(decide(r, 'Quanto tem de ram', null), null, 'sem aparelho escolhido segue o fluxo normal');
  assert.equal(decide(r, 'tem de 8gb de ram?', state()), null, 'memória explícita segue a escolha de variação');
  assert.equal(decide(r, 'quero ver a lista de celulares com mais memoria', state()), null);
  assert.equal(decide(r, 'Tem o iphone 15 pro?', state()), null, 'outro aparelho segue a busca');
  const old = state(); old.updatedAt = new Date(Date.now() - 5 * 3600000).toISOString();
  assert.equal(decide(r, 'Quanto tem de ram', old), null, 'card antigo não prende a conversa');
  assert.equal(decide(r, 'Tem juros a maquineta?\nQuero', null).intencao, 'juros_cartao');
  assert.equal(decide(r, 'Mais caso eu queira divide a taxa da maquineta é muita alta ?', null).intencao, 'juros_cartao');
  assert.equal(decide(r, 'No cartão como fica tem juros ?', null).acao, 'responder_politica_pagamento');
  assert.equal(decide(r, 'a payjoy tem juros?', null), null, 'juros da PayJoy seguem o fluxo da PayJoy');
  assert.match(r, /const decision = selectedItemQuestionV1 \|\| cardInterestQuestionV1 \|\| /);
});

function posAnswer(posCode, intent, version, active) {
  const block = slice(posCode, `// ${M.MARK_ITEM}: RAM/memória ou outra versão`, '// meta-sales-parity-v1');
  const variantsOf = new Function(`${slice(posCode, 'const variantsOf = function variantsOf(option) {', '\n};\n')}\n}; return variantsOf;`)();
  const ctx = { normalize, variantsOf, activeState: active, now: Date.now(), lineBreak: '[[BR]]', source: { remoteJid: 'x' },
    $: (name) => { if (name === 'Resolver Acao de Conversacao') return { first: () => ({ json: { conversationIntent: intent, conversationDecision: { versao: version } } }) }; throw new Error(name); } };
  return vm.runInNewContext(`(function(){${block}\n return null; })()`, ctx);
}

test('Pós-lista: responde RAM e versão com as memórias do mesmo modelo, sem lista', { skip }, () => {
  const { after, code } = load();
  const p = code(after, M.POS_LISTA);
  const ram = posAnswer(p, 'pergunta_memoria_item', '', state())[0].json.output.split('[[BR]]');
  assert.equal(ram[0], 'Esse Redmi Note 17 Verde tem 4GB de RAM e 128GB de armazenamento.');
  assert.ok(ram.includes('• 6GB/128GB (Preto) — R$ 1.499,00 no PIX'));
  assert.ok(ram.includes('• 8GB/256GB (Preto, Roxo) — R$ 1.659,00 no PIX'));
  assert.ok(!ram.some((l) => /Realme/.test(l)), 'outro modelo não entra');
  const pro = posAnswer(p, 'pergunta_versao_item', 'pro', state())[0].json.output.split('[[BR]]');
  assert.equal(pro[0], 'O Redmi Note 17 Pro não temos no momento. 😕');
  assert.ok(pro.includes('• 4GB/128GB (Verde) — R$ 1.385,00 no PIX'));
  assert.equal(posAnswer(p, 'listar_catalogo', '', state()), null, 'outras intenções seguem o fluxo');
});

test('Pagamento: juros do cartão com a resposta da equipe e aceite da PayJoy pendente', { skip }, () => {
  const { after, code } = load();
  const pay = code(after, M.PAGAMENTO);
  const block = slice(pay, `// ${M.MARK_CARD}: resposta da equipe`, 'if (usedPhonePolicyV529) {');
  const run = (vars) => {
    const ctx = { output: '', payjoyFollowupKind: '', remembered: [], approved: false, denied: false, officialLink: 'https://app.payjoy.com/br/x', ...vars };
    vm.runInNewContext(`const remember = (s) => remembered.push(s); ${block} if (false) {}`, ctx);
    return ctx;
  };
  const plain = run({ source: { conversationIntent: 'juros_cartao' }, payjoyPendingV5: false, payjoyAcceptV5: false });
  assert.match(plain.output, /^No cartão o valor é sem desconto\. 💳\|\|O preço à vista \(Pix ou dinheiro\) já vem com desconto/);
  const accept = run({ source: { conversationIntent: 'juros_cartao' }, payjoyPendingV5: true, payjoyAcceptV5: true });
  assert.match(accept.output, /\|\|\|Claro! 😊 Você faz a análise diretamente com a PayJoy/);
  assert.deepEqual(accept.remembered, ['awaiting_result']);
  const pending = run({ source: { conversationIntent: 'juros_cartao' }, payjoyPendingV5: true, payjoyAcceptV5: false });
  assert.match(pending.output, /quer que eu envie o link/);
  assert.equal(run({ source: { conversationIntent: 'pagamento' }, payjoyPendingV5: false, payjoyAcceptV5: false }).output, '');
});
