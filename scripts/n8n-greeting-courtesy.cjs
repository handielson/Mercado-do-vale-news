'use strict';

// greeting-courtesy-v1 (22/11/2026, v1.2.885) — o robô cumprimenta com educação na primeira resposta da conversa.
// Antes: a saudação dependia do classificador e se perdia nos caminhos de lista/catálogo e anúncio
// ("Quero receber a lista atualizada" → "Segue a lista…"; "Boa tarde" → orçamento direto).
// Agora, no nó "Dividir mensagens" (por onde passam todas as respostas): se não mandamos nada para esse cliente
// nas últimas 6 horas, a primeira mensagem é "Bom dia/Boa tarde/Boa noite, <Nome>! Tudo bem? 😊" (horário de Recife).
// Se o cliente já perguntou "tudo bem?", a resposta é "Tudo ótimo por aqui, e com você? 😊".
// A saudação que a IA já tinha escrito no começo é tirada para não repetir. No meio da conversa nada muda.

const MARK = 'greeting-courtesy-v1';
const NODE = 'Dividir mensagens';
const NODES = [NODE];

function once(code, before, after, label) {
  const count = code.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: âncora encontrada ${count} vezes`);
  return code.replace(before, () => after);
}

const BLOCK = `
// ${MARK}: primeira resposta da conversa (nada nosso nas últimas 6 h) começa com saudação do horário + "Tudo bem?".
let courtesyControlV1 = null;
try { courtesyControlV1 = $('Controle Bot - Aplicar Controle').first().json || null; } catch (_) {}
const courtesyRecentV1 = Array.isArray(courtesyControlV1?.recentMessages) ? courtesyControlV1.recentMessages : null;
const courtesyLastOutV1 = (courtesyRecentV1 || []).reduce((latest, row) => {
  if (String(row?.direction || '').toLowerCase() !== 'outbound') return latest;
  const at = Date.parse(String(row?.created_at || ''));
  return Number.isFinite(at) ? Math.max(latest, at) : latest;
}, 0);
const courtesyFirstReplyV1 = courtesyRecentV1 ? (courtesyLastOutV1 === 0 || Date.now() - courtesyLastOutV1 >= 6 * 60 * 60 * 1000) : greetingAllowed;
const courtesyNormV1 = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
const courtesyClientTextV1 = courtesyNormV1(courtesyControlV1?.conversation || source.conversation || $json.conversation || '');
const courtesyAskedV1 = /\\b(tudo bem|td bem|tudo bom|td bom|tudo certo|como vai|como (?:voce|vc) (?:esta|ta))\\b/.test(courtesyClientTextV1);
const courtesyFirstNameV1 = (() => {
  const first = String(savedName || '').trim().split(/\\s+/)[0] || '';
  return /^[A-Za-zÀ-ÿ'-]{2,30}$/.test(first) ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
})();
const courtesyLineV1 = currentGreeting + (courtesyFirstNameV1 ? ', ' + courtesyFirstNameV1 : '') + '! '
  + (courtesyAskedV1 ? 'Tudo ótimo por aqui, e com você? 😊' : 'Tudo bem? 😊');
const courtesyLeadRegexV1 = new RegExp('^\\\\s*(?:(?:😊|👋|🙂|😀|😃|🤗)\\\\s*)?(?:ol[aá]|oi|bom dia|boa tarde|boa noite)'
  + (courtesyFirstNameV1 ? '(?:\\\\s*,?\\\\s*' + escapeGreetingRegex(courtesyFirstNameV1) + ')?' : '')
  + '\\\\s*[!,.]*\\\\s*(?:(?:😊|👋|🙂|😀|😃|🤗)\\\\s*)?(?:tudo bem\\\\??|tudo [oó]timo[^!?.]*[!?.]?)?\\\\s*(?:(?:😊|👋|🙂)\\\\s*)?', 'i');
const courtesyV1 = (items) => {
  if (!courtesyFirstReplyV1 || !Array.isArray(items) || !items.length) return items;
  const out = items.map((item) => ({ json: { ...item.json } }));
  const first = out[0];
  if (first.json.messageType === 'text') {
    const msg = String(first.json.message || '');
    const lead = msg.match(courtesyLeadRegexV1);
    if (lead && lead[0].trim()) {
      const rest = msg.slice(lead[0].length).replace(/^[\\s,!.]+/, '').trim();
      if (!rest) out.shift();
      else { const cap = rest.charAt(0).toUpperCase() + rest.slice(1); first.json.message = cap; first.json.caption = cap; }
    }
  }
  // toItem tira saudação quando o cliente não saudou; monta com marcador e põe a linha depois.
  const greeting = toItem('courtesy-v1', 0, out);
  greeting.json = { ...greeting.json, messageType: 'text', message: courtesyLineV1, caption: courtesyLineV1, mediaUrl: '' };
  for (const key of Object.keys(greeting.json)) { if (greeting.json[key] === 'courtesy-v1') greeting.json[key] = courtesyLineV1; }
  const rest = out.map((item) => ({ json: { ...item.json, replyToWaMessageId: '', replyToText: '' } }));
  return [greeting, ...rest].map((item, index, all) => ({ json: { ...item.json, messageIndex: index + 1, totalMessages: all.length } }));
};
`;

function patchDividir(code) {
  if (code.includes(MARK)) return code;
  let next = once(code,
    "\nif (Array.isArray($json.messages)) {",
    `${BLOCK}\nif (Array.isArray($json.messages)) {`,
    'inicio dos retornos');
  next = once(next, '  return finalizeItems(messages);', '  return courtesyV1(finalizeItems(messages));', 'retorno lista');
  next = once(next, 'return finalizeItems([...parts, ...suffix]);', 'return courtesyV1(finalizeItems([...parts, ...suffix]));', 'retorno texto');
  return next;
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((item) => item.name === NODE);
  if (!node?.parameters?.jsCode) throw new Error(`Code node ausente: ${NODE}`);
  node.parameters.jsCode = patchDividir(node.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODE, NODES, patchWorkflow, patchDividir };
