'use strict';

// media-response-slim-v1 + recent-dup-v2 — conversa 558781242854 (26/11, 15h08–15h22).
// 1) A Evolution devolve no /message/sendMedia o arquivo inteiro em message.base64 (vídeo REAL0001-01: 10,6 MB).
//    O "Handoff - Registrar bot enviado" (Code) recebia isso no runner de JavaScript, que já estava lento; a
//    execução com vídeo foi de ~2,8 MB para ~14 MB e de 1–4 min para 8–12 min. Novo nó Set (roda no processo
//    principal, sem runner) entre "Enviar WhatsApp - Imagem" e o Handoff guarda só o id da mensagem enviada.
// 2) Com a demora, cada mensagem nova do cliente ("Aí não é o pro", "Quanto tem de ram"…) gerou outra lista
//    completa em paralelo, com respostas nossas no meio — a trava burst-dedupe-v1 (só rajada sem resposta no
//    meio) não pegava. Agora: mensagem igual (lista, indicação, foto/vídeo pela legenda) já enviada para o cliente
//    nos últimos 5 min não sai de novo; repetições do próprio plano continuam descontadas.
const MARK_SLIM = 'media-response-slim-v1';
const MARK_DUP = 'recent-dup-v2';
const SEND = 'Enviar WhatsApp - Imagem';
const HANDOFF = 'Handoff - Registrar bot enviado';
const SLIM = 'Envio - Resumir resposta mídia';
const APPLY = 'Controle Bot - Aplicar mensagem atual';
const ADDED = [SLIM];
const CHANGED = [APPLY];
const WINDOW_MS = 5 * 60 * 1000;

function once(text, search, replacement, label) {
  const count = text.split(search).length - 1;
  if (count !== 1) throw new Error(`${MARK_DUP}: trecho "${label}" encontrado ${count}x`);
  return text.replace(search, replacement);
}

const OLD_RULE_START = '  if (start === end) return false;\n  const delivered = rows.slice(end + 1).filter((row) => !isIn(row) && burstTextV1(row?.message_text) === text).length;';
const NEW_RULE = `  // ${MARK_DUP}: além da rajada, qualquer mensagem igual enviada a este cliente nos últimos 5 min conta.
  const nowV2 = Date.now();
  const recentSameV2 = rows.filter((row) => !isIn(row) && text.length >= 25 && burstTextV1(row?.message_text) === text
    && nowV2 - at(row) <= ${WINDOW_MS}).length;
  const burstSameV2 = start === end ? 0 : rows.slice(end + 1).filter((row) => !isIn(row) && burstTextV1(row?.message_text) === text).length;
  const delivered = Math.max(recentSameV2, burstSameV2);`;

function patchApply(code) {
  if (code.includes(MARK_DUP)) return code;
  if (!code.includes('burst-dedupe-v1')) throw new Error(`${MARK_DUP}: precisa do burst-dedupe-v1`);
  let next = once(code, OLD_RULE_START, NEW_RULE, 'regra da rajada');
  // A mensagem própria precisa estar na janela, mas a rajada não é mais obrigatória.
  next = once(next, '  if (ownIndex < 0) return false;\n', '  if (ownIndex < 0 && !rows.length) return false;\n', 'mensagem própria');
  next = once(next, '  let start = ownIndex, end = ownIndex;\n', '  let start = Math.max(ownIndex, 0), end = Math.max(ownIndex, 0);\n', 'início da rajada');
  next = once(next, '  while (start > 0 && isIn(rows[start - 1])', '  while (ownIndex >= 0 && start > 0 && isIn(rows[start - 1])', 'rajada para trás');
  next = once(next, '  while (end + 1 < rows.length && isIn(rows[end + 1])', '  while (ownIndex >= 0 && end + 1 < rows.length && isIn(rows[end + 1])', 'rajada para frente');
  return next;
}

function slimNode(workflow) {
  const send = workflow.nodes.find((n) => n.name === SEND);
  const [x, y] = send.position || [0, 0];
  return {
    id: 'n8n-media-response-slim-001', name: SLIM, type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [x + 100, y + 160],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      options: {},
      assignments: { assignments: [
        { id: 'slim-key', name: 'key', type: 'object',
          value: "={{ { id: String($json.key?.id || $json.message?.key?.id || $json.data?.key?.id || $json.response?.key?.id || $json.response?.message?.key?.id || $json.id || $json.messageId || ''), remoteJid: String($json.key?.remoteJid || ''), fromMe: true } }}" },
        { id: 'slim-status', name: 'status', type: 'string', value: "={{ String($json.status || '') }}" },
        { id: 'slim-mark', name: 'mediaResponseSlimV1', type: 'boolean', value: true },
      ] },
    },
  };
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  if (!next.nodes.some((n) => n.name === SLIM)) {
    const link = next.connections?.[SEND]?.main?.[0];
    if (!Array.isArray(link) || link.length !== 1 || link[0].node !== HANDOFF) throw new Error(`${MARK_SLIM}: ligação ${SEND} -> ${HANDOFF} mudou`);
    next.nodes.push(slimNode(next));
    next.connections[SEND].main[0] = [{ node: SLIM, type: 'main', index: 0 }];
    next.connections[SLIM] = { main: [[{ node: HANDOFF, type: 'main', index: 0 }]] };
  }
  for (const node of next.nodes) if (node.name === APPLY) node.parameters.jsCode = patchApply(node.parameters.jsCode);
  return next;
}

function assertExpectedGraph(before, after) {
  const expected = JSON.parse(JSON.stringify(before.connections));
  expected[SEND].main[0] = [{ node: SLIM, type: 'main', index: 0 }];
  expected[SLIM] = { main: [[{ node: HANDOFF, type: 'main', index: 0 }]] };
  if (JSON.stringify(expected) !== JSON.stringify(after.connections)) throw new Error(`${MARK_SLIM}: grafo diferente do esperado`);
  const names = after.nodes.slice(before.nodes.length).map((n) => n.name);
  if (JSON.stringify(names) !== JSON.stringify(ADDED)) throw new Error(`${MARK_SLIM}: nós novos inesperados: ${names}`);
}

module.exports = { MARK_SLIM, MARK_DUP, SEND, HANDOFF, SLIM, APPLY, ADDED, CHANGED, WINDOW_MS, patchApply, patchWorkflow, assertExpectedGraph };
