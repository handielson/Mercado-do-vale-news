const assert = require('node:assert/strict');
const { patchWorkflow, summarize } = require('./n8n-fix-used-phone-policy.cjs');

const parseCode = `const source = $('Vendas - Preparar Contexto IA').first().json;
const raw = $json.output || '';
let parsed;
try { parsed = JSON.parse(raw); } catch { parsed = { intencao: 'fallback' }; }
const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'formas_pagamento', 'fallback', 'localizacao_loja']);
const storeLocationNormalizedV129 = String(source.conversation || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const storeLocationIntentV129 = /endereco da loja/.test(storeLocationNormalizedV129);
const intencao = storeLocationIntentV129
  ? 'localizacao_loja'
  : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback');
return [{ json: { ...source, intencao } }];`;

const paymentCode = `const paymentPolicyNormalizeText = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const paymentPolicyReply = (message) => {
  const normalized = paymentPolicyNormalizeText(message);
  const accepted = 'A gente recebe por Pix, transferencia bancaria, dinheiro, cartao de debito e cartao de credito.';
  if (/\\bboleto\\b/.test(normalized)) return 'Nao trabalhamos com boleto.';
  if (/\\b(usado|usados|troca|entrada)\\b/.test(normalized) && !/\\b(dinheiro|pix|valor|r\\$|real|reais)\\b/.test(normalized)) {
    return [
      'A gente trabalha somente com produtos novos.',
      'Por isso nao aceitamos aparelho usado como entrada.',
      accepted,
    ].join('||');
  }
  return accepted;
};
const source = $json || {};
return [{ json: { ...source, output: paymentPolicyReply(source.conversation || '') } }];`;

const nodes = [
  { name: 'Parse Classificacao', parameters: { jsCode: parseCode } },
  { name: 'Pagamento - Politica', parameters: { jsCode: paymentCode } },
];
patchWorkflow(nodes);
const summary = summarize(nodes);
assert.equal(summary.deterministicRoute, true);
assert.equal(summary.refusesBuyingUsed, true);
assert.equal(summary.refusesTradeIn, true);
assert.equal(summary.oldIncompletePolicyRemoved, true);

const patchedParse = nodes[0].parameters.jsCode;
const patchedPayment = nodes[1].parameters.jsCode;
function classify(message, aiIntent = 'vendas_produtos') {
  const lookup = () => ({ first: () => ({ json: { conversation: message } }) });
  return new Function('$', '$json', patchedParse)(lookup, { output: JSON.stringify({ intencao: aiIntent }) })[0].json.intencao;
}
function reply(message) {
  return new Function('$json', patchedPayment)({ conversation: message })[0].json.output;
}

const policyCases = [
  'Gostaria de saber se você faz troca com entrada do celular que te comprei?',
  'Vocês aceitam meu celular usado como entrada?',
  'Você pega celular usado?',
  'Vocês compram aparelhos usados?',
  'Só tem novo ou tem usado também?',
  'Celular seminovo?',
];
for (const message of policyCases) {
  assert.equal(classify(message), 'formas_pagamento', message);
  const output = reply(message);
  assert.match(output, /somente com celulares novos/);
  assert.match(output, /nao compramos aparelhos usados/);
  assert.match(output, /nao os aceitamos como entrada ou troca/);
  assert.doesNotMatch(output, /especialista|lista|catalogo/i);
}

const ordinaryCases = [
  'Tenho R$ 200 de entrada, quanto fica?',
  'Comprei um celular usado e ele deu defeito',
  'Quero trocar um celular com defeito',
  'Tem fonte usada de 12v?',
];
for (const message of ordinaryCases) {
  assert.equal(classify(message), 'vendas_produtos', message);
}

console.log(JSON.stringify({ passed: policyCases.length + ordinaryCases.length, summary }, null, 2));
