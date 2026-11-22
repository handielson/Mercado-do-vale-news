'use strict';

// burst-merge-v1: o cliente costuma mandar o pedido em 2 ou 3 mensagens seguidas ("Realme c71" / "Realme c72").
// Antes cada mensagem tinha a sua execução; a da primeira era descartada na hora de enviar (havia outra mais nova)
// e a segunda respondia só ao próprio texto ("Não encontrei esse modelo" + lista inteira de novo).
// Agora, no WhatsApp: espera 10 s, relê as mensagens do cliente e
//   - se chegou outra mensagem dele depois desta, encerra (a execução da mais nova responde tudo junto);
//   - se esta é a última, junta as mensagens seguidas dele (desde a nossa última resposta, até 3 min) numa só.
// A conferência antes de enviar (Controle Bot - Verificar mensagem atual) continua igual.
const MARK = 'burst-merge-v1';
const WAIT = 'Rajada - Aguardar 10s';
const FETCH = 'Rajada - Buscar mensagens';
const MERGE = 'Rajada - Juntar mensagens';
const FROM = 'Controle Bot - Pausa global?';
const TO = 'Controle Bot - Buscar Controle';
const APPLY = 'Controle Bot - Aplicar Controle';
const RESOLVER = 'Resolver Acao de Conversacao';
const ADDED = [WAIT, FETCH, MERGE];
const CHANGED = [APPLY, RESOLVER];
const WAIT_SECONDS = 10;

function once(text, search, replacement, label) {
  const count = text.split(search).length - 1;
  if (count !== 1) throw new Error(`${MARK}: trecho "${label}" encontrado ${count}x`);
  return text.replace(search, replacement);
}

const MERGE_CODE = `// ${MARK}: junta mensagens seguidas do cliente; se já chegou uma mais nova, esta execução para aqui.
const sourceV1 = $('Controle Bot - Verificar Cliente').first().json || {};
const ownIdV1 = String(sourceV1.messageId || sourceV1.id || sourceV1.key?.id || '').trim();
const rowsV1 = Array.isArray($json.rows) ? $json.rows : null;
const passV1 = (extra) => [{ json: { burstMergeV1: true, burstConversationV1: '', burstCountV1: 1, ...extra } }];
if (!rowsV1 || !ownIdV1) return passV1({ burstReasonV1: rowsV1 ? 'sem_id' : 'sem_historico' });
const atV1 = (row) => Date.parse(String(row?.created_at || '')) || 0;
const isInV1 = (row) => String(row?.direction || '') === 'inbound';
const textV1 = (row) => String(row?.message_text || '').trim();
const ownIndexV1 = rowsV1.findIndex((row) => isInV1(row) && String(row?.wa_message_id || '').trim() === ownIdV1);
if (ownIndexV1 < 0) return passV1({ burstReasonV1: 'propria_nao_encontrada' });
const ownRowV1 = rowsV1[ownIndexV1];
const newerV1 = rowsV1.slice(ownIndexV1 + 1).find((row) => isInV1(row) && textV1(row)
  && String(row?.wa_message_id || '').trim() !== ownIdV1 && atV1(row) - atV1(ownRowV1) <= 120000);
if (newerV1) return [];
let startV1 = ownIndexV1;
while (startV1 > 0) {
  const prev = rowsV1[startV1 - 1];
  if (!isInV1(prev) || atV1(ownRowV1) - atV1(prev) > 180000) break;
  startV1 -= 1;
}
const partsV1 = [];
for (const row of rowsV1.slice(startV1, ownIndexV1 + 1)) {
  const text = textV1(row);
  if (text && partsV1[partsV1.length - 1] !== text) partsV1.push(text);
}
if (partsV1.length <= 1) return passV1({ burstReasonV1: 'mensagem_unica' });
return passV1({ burstConversationV1: partsV1.join('\\n'), burstCountV1: partsV1.length, burstReasonV1: 'juntou' });
`;

const BURST_READ = (target) => `\n// ${MARK}: mensagens seguidas do cliente lidas juntas (nó ${MERGE}).
try { const burstV1 = $('${MERGE}').first().json || {}; if (burstV1.burstConversationV1) ${target} = { ...${target}, conversation: burstV1.burstConversationV1, burstCountV1: burstV1.burstCountV1 }; } catch (_) {}\n`;

