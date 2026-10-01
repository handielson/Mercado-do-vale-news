const assert = require('node:assert/strict');
const { MARKER, patchWorkflow } = require('./n8n-fix-used-phone-payjoy-regression.cjs');

const paymentCode = `const source = $('Resolver Acao de Conversacao').first().json || {};
const config = $json || {};
const text = String(source.conversation || source.mensagem || '').trim();
const normalized = text.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const remoteJid = String(source.remoteJid || '').trim();
const staticData = $getWorkflowStaticData('global');
staticData.payjoyByJid = staticData.payjoyByJid || {};
const active = staticData.payjoyByJid[remoteJid];
const contextual = active && Date.now() - Number(active.updatedAt || 0) < 30 * 86400000;
const payjoyMention = /\\b(?:payjoy|boleto|financiamento(?: no boleto)?)\\b/.test(normalized);
const approved = /\\baprovad[oa]\\b/.test(normalized);
const denied = /\\b(?:negado|reprovad[oa])\\b/.test(normalized);
const link = String(config.payjoy_analysis_url || '').trim();
const officialLink = link;
const remember = () => {};
let output = '';
let payjoyFollowupKind = '';
let payjoyNeedsHandoff = false;

if ((contextual || payjoyMention) && denied) {
  output = 'PayJoy negada';
} else if ((contextual || payjoyMention) && approved) {
  output = 'PayJoy aprovada';
} else if (payjoyMention) {
  output = 'Resposta PayJoy';
} else if (/\\b(?:usado|usados|troca)\\b/.test(normalized)) {
  output = 'No momento, trabalhamos somente com celulares novos.';
} else {
  output = 'Recebemos por Pix, transferência bancária, dinheiro, cartão de débito e cartão de crédito.';
}
return [{ json: { ...source, output, payjoyFollowupKind, payjoyNeedsHandoff } }];`;

const workflow = {
  nodes: [{ name: 'Pagamento - Politica', parameters: { jsCode: paymentCode } }],
  connections: {},
};
const patched = patchWorkflow(workflow);
const code = patched.nodes[0].parameters.jsCode;
assert.match(code, new RegExp(MARKER));

function reply(message, contextual = false) {
  const source = { conversation: message, remoteJid: 'test@s.whatsapp.net' };
  const globals = contextual ? { payjoyByJid: { [source.remoteJid]: { updatedAt: Date.now() } } } : {};
  const lookup = () => ({ first: () => ({ json: source }) });
  return new Function('$', '$json', '$getWorkflowStaticData', code)(lookup, {}, () => globals)[0].json.output;
}

for (const message of [
  'Vcs trabalham com celulares seminovos',
  'Vocês vendem celular seminovo?',
  'Tem smartphones usados?',
  'Celular semi novo no boleto?',
]) {
  const output = reply(message, true);
  assert.match(output, /somente com celulares novos/i, message);
  assert.doesNotMatch(output, /PayJoy|Recebemos por Pix/i, message);
}

assert.equal(reply('Tem boleto?'), 'Resposta PayJoy');
assert.match(reply('Quais formas de pagamento?'), /Recebemos por Pix/);

console.log(JSON.stringify({ passed: 6, marker: MARKER }, null, 2));
