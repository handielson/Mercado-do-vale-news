import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { patchWorkflow, summarize } = require('./n8n-preserve-rapid-greeting.cjs');

const parseCode = `const source = $('Vendas - Preparar Contexto IA').first().json;
const raw = $json.output || $json.text || $json.response || '';
let parsed;
try { parsed = JSON.parse(raw); } catch (error) { parsed = { intencao: 'fallback', saudacao_detectada: false, venda: {}, fluxo_venda: {} }; }
const venda = parsed?.venda && typeof parsed.venda === 'object' && !Array.isArray(parsed.venda) ? parsed.venda : {};
const fluxoVenda = parsed?.fluxo_venda && typeof parsed.fluxo_venda === 'object' && !Array.isArray(parsed.fluxo_venda) ? parsed.fluxo_venda : {};
return [{ json: { ...source, saudacaoDetectada: parsed.saudacao_detectada === true, salesSearchQuery: String(venda.busca || '') } }];`;
const nodes = [{ name: 'Parse Classificacao', type: 'n8n-nodes-base.code', parameters: { jsCode: parseCode } }];
patchWorkflow(nodes);
const summary = summarize(nodes);
assert.deepEqual(summary, {
  marker: true,
  currentGreetingDetected: true,
  unansweredHistoryGreetingDetected: true,
  boundedToThreeMinutes: true,
  requiresAfterLastOutbound: true,
  oldFieldRemoved: true,
});

const code = nodes[0].parameters.jsCode;
const execute = ({ conversation, recentMessages, parsedGreeting = false }) => vm.runInNewContext(`(function(){${code}})()`, {
  $json: { output: JSON.stringify({ intencao: 'vendas_produtos', saudacao_detectada: parsedGreeting, venda: { busca: 'smartphones' }, fluxo_venda: {} }) },
  $: () => ({ first: () => ({ json: { conversation, recentMessages } }) }),
})[0].json;

const base = Date.parse('2026-08-03T17:03:15.000Z');
const row = (direction, text, offsetMs) => ({ direction, text, created_at: new Date(base + offsetMs).toISOString() });

assert.equal(execute({
  conversation: 'E os valores?',
  recentMessages: [row('inbound', 'Boa tarde', -19_000), row('inbound', 'Tem lista de Xiaomi?', -5_000), row('inbound', 'E os valores?', 0)],
}).saudacaoDetectada, true, 'rapid unanswered greeting must be inherited by the current product request');

assert.equal(execute({
  conversation: 'Tem lista de Xiaomi?',
  recentMessages: [row('inbound', 'Boa tarde', -20_000), row('outbound', 'Boa tarde! Como posso ajudar?', -10_000), row('inbound', 'Tem lista de Xiaomi?', 0)],
}).saudacaoDetectada, false, 'a greeting already answered by the store must not be reused');

assert.equal(execute({
  conversation: 'Tem lista de Xiaomi?',
  recentMessages: [row('inbound', 'Boa tarde', -10 * 60_000), row('inbound', 'Tem lista de Xiaomi?', 0)],
}).saudacaoDetectada, false, 'an old greeting must not leak into a later request');

assert.equal(execute({
  conversation: 'Boa tarde, tem Xiaomi?',
  recentMessages: [row('inbound', 'Boa tarde, tem Xiaomi?', 0)],
}).saudacaoDetectada, true, 'a greeting mixed into the current product request must be deterministic');

patchWorkflow(nodes);
assert.equal(summarize(nodes).marker, true, 'patch must be idempotent');

console.log('n8n rapid greeting inheritance static checks passed');
