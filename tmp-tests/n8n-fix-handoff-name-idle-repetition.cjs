const vm = require('node:vm');
const { Client } = require('ssh2');
require('dotenv').config({ path: 'C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.env.vps.local', quiet: true });
require('dotenv').config({ path: 'C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.env.local', quiet: true });
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const DRY_RUN = process.argv.includes('--dry-run');

function shQuote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}
function runRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}
function psql(conn, db, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
      if (error) return reject(error);
      let stdout = ''; let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
      stream.end(sql);
    });
  });
}
async function waitService(conn, service, expected, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await runRemote(conn, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}
function findNode(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  if (!node) throw new Error(`${name} not found`);
  return node;
}
function upsertNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}

function patchContactPrepare(code) {
  let next = String(code || '');
  if (!next.includes('invalidOptionalNameRepliesV135')) {
    const oldLine = `const looksLikeName = /^[A-Za-zÀ-ÿ]+(?:\\s+[A-Za-zÀ-ÿ]+){0,3}$/.test(text) && text.length >= 2 && text.length <= 60 && !greetingOnly && !productOrIntent;`;
    const replacement = `const invalidOptionalNameRepliesV135 = new Set([
  'aguardando', 'esperando', 'ok', 'okay', 'certo', 'isso', 'sim', 'nao', 'não',
  'fechar', 'fechar pedido', 'fechar compra', 'pedido', 'compra', 'pode ser', 'obrigado', 'obrigada', 'valeu'
]);
const looksLikeName = /^[A-Za-zÀ-ÿ]+(?:\\s+[A-Za-zÀ-ÿ]+){0,3}$/.test(text)
  && text.length >= 2 && text.length <= 60 && !greetingOnly && !productOrIntent
  && !invalidOptionalNameRepliesV135.has(normalized);`;
    if (!next.includes(oldLine)) throw new Error('Contact-name marker not found');
    next = next.replace(oldLine, replacement);
    const invitationLine = `const invitationActive = Boolean(invitation.invitedAt && Number(invitation.expiresAt || 0) > Date.now());`;
    next = next.replace(invitationLine, `${invitationLine}
if (invitationActive && !looksLikeName) delete staticData.optionalCustomerName[remoteJid];`);
  }
  new Function(next);
  return next;
}

function patchSplitter(code) {
  let next = String(code || '');
  next = next.replace('expiresAt: Date.now() + 24 * 60 * 60 * 1000', 'expiresAt: Date.now() + 10 * 60 * 1000');
  if (!next.includes('botRequestsHumanV135')) {
    const oldLine = `const shouldInviteName = !customerEndsConversation && !alreadyInvitedInHistory && Boolean(remoteJid) && !savedName && !prepared.possibleName && !staticData.optionalCustomerName[remoteJid];`;
    const replacement = `const botRequestsHumanV135 = /vou chamar um atendente|atendente para continuar/i.test(String(text || ''));
const shouldInviteName = !customerEndsConversation && !botRequestsHumanV135 && !alreadyInvitedInHistory && Boolean(remoteJid) && !savedName && !prepared.possibleName && !staticData.optionalCustomerName[remoteJid];`;
    if (!next.includes(oldLine)) throw new Error('Splitter invitation marker not found');
    next = next.replace(oldLine, replacement);
  }
  new Function(next);
  return next;
}

function patchResolver(code) {
  let next = String(code || '');
  if (!next.includes('deterministicServiceDecisionV135')) {
    const marker = `const normalizedStoreLocationV129 = normalize(text);`;
    const block = `const normalizedServiceTextV135 = normalize(text);
const recentServiceContextV135 = normalize(String(source.conversationHistory || '').slice(-1200));
const deliveryScheduleIntentV135 = /\\b(entrega|entregar|receber|retirada)\\b/.test(normalizedServiceTextV135)
  && /\\b(hora|horario|hoje|amanha|cartao|fechar|pode)\\b/.test(normalizedServiceTextV135);
const paymentSimulationIntentV135 = /\\b(simulacao|simular|entrada|restante)\\b/.test(normalizedServiceTextV135)
  && /\\b(parcela|parcelado|cartao|credito|12x|10x|6x|valor|quanto)\\b/.test(normalizedServiceTextV135 + ' ' + recentServiceContextV135);
const shortConfirmationV135 = /^(pode ser|isso|sim|ok|certo|fechado)$/.test(normalizedServiceTextV135);
const recentDeliveryContextV135 = /\\b(entrega|entregar|receber|retirada)\\b/.test(recentServiceContextV135.slice(-700));
const deterministicServiceDecisionV135 = deliveryScheduleIntentV135 || (shortConfirmationV135 && recentDeliveryContextV135)
  ? { acao: 'chamar_atendente', intencao: 'confirmacao_entrega', confianca: 1, motivo: 'Confirmacao de horario ou entrega precisa de atendente.' }
  : (paymentSimulationIntentV135
    ? { acao: 'perguntar_esclarecimento', intencao: 'simulacao_pagamento', confianca: 1, motivo: 'Simulacao exige confirmar produto e valor antes de calcular.' }
    : null);

${marker}`;
    if (!next.includes(marker)) throw new Error('Resolver service marker not found');
    next = next.replace(marker, block);
    const oldDecision = `const decision = deterministicStoreLocationV129 || (parsed && allowedActions.has(String(parsed.acao || '')) ? parsed : (legacy || fallbackDecision()));`;
    const newDecision = `const decision = deterministicStoreLocationV129 || deterministicServiceDecisionV135 || (parsed && allowedActions.has(String(parsed.acao || '')) ? parsed : (legacy || fallbackDecision()));`;
    if (!next.includes(oldDecision)) throw new Error('Resolver decision marker not found');
    next = next.replace(oldDecision, newDecision);
  }
  new Function(next);
  return next;
}