function patchApply(code) {
  if (code.includes(MARK)) return code;
  let next = once(code, "const source = $('Controle Bot - Verificar Cliente').first().json || {};",
    "let source = $('Controle Bot - Verificar Cliente').first().json || {};" + BURST_READ('source'), 'source do Aplicar Controle');
  return next;
}

function patchResolver(code) {
  if (code.includes(MARK)) return code;
  return once(code, "const source = $('switc Mensagens').first().json || {};",
    "let source = $('switc Mensagens').first().json || {};" + BURST_READ('source'), 'source do Resolver');
}

function buildNodes(workflow) {
  const from = workflow.nodes.find((n) => n.name === FROM);
  const check = workflow.nodes.find((n) => n.name === 'Controle Bot - Verificar mensagem atual');
  if (!from || !check) throw new Error(`${MARK}: nós de referência ausentes`);
  const [x, y] = from.position || [0, 0];
  const fetch = JSON.parse(JSON.stringify(check));
  fetch.id = 'n8n-burst-merge-fetch-001';
  fetch.name = FETCH;
  fetch.position = [x + 160, y + 220];
  fetch.parameters.url = "={{'https://api.xiaomipetrolina.com.br/n8n-bot/messages?remoteJid=' + encodeURIComponent($('Controle Bot - Verificar Cliente').first().json.remoteJid) + '&limit=20&" + MARK + "=1'}}";
  return [
    { id: 'n8n-burst-merge-wait-001', name: WAIT, type: 'n8n-nodes-base.wait', typeVersion: 1.1, position: [x + 160, y + 80],
      webhookId: 'b0a7c6e2-5f41-4d8e-9a3b-6d1c2e9f0a01', parameters: { resume: 'timeInterval', amount: WAIT_SECONDS, unit: 'seconds' } },
    fetch,
    { id: 'n8n-burst-merge-code-001', name: MERGE, type: 'n8n-nodes-base.code', typeVersion: 2, position: [x + 320, y + 220],
      parameters: { jsCode: MERGE_CODE } },
  ];
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  if (next.nodes.some((n) => n.name === MERGE)) return next;
  const link = next.connections?.[FROM]?.main?.[1];
  if (!Array.isArray(link) || link.length !== 1 || link[0].node !== TO) throw new Error(`${MARK}: ligação ${FROM} -> ${TO} mudou`);
  next.nodes.push(...buildNodes(next));
  next.connections[FROM].main[1] = [{ node: WAIT, type: 'main', index: 0 }];
  next.connections[WAIT] = { main: [[{ node: FETCH, type: 'main', index: 0 }]] };
  next.connections[FETCH] = { main: [[{ node: MERGE, type: 'main', index: 0 }]] };
  next.connections[MERGE] = { main: [[{ node: TO, type: 'main', index: 0 }]] };
  for (const node of next.nodes) {
    if (node.name === APPLY) node.parameters.jsCode = patchApply(node.parameters.jsCode);
    if (node.name === RESOLVER) node.parameters.jsCode = patchResolver(node.parameters.jsCode);
  }
  return next;
}

// Confere que a única mudança de grafo é a inserção Pausa global? -> Aguardar -> Buscar -> Juntar -> Buscar Controle.
function assertExpectedGraph(before, after) {
  const expected = JSON.parse(JSON.stringify(before.connections));
  expected[FROM].main[1] = [{ node: WAIT, type: 'main', index: 0 }];
  expected[WAIT] = { main: [[{ node: FETCH, type: 'main', index: 0 }]] };
  expected[FETCH] = { main: [[{ node: MERGE, type: 'main', index: 0 }]] };
  expected[MERGE] = { main: [[{ node: TO, type: 'main', index: 0 }]] };
  if (JSON.stringify(expected) !== JSON.stringify(after.connections)) throw new Error(`${MARK}: grafo diferente do esperado`);
  const names = after.nodes.slice(before.nodes.length).map((n) => n.name);
  if (JSON.stringify(names) !== JSON.stringify(ADDED)) throw new Error(`${MARK}: nós novos inesperados: ${names}`);
}

module.exports = { MARK, WAIT, FETCH, MERGE, ADDED, CHANGED, WAIT_SECONDS, MERGE_CODE, patchWorkflow, patchApply, patchResolver, assertExpectedGraph };
