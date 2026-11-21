'use strict';
// Correções do bot (21/11/2026, conversas do Eder 74 9113-2322 e do Marcelo 87 98809-9550):
// 1. fetch não existe no executor de código do n8n 2.x (task runner): toda consulta à API caía no catch. Troca por um fetch
//    feito com helpers.httpRequest nos três nós que consultam a API (garantia, horário da loja, contexto de vendas).
// 2. O bot respondia depois que a equipe assumia a conversa: antes de enviar, se houver mensagem manual da equipe depois da
//    pergunta do cliente, a resposta do bot não sai.
// 3. Lista de celulares descartada quando o cliente manda só "bom dia"/"blz" enquanto ela é montada: cumprimento ou
//    confirmação não derruba a lista (nem no envio nem na gravação do estado).
// 4. O agente geral prometia "vou atualizar e já envio a lista" sem enviar: nunca prometer envio futuro.
const assert = require('node:assert/strict');
const MARK = 'bot-correcoes-handoff-lista-v1';
const FETCH_NODES = ['Vendas - Verificar Pos Lista', 'Vendas - Preparar Contexto IA', 'Loja - Horario Atendimento'];
const SEND = 'Controle Bot - Aplicar mensagem atual';
const RESTORE = 'Estado Conversa - Restaurar';
const AGENT = 'Agente Geral - Atendimento';
const NODES = [...FETCH_NODES, SEND, RESTORE, AGENT];

function once(code, anchor, replacement) {
  assert.equal(code.split(anchor).length - 1, 1, 'Âncora do n8n alterada: ' + anchor.slice(0, 85));
  return code.replace(anchor, () => replacement);
}

// fetch mínimo (ok, status, json, text) em cima do helpers.httpRequest do n8n.
const FETCH_SHIM = `// ${MARK}:fetch — o executor de código do n8n não tem fetch; sem ele, usa helpers.httpRequest.
const mdvFetchV1 = typeof fetch === 'function' ? fetch : async (url, init = {}) => {
  const res = await helpers.httpRequest({ url: String(url), method: init.method || 'GET', headers: init.headers || {},
    ...(init.body !== undefined ? { body: init.body } : {}), returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 15000 });
  const raw = res && Object.prototype.hasOwnProperty.call(res, 'body') ? res.body : res;
  const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString('utf8') : JSON.stringify(raw ?? null);
  const status = Number(res?.statusCode || 0);
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => (typeof raw === 'string' || Buffer.isBuffer(raw) ? JSON.parse(text) : raw) };
};
`;

// Cumprimento ou confirmação curta, sem pedido novo.
const ACK_RE = String.raw`/^(?:(?:bom dia|boa tarde|boa noite|oi+|ola|opa|e ai|blz|beleza|ok|okay|certo|ta|ta bom|ta certo|tudo bem|sim|show|valeu|obrigad[oa]|aguardo|pode ser|isso)[\s!.,?]*)+$/`;

function patchWorkflow(workflow) {
  const out = JSON.parse(JSON.stringify(workflow));
  const node = name => { const n = out.nodes.find(x => x.name === name); assert.ok(n, 'Nó não encontrado: ' + name); return n; };
  if (JSON.stringify(out.nodes).includes(MARK)) return out; // já aplicado

  for (const name of FETCH_NODES) {
    const n = node(name);
    assert.ok(/\bawait fetch\(/.test(n.parameters.jsCode), 'Nó sem fetch: ' + name);
    assert.ok(!/(?:const|let|var|function)\s+fetch\b/.test(n.parameters.jsCode), 'fetch já declarado: ' + name);
    n.parameters.jsCode = FETCH_SHIM + n.parameters.jsCode.replace(/\bawait fetch\(/g, 'await mdvFetchV1(');
    assert.ok(!/\bfetch\(/.test(n.parameters.jsCode.slice(FETCH_SHIM.length)), 'fetch solto em ' + name);
  }

  const send = node(SEND);
  send.parameters.jsCode = once(send.parameters.jsCode,
    "    if (ownRowV1 && emojiOnlyV1(ownRowV1.message_text)) {",
    `    // ${MARK}:handoff — a equipe respondeu depois da pergunta do cliente: o bot não fala por cima.
    if (ownRowV1 && rowsV344.some((row) => String(row?.source_node || '') === 'whatsapp-manual-handoff' && atV1(row) >= atV1(ownRowV1))) return false;
    if (ownRowV1 && emojiOnlyV1(ownRowV1.message_text)) {`);
  send.parameters.jsCode = once(send.parameters.jsCode,
    "    if (!latestInboundV344 || !originalMessageIdV344 || !latestMessageIdV344 || originalMessageIdV344 === latestMessageIdV344) return true;",
    `    if (!latestInboundV344 || !originalMessageIdV344 || !latestMessageIdV344 || originalMessageIdV344 === latestMessageIdV344) return true;
    // ${MARK}:ack — "bom dia", "blz", "ok" depois do pedido não derrubam a resposta do pedido.
    if (${ACK_RE}.test(normalizeV344(latestInboundV344.message_text).trim())) return true;`);

  const restore = node(RESTORE);
  restore.parameters.jsCode = once(restore.parameters.jsCode,
    "  if (write.reason !== 'revision_conflict' || retryCount >= 2 || !prepared.conversation) return [];",
    `  // ${MARK}:catalog — lista de celulares montada enquanto chegava outra mensagem (evento mais novo, não repetido):
  // entrega a lista mesmo assim; o envio ainda passa pela checagem de mensagem atual (cumprimento/confirmação deixam passar).
  const catalogV1 = String(prepared.conversationAction || '') === 'listar_catalogo' || Boolean(prepared.deterministicCatalogOutput);
  if (write.reason === 'stale_or_duplicate_event' && catalogV1 && String(prepared.output || '').trim()
    && Number(write.currentEventVersion || 0) > Number(prepared.conversationEventVersion || 0)
    && !control.blocked && !control.human_handoff_active && !prepared.humanHandoffPaused) {
    return [{ json: { ...prepared, conversationStateRebase: false, conversationStateRevision: revision,
      n8nBotControl: { ...(prepared.n8nBotControl || {}), ...control }, catalogDeliveredAfterStaleV1: true } }];
  }
  if (write.reason !== 'revision_conflict' || retryCount >= 2 || !prepared.conversation) return [];`);

  const agent = node(AGENT);
  agent.parameters.options.systemMessage = once(agent.parameters.options.systemMessage,
    '- Se for preparar uma lista, avise brevemente que vai atualizar as opcoes e enviar em seguida.',
    `- Nunca prometa enviar algo depois ("ja envio", "vou enviar a lista", "vou atualizar e mando"): voce nao envia nada depois desta resposta. Se o cliente so cumprimentou ou confirmou (bom dia, blz, ok), responda curto e pergunte como pode ajudar. (${MARK})`);
  return out;
}

module.exports = { patchWorkflow, NODES, MARK, FETCH_SHIM };