function ensureRequestedHandoffPause(nodes, connections) {
  upsertNode(nodes, {
    id: 'handoff-request-persist-v135', name: 'Handoff - Persistir solicitado',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [2770, 190],
    onError: 'continueRegularOutput', continueOnFail: true, retryOnFail: true, maxTries: 2, waitBetweenTries: 500,
    parameters: {
      method: 'POST', url: 'https://api.xiaomipetrolina.com.br/n8n-bot/client-control/handoff',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'x-sync-key', value: '={{$env.SYNC_SECRET}}' }] },
      sendBody: true,
      bodyParameters: { parameters: [
        { name: 'remoteJid', value: '={{$("Atendente - Horario").first().json.remoteJid}}' },
        { name: 'handoffBy', value: 'bot-handoff-request' },
        { name: 'durationSeconds', value: 7200 },
      ] },
      options: {},
    },
  });
  const restoreCode = `const source = $('Atendente - Horario').first().json || {};
return [{ json: { ...source, humanHandoffPaused: true, handoffRequested: true } }];`;
  upsertNode(nodes, {
    id: 'handoff-request-restore-v135', name: 'Handoff - Retomar resposta solicitada',
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [2970, 190], parameters: { jsCode: restoreCode },
  });
  new Function(restoreCode);
  connections['Atendente - Horario'] = { main: [[{ node: 'Handoff - Persistir solicitado', type: 'main', index: 0 }]] };
  connections['Handoff - Persistir solicitado'] = { main: [[{ node: 'Handoff - Retomar resposta solicitada', type: 'main', index: 0 }]] };
  connections['Handoff - Retomar resposta solicitada'] = { main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]] };
}

function patchWorkflow(nodes, connections) {
  findNode(nodes, 'Contato - Preparar').parameters.jsCode = patchContactPrepare(findNode(nodes, 'Contato - Preparar').parameters.jsCode);
  findNode(nodes, 'Dividir mensagens').parameters.jsCode = patchSplitter(findNode(nodes, 'Dividir mensagens').parameters.jsCode);
  findNode(nodes, 'Resolver Acao de Conversacao').parameters.jsCode = patchResolver(findNode(nodes, 'Resolver Acao de Conversacao').parameters.jsCode);
  ensureRequestedHandoffPause(nodes, connections);
  for (const node of nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
    if (node.parameters?.jsCode) new Function(node.parameters.jsCode);
  }
}

function validateScenarios(nodes) {
  const prepareCode = findNode(nodes, 'Contato - Preparar').parameters.jsCode;
  const resolverCode = findNode(nodes, 'Resolver Acao de Conversacao').parameters.jsCode;
  const runPrepare = (conversation) => {
    const state = { optionalCustomerName: { '559999999999@s.whatsapp.net': { invitedAt: new Date().toISOString(), expiresAt: Date.now() + 600000 } } };
    const result = vm.runInNewContext(`(function(){${prepareCode}})()`, {
      $json: { conversation, remoteJid: '559999999999@s.whatsapp.net' },
      $getWorkflowStaticData: () => state, Date,
    })[0].json;
    return { possibleName: result.possibleName, possibleCustomerName: result.possibleCustomerName, invitationRemains: Boolean(state.optionalCustomerName['559999999999@s.whatsapp.net']) };
  };
  const runResolver = (conversation, conversationHistory, intencao = 'formas_pagamento') => vm.runInNewContext(`(function(){${resolverCode}})()`, {
    $json: { conversation, intencao, output: '', remoteJid: '559999999999@s.whatsapp.net' },
    $: () => ({ first: () => ({ json: { conversation, conversationHistory, remoteJid: '559999999999@s.whatsapp.net' } }) }),
    $getWorkflowStaticData: () => ({}), Date,
  })[0].json.conversationAction;
  return {
    awaitingName: runPrepare('Aguardando'),
    validName: runPrepare('Ana'),
    commercialReply: runPrepare('Fechar pedido'),
    paymentSimulationAction: runResolver('Com 200 reais de entrada, quanto fica em 12x?', ''),
    deliveryScheduleAction: runResolver('Pode entregar 18:30 para eu passar o cartao?', ''),
    contextualConfirmationAction: runResolver('Pode ser?!', 'Cliente: Pode entregar hoje as 18:30?'),
  };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('n8n Postgres container not found');
    const raw = await psql(conn, db, `COPY (SELECT json_build_object(
      'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
      'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
      'activeVersionId', "activeVersionId")::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes, connections);
    const scenarios = validateScenarios(nodes);
    if (DRY_RUN) return console.log(JSON.stringify({ dryRun: true, scenarios, codeCompiles: true }, null, 2));

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null'); await waitService(conn, 'n8n_n8n', 0); servicesStopped = true;
    const sql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, connections=${dollar(JSON.stringify(connections), 'connections')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'hnodes')}::json, connections=${dollar(JSON.stringify(connections), 'hconnections')}::json, "updatedAt"=NOW() WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(entity.activeVersionId)};
COPY (SELECT json_build_object(
  'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
  'invalidNameGuard', we.nodes::text LIKE '%invalidOptionalNameRepliesV135%',
  'handoffInvitationGuard', we.nodes::text LIKE '%botRequestsHumanV135%',
  'deterministicServiceDecision', we.nodes::text LIKE '%deterministicServiceDecisionV135%',
  'requestedHandoffPause', we.connections::text LIKE '%Handoff - Persistir solicitado%'
)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());
    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 1); servicesStopped = false;
    console.log(JSON.stringify({ ...result, scenarios }, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = { patchContactPrepare, patchSplitter, patchResolver, ensureRequestedHandoffPause, patchWorkflow, validateScenarios };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
