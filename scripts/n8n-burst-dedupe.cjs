'use strict';

// burst-dedupe-v1: lista de celulares saiu duas vezes intercalada (558781947703, 26/11 13h17).
// O cliente mandou "Quero receber a lista atualizada de celulares." e, 58 s depois, "Qual preço do celula".
// A execução da 1ª já tinha passado pela espera da rajada (burst-merge-v1) e seguiu enviando, porque a trava
// antes de enviar deixa uma lista em andamento continuar quando a mensagem nova é do mesmo assunto.
// A execução da 2ª juntou as duas mensagens e montou a mesma lista — e enviou tudo de novo.
// Agora, no envio (Controle Bot - Aplicar mensagem atual): se esta execução responde a uma rajada (mensagens
// seguidas do cliente sem resposta nossa no meio) e outra execução já enviou exatamente a mesma mensagem depois
// do início da rajada, esta mensagem não é enviada de novo. Repetições da própria execução (mesmo texto duas
// vezes no plano) são contadas para não serem confundidas com a outra execução.
// A conferência passa a ler 50 mensagens (antes 20: uma lista de 12 partes ×2 empurrava a mensagem do cliente
// para fora da janela).
const MARK = 'burst-dedupe-v1';
const APPLY = 'Controle Bot - Aplicar mensagem atual';
const CHECK = 'Controle Bot - Verificar mensagem atual';
const CHANGED = [CHECK, APPLY];

function once(text, search, replacement, label) {
  const count = text.split(search).length - 1;
  if (count !== 1) throw new Error(`${MARK}: trecho "${label}" encontrado ${count}x`);
  return text.replace(search, replacement);
}

const HELPER = `// ${MARK}: em rajada, não reenviar o que outra execução já entregou.
const burstTextV1 = (value) => String(value || '').replace(/\\[\\[BR\\]\\]/g, '\\n').replace(/\\s+/g, ' ').trim();
const burstPlanV1 = (() => { try { return $('Dividir mensagens').all().map((item) => item.json || {}); } catch (_) { return []; } })();
const burstAlreadyDeliveredV1 = (original, rows) => {
  const text = burstTextV1(original.message || original.caption || original.text || original.output);
  const ownId = String(original.inboundWaMessageId || '').trim();
  if (text.length < 8 || !ownId || !rows.length) return false;
  const isIn = (row) => String(row?.direction || '') === 'inbound';
  const at = (row) => Date.parse(row?.created_at || '') || 0;
  const ownIndex = rows.findIndex((row) => isIn(row) && String(row?.wa_message_id || '').trim() === ownId);
  if (ownIndex < 0) return false;
  // Rajada = mensagens do cliente em sequência, sem resposta nossa no meio, até 3 min uma da outra.
  let start = ownIndex, end = ownIndex;
  while (start > 0 && isIn(rows[start - 1]) && at(rows[start]) - at(rows[start - 1]) <= 180000) start -= 1;
  while (end + 1 < rows.length && isIn(rows[end + 1]) && at(rows[end + 1]) - at(rows[end]) <= 180000) end += 1;
  if (start === end) return false;
  const delivered = rows.slice(end + 1).filter((row) => !isIn(row) && burstTextV1(row?.message_text) === text).length;
  const index = Number(original.messageIndex) || 0;
  const ownEarlier = burstPlanV1.filter((item) => (Number(item.messageIndex) || 0) < index
    && burstTextV1(item.message || item.caption || item.text || item.output) === text).length;
  return delivered > ownEarlier;
};
`;

function patchApply(code) {
  if (code.includes(MARK)) return code;
  let next = once(code, 'return originals\n  .filter((item, index) => {', HELPER + 'return originals\n  .filter((item, index) => {', 'início do filtro');
  next = once(next,
    "    const rowsV344 = Array.isArray(checks[index]?.json?.rows) ? checks[index].json.rows : [];\n",
    "    const rowsV344 = Array.isArray(checks[index]?.json?.rows) ? checks[index].json.rows : [];\n"
      + `    if (burstAlreadyDeliveredV1(originalV344, rowsV344)) return false; // ${MARK}\n`,
    'rows da conferência');
  return next;
}

function patchCheckUrl(url) {
  if (url.includes(MARK)) return url;
  return once(url, "&limit=20&rapid-catalog-all-color-photos-v344=1", `&limit=50&rapid-catalog-all-color-photos-v344=1&${MARK}=1`, 'limit da conferência');
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  for (const node of next.nodes) {
    if (node.name === APPLY) node.parameters.jsCode = patchApply(node.parameters.jsCode);
    if (node.name === CHECK) node.parameters.url = patchCheckUrl(node.parameters.url);
  }
  return next;
}

function assertExpectedGraph(before, after) {
  if (JSON.stringify(before.connections) !== JSON.stringify(after.connections)) throw new Error(`${MARK}: ligações mudaram`);
  if (before.nodes.length !== after.nodes.length) throw new Error(`${MARK}: quantidade de nós mudou`);
}

module.exports = { MARK, APPLY, CHECK, CHANGED, ADDED: [], HELPER, patchApply, patchCheckUrl, patchWorkflow, assertExpectedGraph };
