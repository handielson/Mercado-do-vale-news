'use strict';
// payjoy-link-entry-v1: (1) link colado da PayJoy nao pausa o bot; (2) valor aprovado escrito
// na mensagem de aprovacao e guardado; (3) respostas genericas nao apagam estado PayJoy aprovado.
const assert = require('node:assert/strict');
const MARKER = 'payjoy-link-entry-v1';
const NODE = 'Pagamento - Politica';

const REMEMBER_OLD = "const remember = (status) => { if (remoteJid) staticData.payjoyByJid[remoteJid] = { status, updatedAt: Date.now(), expiresAt: Date.now() + 30 * 86400000 }; };";
const REMEMBER_NEW = `const remember = (status) => {
  if (!remoteJid) return;
  // ${MARKER}:keep-approved - respostas genericas nao rebaixam uma aprovacao PayJoy valida.
  const current = staticData.payjoyByJid[remoteJid];
  const currentApproved = current && current.status === 'approved' && Date.now() - Number(current.updatedAt || 0) < 30 * 86400000 && (!current.expiresAt || Number(current.expiresAt) > Date.now());
  if (currentApproved && ['awaiting_link_confirmation', 'awaiting_result'].includes(status)) return;
  const currentAwaitingResult = current && current.status === 'awaiting_result' && Date.now() - Number(current.updatedAt || 0) < 30 * 86400000 && (!current.expiresAt || Number(current.expiresAt) > Date.now());
  if (currentAwaitingResult && status === 'awaiting_link_confirmation') return;
  staticData.payjoyByJid[remoteJid] = { ...(currentApproved && status === 'approved' ? current : {}), status, updatedAt: Date.now(), expiresAt: Date.now() + 30 * 86400000 };
};`;

const PARSE_OLD = "  const n=String(text||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();\n  if(/(?:-|menos)\\s*\\d+(?:[.,]\\d+)?\\s*%/.test(n))return {ambiguous:true};";
const PARSE_NEW = "  // " + MARKER + ":parser - aceita \"1. 600\" e \"aprovada payjoy/playjoy de 1.600\".\n  const n=String(text||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/(\\d)([.,])\\s+(\\d{3})(?!\\d)/g,'$1$2$3');\n  if(/(?:-|menos)\\s*\\d+(?:[.,]\\d+)?\\s*%/.test(n))return {ambiguous:true};";
const AMOUNT_OLD = 'aprovad[oa](?:\\s+(?:ate|de|em|o valor de))?|aprovou';
const AMOUNT_NEW = 'aprovad[oa](?:\\s+(?:(?:pela|pelo|na|da|no)\\s+)?p\\w{1,3}joy)?(?:\\s+(?:ate|de|em|o valor de))?|aprovou';

const MENTION_OLD = "const payjoyMention = /\\b(?:payjoy|boletos?|";
const MENTION_NEW = "// " + MARKER + ":mention - aceita grafias como playjoy/paijoy.\nconst payjoyMention = /\\b(?:payjoy|p\\w{1,3}joy|boletos?|";
const RESULT_OLD = "const resultState={...active,status:values.entryCents!==null?'approved':active.status,";
const RESULT_NEW = "const resultState={...active,status:(values.entryCents!==null||active.status==='awaiting_link_confirmation')?'approved':active.status,";
const FREQUENCY_BRANCH = `} else if ((contextual || payjoyMention) && /\\b(?:quinzen\\w*|semana\\w*|semanal\\w*|mensa\\w*|todo mes|por mes|cada mes|de 15 em 15|a cada 15 dias)\\b/.test(normalized) && !/\\b(?:cartao|credito|maquininha|aluguel|salario)\\b/.test(normalized)) {
  // ${MARKER}:frequency - parcelas PayJoy sao quinzenais (informado pelo operador em 03/11/2026).
  output = 'Na PayJoy as parcelas são quinzenais, ou seja, você paga a cada 15 dias, e não por mês. 😊|||Os valores e as datas de cada parcela aparecem na sua proposta da PayJoy, e o pagamento é feito por boleto ou Pix gerado no aplicativo da PayJoy. 📱';
`;
const PAY_OLD = "output = 'Depois da contratação, você pode gerar no aplicativo PayJoy o boleto ou Pix de cada parcela. As datas e os valores aparecem na sua proposta. 📱';";
const PAY_NEW = "output = 'Depois da contratação, as parcelas da PayJoy são quinzenais (a cada 15 dias). Você pode gerar no aplicativo PayJoy o boleto ou Pix de cada parcela. As datas e os valores aparecem na sua proposta. 📱';";
const KNOWLEDGE_OLD = 'As parcelas podem ser pagas por boleto ou Pix sem cartão de crédito.';
const KNOWLEDGE_NEW = 'As parcelas podem ser pagas por boleto ou Pix sem cartão de crédito. As parcelas da PayJoy são QUINZENAIS (a cada 15 dias), não mensais; se o cliente perguntar se é por mês, por semana ou por quinzena, responda que é por quinzena (' + MARKER + ':frequency). Os valores e as datas de cada parcela aparecem na proposta.';
const KNOWLEDGE_NODES = ['Agente Geral - Atendimento', 'Agente Inicial - Classificador'];
const DECLINE_ANCHOR = "} else if (payjoyDeclineV3 && (contextual || payjoyMention)) {";
const LINK_BRANCH = `} else if (/https?:\\/\\/(?:[a-z0-9-]+\\.)*payjoy\\.com\\S*/.test(normalized) && !approved && !denied) {
  // ${MARKER}:pasted-link - o bot nao abre links; pede print/foto ou valores sem pausar o atendimento.
  const keepLinkStateV1 = contextual && ['approved', 'awaiting_result'].includes(active?.status);
  if (!keepLinkStateV1) remember('awaiting_result');
  const knownAmountV1 = keepLinkStateV1 && Number.isSafeInteger(active.approvedAmountCents) && active.approvedAmountCents > 0 ? active.approvedAmountCents : null;
  if (remoteJid && staticData.payjoyByJid[remoteJid]) staticData.payjoyByJid[remoteJid].awaiting = knownAmountV1 ? 'entry_percent' : (staticData.payjoyByJid[remoteJid].awaiting || 'approved_amount');
  output = 'Não consigo abrir links da PayJoy por aqui. 😊|||' + (knownAmountV1
    ? 'Com o valor aprovado de ' + (knownAmountV1 / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ', me informe o percentual de entrada que aparece na tela ou envie uma foto da tela de aprovação. Com isso, calculo quanto você precisa ter de entrada. 📱'
    : 'Me envie uma foto ou print da tela de aprovação, ou me informe o valor aprovado e o percentual de entrada. Com isso, calculo quanto você precisa ter de entrada. 📱');
`;

