const assert = require('node:assert/strict');
const { MARKER, patchWorkflow, runSelfTest } = require('./n8n-followup-model-official-card.cjs');

const nodes = [{
  name: 'Vendas - Verificar Pos Lista',
  parameters: { jsCode: `return (async () => {
const source = $('Parse Classificacao').first().json || {};
const staticData = $getWorkflowStaticData('global');
staticData.salesPostList = staticData.salesPostList || {};
const activeState = staticData.salesPostList[source.remoteJid] || null;
const aiAction = String(source.salesFlowAction || '').trim();
function buildContinueItem() { return [{ json: { ...source, salesPostListHandled: false } }]; }
if (!activeState || !Array.isArray(activeState.options) || activeState.options.length === 0) {
  if (aiAction === 'pedir_ficha') return [{ json: { ...source, salesPostListHandled: true, messages: [{ type: 'text', text: 'formato abreviado' }, { type: 'image', mediaUrl: 'produto.jpg' }] } }];
  return buildContinueItem();
}
return buildContinueItem();
})();` },
}];

const patched = patchWorkflow(nodes);
assert.match(patched[0].parameters.jsCode, new RegExp(MARKER));
assert.match(patched[0].parameters.jsCode, /return buildContinueItem\(\);/);

runSelfTest(patched).then((result) => {
  assert.deepEqual(result, {
    routedToOfficialCatalog: true,
    queryPreserved: true,
    abbreviatedRecoverySkipped: true,
    extraProductImageSkipped: true,
  });
  const secondPatch = patchWorkflow(patched);
  assert.equal(secondPatch[0].parameters.jsCode, patched[0].parameters.jsCode);
  console.log('n8n follow-up model official card regression: ok');
}).catch((error) => { console.error(error.stack || error.message); process.exit(1); });
