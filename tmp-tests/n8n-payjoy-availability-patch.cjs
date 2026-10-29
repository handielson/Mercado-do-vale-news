'use strict';
const assert = require('node:assert/strict');

const MARKER = 'payjoy-availability-question-v1';
const ANCHOR = '  } else if (/\\b(?:aprovacao|aprovar|analise|link|boletos?|financiamento|parcelar|comprar)\\b/.test(normalized) || /^payjoy[?!.\\s]*$/.test(normalized)) {';
const BRANCH = `  } else if (/\\b(?:celulares?|aparelhos?|smartphones?)\\b.{0,25}\\b(?:pela?|na|com)\\s+payjoy\\b|\\b(?:trabalham|aceitam|tem)\\b.{0,20}\\bpayjoy\\b/.test(normalized)) {
    // ${MARKER}: disponibilidade da modalidade exige resposta, sem presumir elegibilidade ou consentimento para o link.
    remember('awaiting_link_confirmation');
    output = 'Temos a opção de financiar celulares pela PayJoy. 😊 A aprovação e as condições dependem da análise de crédito, e a elegibilidade do aparelho precisa ser conferida. Quer que eu envie o link para fazer a análise?';
`;

function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const node = workflow.nodes.find(item => item.name === 'Pagamento - Politica');
  assert.ok(node?.parameters?.jsCode, 'Pagamento - Politica missing');
  const before = node.parameters.jsCode;
  if (before.includes(MARKER)) return workflow;
  assert.equal(before.split(ANCHOR).length - 1, 1, 'PayJoy branch anchor drift');
  node.parameters.jsCode = before.replace(ANCHOR, BRANCH + ANCHOR);
  new Function('$json', '$', '$getWorkflowStaticData', node.parameters.jsCode);
  assert.deepEqual(workflow.connections, input.connections);
  assert.equal(workflow.nodes.filter((item, index) => JSON.stringify(item) !== JSON.stringify(input.nodes[index])).length, 1);
  return workflow;
}

module.exports = { MARKER, patchWorkflow };
