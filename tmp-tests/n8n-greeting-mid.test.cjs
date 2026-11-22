// greeting-courtesy-v2: no meio da conversa, cumprimento curto, sem repetir "Sou a Val" (caso 558781132777).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const v1 = require('../scripts/n8n-greeting-courtesy.cjs');
const nameFix = require('../scripts/n8n-payjoy-link-delivered.cjs');
const m = require('../scripts/n8n-greeting-mid.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';
const base = () => {
  const w = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const node = w.nodes.find((n) => n.name === m.NODE);
  if (!node.parameters.jsCode.includes(v1.MARK)) node.parameters.jsCode = v1.patchDividir(node.parameters.jsCode);
  if (!node.parameters.jsCode.includes(nameFix.NAME_MARK)) node.parameters.jsCode = nameFix.patchDividir(node.parameters.jsCode);
  return w;
};
const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
const G = hour >= 5 && hour < 12 ? 'Bom dia' : (hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite');
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const mid = [{ direction: 'outbound', text: 'Boa tarde! Tudo bem? 😊', created_at: ago(2) }, { direction: 'outbound', text: 'Eu sou a Val, da equipe do Mercado do Vale. Como posso ajudar?', created_at: ago(30) },
  { direction: 'outbound', text: 'Qual modelo voce quer ver em mais detalhes? 😊', created_at: ago(1) }];
function run(w, output, conversation, recent, greeting = true) {
  const code = w.nodes.find((n) => n.name === m.NODE).parameters.jsCode;
  const nodes = { 'Resolver Acao de Conversacao': { saudacaoDetectada: greeting }, 'switc Mensagens': { remoteJid: 'x@s.whatsapp.net', conversation },
    'Contato - Resolver': {}, 'Contato - Preparar': {}, 'Controle Bot - Aplicar Controle': { recentMessages: recent, conversation } };
  const $ = (name) => ({ first: () => ({ json: nodes[name] || {} }) });
  return new Function('$', '$json', code)($, { clienteNome: '', output }, {}).map((i) => i.json);
}

test('caso real: "Boa tarde, tudo bem!" depois da lista → só "Tudo ótimo por aqui, e com você? 😊"', { skip }, () => {
  const r = run(m.patchWorkflow(base()), '[[SAUDACAO]] Tudo bem, obrigado! 😊[[MSG]]Sou a Val, da equipe do Mercado do Vale. Como posso ajudar?', 'Boa tarde, tudo bem!', mid);
  assert.deepEqual(r.map((x) => x.message), ['Tudo ótimo por aqui, e com você? 😊']);
  assert.deepEqual([r[0].messageIndex, r[0].totalMessages], [1, 1]);
});

test('só "boa tarde" no meio da conversa → "<período>! 😊"', { skip }, () => {
  assert.deepEqual(run(m.patchWorkflow(base()), '[[SAUDACAO]]! Sou a Val, da equipe do Mercado do Vale. Como posso ajudar?', 'boa tarde', mid).map((x) => x.message), [`${G}! 😊`]);
});

test('pergunta de verdade: tira a apresentação repetida e mantém a resposta; vírgula depois da saudação', { skip }, () => {
  const w = m.patchWorkflow(base());
  const r = run(w, '[[SAUDACAO]] Nathan! Sou a Val, da equipe do Mercado do Vale. Temos sim o Redmi 15C 😊', 'boa tarde, tem redmi 15c?', mid);
  assert.deepEqual(r.map((x) => x.message), [`${G}, Nathan! Temos sim o Redmi 15C 😊`]);
});

test('sem apresentação recente, "Sou a Val" fica; primeira resposta segue o v1', { skip }, () => {
  const w = m.patchWorkflow(base());
  const semVal = [{ direction: 'outbound', text: 'Segue a lista', created_at: ago(5) }];
  assert.deepEqual(run(w, 'Temos sim![[MSG]]Sou a Val, da equipe do Mercado do Vale.', 'tem redmi?', semVal, false).map((x) => x.message), ['Temos sim!', 'Sou a Val, da equipe do Mercado do Vale.']);
  const first = run(w, 'Segue a lista.', 'Boa tarde, tudo bem?', [{ direction: 'inbound', text: 'Boa tarde, tudo bem?', created_at: ago(0) }]);
  assert.equal(first[0].message, `${G}! Tudo ótimo por aqui, e com você? 😊`);
});

test('patch idempotente e só no Dividir mensagens', { skip }, () => {
  const before = base();
  const after = m.patchWorkflow(before);
  assert.deepEqual(m.patchWorkflow(after), after);
  assert.deepEqual(after.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(before.nodes[i])).map((n) => n.name), [m.NODE]);
});
