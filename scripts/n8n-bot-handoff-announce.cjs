'use strict';

// bot-handoff-announce-v1 — caso 557488559887 (24/11 15h39): a IA pediu atendente ("bot-handoff-request"),
// "Vendas - Persistir Handoff Especialista" gravou a pausa de 2 h, mas a escrita do estado da conversa foi
// recusada (revision_conflict → rebase → stale_or_duplicate_event, rajada de mensagens). O rebase apagava o aviso
// e o envio derrubava a resposta por haver mensagem mais nova: a conversa ficou pausada em silêncio e o print
// da PayJoy que chegou depois não teve resposta.
// Agora: se este run já gravou o handoff do bot, a recusa do estado não refaz a resposta (entrega o aviso) e o
// filtro de mensagem atual deixa o aviso sair — exceto se a equipe já respondeu (regra manual-handoff continua antes).
const assert = require('node:assert/strict');

const MARK = 'bot-handoff-announce-v1';
const RESTORE = 'Estado Conversa - Restaurar';
const CURRENT = 'Controle Bot - Aplicar mensagem atual';
const NODES = [RESTORE, CURRENT];

const once = (code, before, after) => {
  assert.equal(code.split(before).length, 2, `${MARK}: anchor drift`);
  return code.replace(before, () => after);
};

const R_ANCHOR = '  restorePersistedStateV1();\n  // whatsapp-payjoy-durable-image-v1: a rejected OCR result';
const R_BLOCK = `  restorePersistedStateV1();
  // ${MARK}: este run já gravou a pausa do handoff do bot; estado recusado não pode apagar o aviso ao cliente.
  if (prepared.productSpecialistHandoffRequested === true && String(prepared.specialistHandoffBy || '') === 'bot-handoff-request'
    && String(prepared.output || '').trim() && !control.blocked) {
    return [{ json: { ...prepared, conversationStateRebase: false, conversationStateRevision: revision,
      n8nBotControl: { ...(prepared.n8nBotControl || {}), ...control }, botHandoffAnnounceV1: true } }];
  }
  // whatsapp-payjoy-durable-image-v1: a rejected OCR result`;

const C_ANCHOR_DEF = 'return originals\n  .filter((item, index) => {';
const C_DEF = `// ${MARK}: run que gravou handoff do bot entrega o aviso mesmo com mensagem nova do cliente.
let botHandoffAnnounceV1 = false;
try { const handoffRunV1 = $('Vendas - Retomar Resposta Especialista'); botHandoffAnnounceV1 = Boolean(handoffRunV1.isExecuted)
  && String(handoffRunV1.first().json?.specialistHandoffBy || '') === 'bot-handoff-request'; } catch (_) {}
return originals
  .filter((item, index) => {`;
const C_ANCHOR_USE = "=== 'whatsapp-manual-handoff' && atV1(row) >= atV1(ownRowV1))) return false;\n";
const C_USE = C_ANCHOR_USE + `    if (botHandoffAnnounceV1) return true; // ${MARK}
`;

function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const restore = workflow.nodes.find((n) => n.name === RESTORE);
  const current = workflow.nodes.find((n) => n.name === CURRENT);
  assert.ok(restore?.parameters?.jsCode && current?.parameters?.jsCode, `${MARK}: nodes missing`);
  const applied = [restore, current].map((n) => n.parameters.jsCode.includes(MARK));
  if (applied[0] && applied[1]) return workflow;
  assert.ok(!applied[0] && !applied[1], `${MARK}: partially applied`);
  restore.parameters.jsCode = once(restore.parameters.jsCode, R_ANCHOR, R_BLOCK);
  current.parameters.jsCode = once(once(current.parameters.jsCode, C_ANCHOR_DEF, C_DEF), C_ANCHOR_USE, C_USE);
  return workflow;
}

module.exports = { MARK, NODE: RESTORE, NODES, patchWorkflow };
