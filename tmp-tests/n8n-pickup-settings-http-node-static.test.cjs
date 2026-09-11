const assert = require('node:assert/strict');
const { patchWorkflow, makeSettingsNode, MARKER } = require('./n8n-move-pickup-settings-to-http-node.cjs');
const { NEW_SETTINGS_HELPER, NEW_PICKUP_PARSER } = require('./n8n-fix-pickup-time-after-runner-upgrade.cjs');

const postCode = `return (async () => {\nconst source = $json;\n${NEW_PICKUP_PARSER}\n${NEW_SETTINGS_HELPER}\nconst validatePickupTime = (time, settings) => {\n  const todayKey = weekdayKey(new Date());\n  const hours = settings.business_hours || {};\n  const schedule = hours[todayKey] || {};\n  if (!schedule.isOpen) { return { ok: false }; }\n};\nreturn [];\n})();`;
const workflow = patchWorkflow({
  nodes: [{ name: 'Vendas - Verificar Pos Lista', parameters: { jsCode: postCode } }],
  connections: {
    'Parse Classificacao': { main: [[{ node: 'Vendas - Verificar Pos Lista', type: 'main', index: 0 }]] },
    'Switch Especialistas': { main: [[], [{ node: 'Vendas - Verificar Pos Lista', type: 'main', index: 0 }]] },
  },
});
const post = workflow.nodes.find((node) => node.name === 'Vendas - Verificar Pos Lista');
assert.match(post.parameters.jsCode, new RegExp(MARKER));
assert.match(post.parameters.jsCode, /America\/Recife/);
assert.match(post.parameters.jsCode, /Nao consegui confirmar o horario cadastrado/);
assert.doesNotMatch(post.parameters.jsCode, /await fetch\(/);
assert.equal(workflow.connections['Parse Classificacao'].main[0][0].node, 'Vendas - Buscar Configuracoes Loja');
assert.equal(workflow.connections['Switch Especialistas'].main[1][0].node, 'Vendas - Buscar Configuracoes Loja');
assert.equal(workflow.connections['Vendas - Buscar Configuracoes Loja'].main[0][0].node, 'Vendas - Verificar Pos Lista');
const httpNode = makeSettingsNode();
assert.equal(httpNode.parameters.headerParameters.parameters[0].value, '={{$env.SYNC_SECRET}}');
assert.equal(httpNode.onError, 'continueRegularOutput');
console.log('n8n pickup company settings HTTP node checks ok');
