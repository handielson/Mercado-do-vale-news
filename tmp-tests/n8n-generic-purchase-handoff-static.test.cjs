const assert = require('node:assert/strict');
const { MARKER, PURCHASE_NODE, patchParseCode, patchWorkflow } = require('./n8n-fix-generic-purchase-handoff.cjs');

const parseFixture = `const source = $json;
const parsed = {};
const allowed = new Set(['vendas_produtos', 'pedido_humano', 'fallback']);
const intencao = allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback';
const venda = {};
return [{ json: {
    intencao,
} }];`;
const patchedParse = patchParseCode(parseFixture);
assert.match(patchedParse, new RegExp(MARKER));
assert.match(patchedParse, /explicitHumanRequestV1/);
assert.match(patchedParse, /genericPurchaseInquiry/);
assert.doesNotThrow(() => new Function('$json', '$', patchedParse));

const workflow = patchWorkflow({
  nodes: [
    { name: 'Agente Inicial - Classificador', parameters: { options: { systemMessage: 'Intencoes:\n- pedido_humano' } } },
    { name: 'Parse Classificacao', parameters: { jsCode: parseFixture } },
    { name: 'Switch Especialistas', parameters: { rules: { values: [{ outputKey: 'fallback' }] } } },
  ],
  connections: { 'Switch Especialistas': { main: [[{ node: 'Agente Geral - Atendimento', type: 'main', index: 0 }]] } },
});
assert.ok(workflow.nodes.some((node) => node.name === PURCHASE_NODE));
const rules = workflow.nodes.find((node) => node.name === 'Switch Especialistas').parameters.rules.values;
const ruleIndex = rules.findIndex((rule) => rule.outputKey === 'compra_generica');
assert.ok(ruleIndex >= 0);
assert.equal(workflow.connections['Switch Especialistas'].main[ruleIndex][0].node, PURCHASE_NODE);
assert.equal(workflow.connections[PURCHASE_NODE].main[0][0].node, 'Dividir mensagens');
console.log('n8n generic purchase handoff regression checks ok');
