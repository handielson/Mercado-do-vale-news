'use strict';

// payjoy-link-delivered-v1: o estado "awaiting_result" (link da PayJoy enviado) só vale se o link saiu de verdade.
// Caso 554796265029 (21/11 14h15): "Sim" montou o link e gravou awaiting_result, mas a resposta foi descartada no envio
// porque o cliente mandou "Envia aí". A execução do "Envia aí" (conflito de revisão) herdou awaiting_result,
// foi para a IA, que disse "não tenho o link disponível"; depois o robô pediu print de uma análise que o cliente nem fez.
// Agora: sem mensagem nossa com o link da PayJoy no histórico, awaiting_result recente volta para awaiting_link_confirmation
// e o ramo de política reenvia o link quando o cliente aceita.
const MARK = 'payjoy-link-delivered-v1';
const APPLY = 'Controle Bot - Aplicar Controle';
const RESTORE = 'Estado Conversa - Restaurar';
const DIVIDIR = 'Dividir mensagens';
const NODES = [APPLY, RESTORE, DIVIDIR];
// Junto no mesmo deploy (greeting-name-v1): nome salvo grudado ("Danielmoraismorais") não entra na saudação;
// primeiro nome com até 12 letras, senão só "Boa tarde! Tudo bem? 😊".
const NAME_MARK = 'greeting-name-v1';

function once(text, search, replacement, label) {
  const count = text.split(search).length - 1;
  if (count !== 1) throw new Error(`${MARK}: trecho "${label}" encontrado ${count}x`);
  return text.replace(search, replacement);
}

const GUARD = `
// ${MARK}: awaiting_result recente sem o link da PayJoy no histórico = link não entregue (resposta descartada no envio).
const payjoyLinkDeliveredGuardV1 = (jid, messages) => {
  const map = $getWorkflowStaticData('global').payjoyByJid || {};
  const st = map[jid];
  if (!jid || !st || st.status !== 'awaiting_result' || st.awaiting || st.approvedAmountCents != null) return false;
  if (Date.now() - Number(st.updatedAt || 0) > 2 * 60 * 60 * 1000) return false;
  const list = Array.isArray(messages) ? messages : [];
  const sent = list.some((m) => String(m?.direction || '') === 'outbound' && /payjoy\\.com/i.test(String(m?.text ?? m?.message_text ?? '')));
  if (sent) return false;
  map[jid] = { ...st, status: 'awaiting_link_confirmation', linkNotDeliveredV1: true };
  return true;
};
`;

function patchApply(code) {
  if (code.includes(MARK)) return code;
  let next = once(code, '\n// meta-payjoy-images-continuity-v1: Meta state is authoritative even for a first revision or reset.',
    `${GUARD}\n// meta-payjoy-images-continuity-v1: Meta state is authoritative even for a first revision or reset.`, 'antes do bloco payjoy');
  next = once(next, ' else delete staticData.payjoyByJid[remoteJid];\n}',
    ' else delete staticData.payjoyByJid[remoteJid];\n baseOutput.payjoyLinkNotDeliveredV1 = payjoyLinkDeliveredGuardV1(remoteJid, baseOutput.recentMessages);\n}', 'fim do bloco payjoy');
  return next;
}

const ACK = String.raw`/^(?:(?:bom dia|boa tarde|boa noite|oi+|ola|opa|e ai|blz|beleza|ok|okay|certo|ta|ta bom|ta certo|tudo bem|sim|show|valeu|obrigad[oa]|aguardo|pode ser|isso)[\s!.,?]*)+$/`;

function patchRestore(code) {
  if (code.includes(MARK)) return code;
  let next = once(code, '\nconst restorePersistedStateV1 = () => {', `${GUARD}\nconst restorePersistedStateV1 = () => {`, 'antes do restore');
  next = once(next, "  if (write.reason !== 'revision_conflict' || retryCount >= 2 || !prepared.conversation) return [];\n",
    "  if (write.reason !== 'revision_conflict' || retryCount >= 2 || !prepared.conversation) return [];\n"
    + `  // ${MARK}: a execução concorrente era de mensagem mais antiga; se esta não é só "ok/sim", a resposta dela é descartada no envio.\n`
    + `  if (!${ACK}.test(String(prepared.conversation || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim()))\n`
    + '    payjoyLinkDeliveredGuardV1(remoteJid, prepared.recentMessages);\n', 'replay');
  return next;
}

function patchDividir(code) {
  if (code.includes(NAME_MARK)) return code;
  return once(code, "return /^[A-Za-zÀ-ÿ'-]{2,30}$/.test(first)", "return /^[A-Za-zÀ-ÿ'-]{2,12}$/.test(first) /* " + NAME_MARK + " */", 'nome da saudação');
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  for (const node of next.nodes) {
    if (node.name === APPLY) node.parameters.jsCode = patchApply(node.parameters.jsCode);
    if (node.name === RESTORE) node.parameters.jsCode = patchRestore(node.parameters.jsCode);
    if (node.name === DIVIDIR && node.parameters.jsCode.includes('greeting-courtesy-v1')) node.parameters.jsCode = patchDividir(node.parameters.jsCode);
  }
  return next;
}

module.exports = { MARK, NAME_MARK, NODES, patchWorkflow, patchApply, patchRestore, patchDividir };
