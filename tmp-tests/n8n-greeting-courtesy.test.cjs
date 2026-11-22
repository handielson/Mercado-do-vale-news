// greeting-courtesy-v1: primeira resposta da conversa com "Bom dia/Boa tarde/Boa noite, Nome! Tudo bem? 😊".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, patchDividir, MARK, NODE } = require('../scripts/n8n-greeting-courtesy.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const load = () => JSON.parse(fs.readFileSync(snapshot, 'utf8'));
const original = () => load().nodes.find((n) => n.name === NODE).parameters.jsCode
  .replace(/\n\/\/ greeting-courtesy-v1:[\s\S]*?\n\};\n/, '\n')
  .replace('return courtesyV1(finalizeItems(messages));', 'return finalizeItems(messages);')
  .replace('return courtesyV1(finalizeItems([...parts, ...suffix]));', 'return finalizeItems([...parts, ...suffix]);');
const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
const G = hour >= 5 && hour < 12 ? 'Bom dia' : (hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite');
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

function run(code, json, { recent = [], conversation = 'oi', greeting = false } = {}) {
  const nodes = {
    'Resolver Acao de Conversacao': { saudacaoDetectada: greeting },
    'switc Mensagens': { remoteJid: '5587999990000@s.whatsapp.net', conversation },
    'Contato - Resolver': {}, 'Contato - Preparar': {},
    'Controle Bot - Aplicar Controle': { recentMessages: recent, conversation },
  };
  const $ = (name) => ({ first: () => ({ json: nodes[name] || {} }) });
  return new Function('$', '$json', code)($, { clienteNome: 'Marcelo Souza', ...json }).map((i) => i.json);
}

const skip = !snapshot && 'sem snapshot do n8n';

test('primeira resposta sem saudação (lista de anúncio) ganha "<período>, Nome! Tudo bem? 😊" antes', { skip }, () => {
  const code = patchDividir(original());
  const r = run(code, { output: 'Segue a lista atualizada de celulares disponíveis. 📱' }, { recent: [{ direction: 'inbound', created_at: ago(0) }], conversation: 'Quero receber a lista atualizada de celulares.' });
  assert.deepEqual(r.map((m) => m.message), [`${G}, Marcelo! Tudo bem? 😊`, 'Segue a lista atualizada de celulares disponíveis. 📱']);
  assert.deepEqual(r.map((m) => m.messageIndex), [1, 2]);
  assert.equal(r[1].totalMessages, 2);
});

test('saudação que a IA já escreveu não duplica; só saudação vira a linha completa', { skip }, () => {
  const code = patchDividir(original());
  const r = run(code, { output: '[[SAUDACAO]] Marcelo! Temos sim o Redmi 15C 😊' }, { greeting: true });
  assert.deepEqual(r.map((m) => m.message), [`${G}, Marcelo! Tudo bem? 😊`, 'Temos sim o Redmi 15C 😊']);
  const so = run(code, { output: '[[SAUDACAO]] Marcelo!' }, { greeting: true });
  assert.deepEqual(so.map((m) => m.message), [`${G}, Marcelo! Tudo bem? 😊`]);
});

test('cliente perguntou "tudo bem?": responde e devolve a pergunta', { skip }, () => {
  const code = patchDividir(original());
  const r = run(code, { output: 'Como posso te ajudar?' }, { conversation: 'Oi, boa tarde, tudo bem?' });
  assert.equal(r[0].message, `${G}, Marcelo! Tudo ótimo por aqui, e com você? 😊`);
});

test('catálogo (lista de mensagens com imagem) também começa com a saudação; citação fica só na primeira', { skip }, () => {
  const code = patchDividir(original());
  const r = run(code, { messages: [{ type: 'image', mediaUrl: 'https://api.xiaomipetrolina.com.br/images/x.jpg', caption: 'Poco X8' }, { text: '📱 Orçamento' }], replyToWaMessageId: 'W1', replyToText: 'oi' });
  assert.equal(r[0].messageType, 'text');
  assert.equal(r[0].message, `${G}, Marcelo! Tudo bem? 😊`);
  assert.equal(r[1].messageType, 'image');
  assert.equal(r.filter((m) => m.replyToWaMessageId).length <= 1, true);
});

test('no meio da conversa (respondemos há 10 min) fica exatamente como antes', { skip }, () => {
  const orig = original();
  const code = patchDividir(orig);
  const recent = [{ direction: 'outbound', created_at: ago(10) }, { direction: 'inbound', created_at: ago(1) }];
  for (const output of ['Temos sim o Redmi 15C 😊', '[[SAUDACAO]] Marcelo! Temos sim', 'Oi! Qual modelo?[[MSG]]Segue a lista']) {
    for (const greeting of [false, true]) {
      assert.deepEqual(run(code, { output }, { recent, greeting }), run(orig, { output }, { recent, greeting }), `${output} / ${greeting}`);
    }
  }
});

test('sem nome salvo: "<período>! Tudo bem? 😊"; não come palavra do texto', { skip }, () => {
  const code = patchDividir(original());
  const r = run(code, { output: 'Oi temos sim', clienteNome: '' });
  assert.deepEqual(r.map((m) => m.message), [`${G}! Tudo bem? 😊`, 'Temos sim']);
});

test('patch: idempotente, só muda o nó Dividir mensagens e mantém o grafo', { skip }, () => {
  const before = load();
  const after = patchWorkflow(before);
  assert.deepEqual(patchWorkflow(after), after);
  assert.deepEqual(after.connections, before.connections);
  const mudou = after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name);
  assert.deepEqual(mudou, before.nodes.find((n) => n.name === NODE).parameters.jsCode.includes(MARK) ? [] : [NODE]);
});
