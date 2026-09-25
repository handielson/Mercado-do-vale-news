const assert = require('node:assert/strict');
const fs = require('node:fs');
const { transformWorkflow, paymentCode } = require('./n8n-payjoy-workflow-patch.cjs');

const liveSnapshotPath = process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT;
if (!liveSnapshotPath || !fs.existsSync(liveSnapshotPath)) {
  throw new Error('Set MDV_PAYJOY_WORKFLOW_SNAPSHOT to a read-only export of the active workflow');
}
const workflow = transformWorkflow(JSON.parse(fs.readFileSync(liveSnapshotPath, 'utf8')));
for (const name of ['Resolver Acao de Conversacao', 'Pagamento - Politica', 'Dividir mensagens', 'Atendente - Horario']) {
  new Function(workflow.nodes.find((node) => node.name === name).parameters.jsCode);
}
assert.equal(workflow.connections['Switch Especialistas'].main[6][0].node, 'PayJoy - Buscar Configuracao');
assert.equal(workflow.connections['Pagamento - Politica'].main[0][0].node, 'PayJoy - Precisa especialista?');
assert(!workflow.nodes.some((node) => String(node.parameters?.jsCode || '').includes('No boleto a gente nao trabalha')));
assert(!workflow.nodes.some((node) => String(node.parameters?.jsCode || '').includes('Nao trabalhamos com boleto')));

const state = {};
const config = {
  payjoy_analysis_url: 'https://app.payjoy.com/br/d2c',
  store_address: 'Rua Exemplo, 123 - Petrolina/PE',
  store_maps_url: 'https://maps.google.com/?q=Petrolina',
};
function reply(message, customConfig = config) {
  const source = { remoteJid: '5587999999999@s.whatsapp.net', conversation: message };
  const getNode = () => ({ first: () => ({ json: source }) });
  return new Function('$', '$json', '$getWorkflowStaticData', paymentCode)(getNode, customConfig, () => state)[0].json;
}
let result = reply('Aceita boleto?');
assert.match(result.output, /PayJoy/);
assert.match(result.output, /app\.payjoy\.com/);
assert.equal(result.payjoyFollowupKind, 'analysis_check');

result = reply('Fui aprovado');
assert.match(result.output, /celulares liberados/);
assert.match(result.output, /\|\|\|📍 Nossa localização:/);
assert.equal(result.payjoyFollowupKind, '');

result = reply('Não fui aprovado');
assert.match(result.output, /15 dias/);
assert.match(result.output, /verificar se é possível/);
assert.equal(result.payjoyFollowupKind, 'retry_check');

result = reply('Não consegui');
assert.equal(result.payjoyFollowupKind, 'retry_check');

result = reply('Não foi aprovado');
assert.equal(result.payjoyFollowupKind, 'retry_check');

result = reply('A PayJoy pode bloquear o aparelho?');
assert.equal(result.payjoyNeedsHandoff, true);
assert.match(result.output, /especialista/);

result = reply('Aceita boleto?', { ...config, payjoy_analysis_url: 'https://example.com/checkout' });
assert.equal(result.payjoyNeedsHandoff, true);
assert.doesNotMatch(result.output, /example\.com/);

console.log('PayJoy workflow patch: routing, response and scheduling flags OK');