const APPROVED_OLD = "  output = 'Que notícia boa! 🎉 Envie um print da aprovação da PayJoy ou me informe o valor aprovado e o percentual de entrada. Assim calculo quanto você precisa ter de entrada sobre o valor aprovado e seguimos com a escolha do aparelho. 📱';";
const APPROVED_NEW = APPROVED_OLD + `
  // ${MARKER}:approved-values - valores escritos junto com a aprovacao ja entram no calculo.
  const approvedInputV1 = parsePayjoyTextV4(text, '');
  if (!approvedInputV1.ambiguous && (approvedInputV1.approvedAmount !== null || approvedInputV1.entryPercent !== null)) {
    const approvedValuesV1 = calculatePayjoyEntryV4(approvedInputV1, {});
    staticData.payjoyByJid[remoteJid] = { ...staticData.payjoyByJid[remoteJid], awaiting: approvedValuesV1.amountCents === null ? 'approved_amount' : approvedValuesV1.percentBp === null ? 'entry_percent' : '', approvedAmountCents: approvedValuesV1.amountCents, entryPercentBp: approvedValuesV1.percentBp };
    output = 'Que notícia boa! 🎉|||' + payjoyReplyV4(approvedValuesV1, '') + (approvedValuesV1.entryCents === null ? ' Se preferir, envie uma foto ou print da tela de aprovação. 📱' : '');
  }`;

function replaceOnce(code, from, to, label) {
  assert.equal(code.split(from).length - 1, 1, label + ' anchor drift');
  return code.replace(from, () => to);
}
function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const node = workflow.nodes.find(item => item.name === NODE);
  assert.ok(node?.parameters?.jsCode, NODE + ' missing');
  let code = node.parameters.jsCode;
  if (code.includes(MARKER)) return workflow;
  code = replaceOnce(code, REMEMBER_OLD, REMEMBER_NEW, 'remember');
  code = replaceOnce(code, MENTION_OLD, MENTION_NEW, 'mention');
  code = replaceOnce(code, RESULT_OLD, RESULT_NEW, 'result state');
  code = replaceOnce(code, PARSE_OLD, PARSE_NEW, 'parser normalize');
  code = replaceOnce(code, AMOUNT_OLD, AMOUNT_NEW, 'parser amount');
  code = replaceOnce(code, DECLINE_ANCHOR, LINK_BRANCH + FREQUENCY_BRANCH + DECLINE_ANCHOR, 'link branch');
  code = replaceOnce(code, PAY_OLD, PAY_NEW, 'payment copy');
  code = replaceOnce(code, APPROVED_OLD, APPROVED_NEW, 'approved branch');
  new Function('$json', '$', '$getWorkflowStaticData', code);
  node.parameters.jsCode = code;
  assert.deepEqual(workflow.connections, input.connections);
  for (const name of KNOWLEDGE_NODES) {
    const agent = workflow.nodes.find(item => item.name === name);
    assert.ok(typeof agent?.parameters?.options?.systemMessage === 'string', name + ' systemMessage missing');
    agent.parameters.options.systemMessage = replaceOnce(agent.parameters.options.systemMessage, KNOWLEDGE_OLD, KNOWLEDGE_NEW, name + ' knowledge');
  }
  assert.deepEqual(workflow.nodes.filter((item, index) => JSON.stringify(item) !== JSON.stringify(input.nodes[index])).map(item => item.name).sort(), [NODE, ...KNOWLEDGE_NODES].sort());
  return workflow;
}
module.exports = { MARKER, NODE, patchWorkflow };
