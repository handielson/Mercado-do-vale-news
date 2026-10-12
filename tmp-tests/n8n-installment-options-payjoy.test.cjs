const assert = require('node:assert/strict');
const fs = require('node:fs');
const { updateInstallmentOptionsWorkflow } = require('./n8n-payjoy-workflow-patch.cjs');
const { validate: validateConfirmation } = require('./n8n-fix-payjoy-link-confirmation.cjs');

const snapshotPath = process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT;
assert.ok(snapshotPath, 'Set MDV_PAYJOY_WORKFLOW_SNAPSHOT to a read-only active workflow export');
const original = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const updated = updateInstallmentOptionsWorkflow(original);
assert.deepEqual(updated.connections, original.connections);
assert.deepEqual(updateInstallmentOptionsWorkflow(updated), updated);
const alreadyApplied = original.nodes.find(node => node.name === 'Pagamento - Politica').parameters.jsCode.includes('installment-options-payjoy-v1');
assert.deepEqual(original.nodes.filter((node, index) => JSON.stringify(node) !== JSON.stringify(updated.nodes[index])).map(node => node.name), alreadyApplied ? [] : ['Pagamento - Politica']);
const code = updated.nodes.find(node => node.name === 'Pagamento - Politica').parameters.jsCode;
for (const marker of ['used-phone-payjoy-priority-v529', 'payjoy-link-confirmation-v1', 'payjoy-analysis-confirmation-v2']) assert.ok(code.includes(marker), marker);
const remoteJid = 'fixture@s.whatsapp.net';
const config = { payjoy_analysis_url: 'https://app.payjoy.com/br/d2c?fixture=1' };
function reply(conversation, state = {}, settings = config) {
  const source = { remoteJid, conversation };
  return new Function('$json', '$', '$getWorkflowStaticData', code)(settings, () => ({ first: () => ({ json: source }) }), () => state)[0].json;
}
for (const question of ['Quais são as opções de parcelamento?', 'Vocês dividem em parcelas?', 'Tem parcelamento?']) {
  const state = {};
  const result = reply(question, state);
  assert.match(result.output, /até 12x/);
  assert.match(result.output, /cartão é presencial/);
  assert.match(result.output, /PayJoy.*boleto ou Pix/);
  assert.match(result.output, /\|\|\|Via Boleto:/);
  assert.match(result.output, /entrada, as parcelas e o custo total dependem da proposta/);
  assert.doesNotMatch(result.output, /https:/);
  assert.equal(result.payjoyFollowupKind, '');
  assert.equal(state.payjoyByJid[remoteJid].status, 'awaiting_link_confirmation');
  const confirmation = reply('Sim', state);
  assert.match(confirmation.output, /https:\/\/app\.payjoy\.com/);
  assert.equal(confirmation.payjoyFollowupKind, 'analysis_check');
  assert.equal(state.payjoyByJid[remoteJid].status, 'awaiting_result');
}
for (const question of ['Quantas parcelas no cartão?', 'Quais as opções de parcelamento no cartão de crédito?']) {
  const state = {};
  assert.doesNotMatch(reply(question, state).output, /PayJoy/);
  assert.equal(state.payjoyByJid[remoteJid], undefined);
}
const pending = () => ({ payjoyByJid: { [remoteJid]: { status: 'awaiting_link_confirmation', updatedAt: Date.now() } } });
assert.doesNotMatch(reply('Não quero fazer a análise', pending()).output, /https:/);
assert.doesNotMatch(reply('Vocês aceitam celular usado como entrada?', pending()).output, /https:/);
assert.match(reply('Vocês aceitam celular usado como entrada?', pending()).output, /não os aceitamos como entrada/);
assert.match(reply('Quanto de entrada na PayJoy?').output, /proposta da PayJoy após a análise/);
assert.equal(reply('Sim', pending(), { payjoy_analysis_url: 'https://example.com' }).payjoyNeedsHandoff, true);
validateConfirmation(updated);
console.log('Active workflow: installment options, card-specific questions, confirmation, used-phone priority, proposal limits and patch isolation passed');
