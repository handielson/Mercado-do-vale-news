const path = require('path');

const workspace = path.resolve(__dirname, '..');
try {
  require('dotenv').config({ path: path.join(workspace, '.env.vps.local') });
  require('dotenv').config({ path: path.join(workspace, '.env.local') });
} catch {}
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const API_URL = 'https://api.xiaomipetrolina.com.br';

function shQuote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}
function runRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}
function psql(conn, db, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
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
  if (!node) throw new Error(`Node not found: ${name}`);
  return node;
}
function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Anchor not found: ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Anchor duplicated: ${label}`);
  return source.replace(search, replacement);
}
function upsertNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}
function ensureMain(connections, name, output = 0) {
  connections[name] = connections[name] || { main: [] };
  connections[name].main = connections[name].main || [];
  connections[name].main[output] = connections[name].main[output] || [];
  return connections[name].main[output];
}
function replaceTarget(connections, from, oldTarget, newTarget, output = 0) {
  const list = ensureMain(connections, from, output);
  const index = list.findIndex((item) => item.node === oldTarget);
  if (index < 0) throw new Error(`Connection not found: ${from} -> ${oldTarget}`);
  list[index] = { ...list[index], node: newTarget };
}
function addTarget(connections, from, target, output = 0) {
  const list = ensureMain(connections, from, output);
  if (!list.some((item) => item.node === target)) list.push({ node: target, type: 'main', index: 0 });
}
function makeHttpNode({ id, name, position, url, bodyParameters }) {
  return {
    id, name, position, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      method: 'POST', url, sendHeaders: true,
      headerParameters: { parameters: [{ name: 'x-sync-key', value: '={{$env.SYNC_SECRET}}' }] },
      sendBody: true, bodyParameters: { parameters: bodyParameters }, options: {},
    },
  };
}

function patchPrepareSearch(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('sales-preferences-merge-v288:start')) return;
  const anchor = `const classifiedRequestKind = String(source.salesRequestKind || '').trim();`;
  const insertion = `${anchor}
// sales-preferences-merge-v288:start
const persistedSalesFiltersV288 = source.n8nBotControl?.sales_preferences?.constraints && typeof source.n8nBotControl.sales_preferences.constraints === 'object'
  ? source.n8nBotControl.sales_preferences.constraints : {};
const previousSalesFiltersV288 = {
  ...persistedSalesFiltersV288,
  ...(source.salesConversationState?.filtros && typeof source.salesConversationState.filtros === 'object' ? source.salesConversationState.filtros : {}),
};
const salesFilterPatchV288 = {};
const rawFilterTextV288 = String(source.conversation || source.classificacaoMensagem || '');
const normalizedFilterTextV288 = normalize(rawFilterTextV288);
const parseMoneyCentsV288 = (value) => {
  const clean = String(value || '').replace(/\\s/g, '').replace(/\\.(?=\\d{3}(?:\\D|$))/g, '').replace(',', '.');
  const parsed = Number(clean.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
};
const priceContextV288 = /\\b(?:ate|maximo|limite|orcamento|investir|gastar|faixa|valor|preco)\\b|r\\$/i.test(rawFilterTextV288);
const bareBudgetContinuationV288 = /^\\s*(?:r\\$\\s*)?\\d{2,6}(?:[.,]\\d{1,2})?\\s*$/i.test(rawFilterTextV288)
  && Boolean(source.n8nBotControl?.sales_preferences?.active || previousSalesFiltersV288.cameraQuality || previousSalesFiltersV288.cameraPriority || previousSalesFiltersV288.screenQuality || previousSalesFiltersV288.screenPriority || previousSalesFiltersV288.nfc || previousSalesFiltersV288.ramGb?.length || previousSalesFiltersV288.storageGb?.length);
if (priceContextV288 || bareBudgetContinuationV288) {
  const moneyMatch = rawFilterTextV288.match(/(?:r\\$\\s*)?(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{1,2})?|\\d{2,6}(?:[.,]\\d{1,2})?)/i);
  const cents = parseMoneyCentsV288(moneyMatch?.[1] || '');
  if (cents) salesFilterPatchV288.maxPriceCents = cents;
}
if (/\\b(?:camera boa|boa camera|melhor camera|foco (?:na|em) camera|prioridade (?:na|em) camera)\\b/.test(normalizedFilterTextV288)) salesFilterPatchV288.cameraPriority = true;
if (/\\b(?:nao precisa|sem prioridade em|dispenso) camera\\b/.test(normalizedFilterTextV288)) salesFilterPatchV288.cameraPriority = false;
const cameraMpxMatchV288 = normalizedFilterTextV288.match(/\\bcamera\\D{0,20}(\\d{1,3})\\s*(?:mp|mpx|megapixels?)\\b/);
if (cameraMpxMatchV288) salesFilterPatchV288.cameraMinMpx = Number(cameraMpxMatchV288[1]);
if (/\\b(?:tela boa|boa tela|melhor tela|foco (?:na|em) tela|prioridade (?:na|em) tela)\\b/.test(normalizedFilterTextV288)) salesFilterPatchV288.screenPriority = true;
if (/\\b(?:nao precisa|sem prioridade em|dispenso) tela\\b/.test(normalizedFilterTextV288)) salesFilterPatchV288.screenPriority = false;
const screenTypeMatchV288 = normalizedFilterTextV288.match(/\\b(amoled|oled|ips|lcd)\\b/);
if (screenTypeMatchV288) salesFilterPatchV288.screenType = screenTypeMatchV288[1];
const refreshMatchV288 = normalizedFilterTextV288.match(/\\b(60|90|120|144)\\s*hz\\b/);
if (refreshMatchV288) salesFilterPatchV288.screenMinHz = Number(refreshMatchV288[1]);
if (/\\bsem limite(?: de preco)?\\b/.test(normalizedFilterTextV288)) salesFilterPatchV288.maxPriceCents = 0;
const mergedSalesFiltersV288 = { ...previousSalesFiltersV288, ...salesFilterPatchV288 };
// sales-preferences-merge-v288:end`;
  code = replaceOnce(code, anchor, insertion, 'prepare search preference insertion');

  code = code.replace(
    `const requestedRamGb = phoneMemoryFiltersV155.requestedRamGb;`,
    `const requestedRamGb = phoneMemoryFiltersV155.requestedRamGb.length ? phoneMemoryFiltersV155.requestedRamGb : (Array.isArray(mergedSalesFiltersV288.ramGb) ? mergedSalesFiltersV288.ramGb.map(Number).filter(v => v > 0) : []);`
  );
  code = code.replace(
    `const requestedStorageGb = phoneMemoryFiltersV155.requestedStorageGb;`,
    `const requestedStorageGb = phoneMemoryFiltersV155.requestedStorageGb.length ? phoneMemoryFiltersV155.requestedStorageGb : (Array.isArray(mergedSalesFiltersV288.storageGb) ? mergedSalesFiltersV288.storageGb.map(Number).filter(v => v > 0) : []);`
  );
  code = code.replace(
    `const requestedNfcV228 = String(source.requestedNfc || source.salesNfcFilter || '').toLowerCase() === 'sim' ? 'sim' : '';`,
    `const requestedNfcV228 = String(source.requestedNfc || source.salesNfcFilter || mergedSalesFiltersV288.nfc || '').toLowerCase() === 'sim' ? 'sim' : '';`
  );
  const returnAnchor = `  productSearchTerm,`;
  code = replaceOnce(code, returnAnchor, `${returnAnchor}
  salesFilters: mergedSalesFiltersV288,
  maxPriceCents: Number(mergedSalesFiltersV288.maxPriceCents || 0),
  cameraPriority: mergedSalesFiltersV288.cameraPriority === true || mergedSalesFiltersV288.cameraQuality === 'good',
  cameraMinMpx: Number(mergedSalesFiltersV288.cameraMinMpx || mergedSalesFiltersV288.cameraMinMp || 0),
  screenPriority: mergedSalesFiltersV288.screenPriority === true || mergedSalesFiltersV288.screenQuality === 'good',
  screenType: String(mergedSalesFiltersV288.screenType || ''),
  screenMinHz: Number(mergedSalesFiltersV288.screenMinHz || mergedSalesFiltersV288.refreshRateMinHz || 0),`, 'prepare search return');
  new Function(code);
  node.parameters.jsCode = code;
}

function patchPostList(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('sales-preference-continuation-v288')) return;
  const anchor = `if (aiAction === 'nova_busca') {`;
  const insertion = `// sales-preference-continuation-v288
const previousFiltersV288 = activeState?.filters && typeof activeState.filters === 'object' ? activeState.filters : {};
const bareBudgetV288 = /^\\s*(?:r\\$\\s*)?\\d{2,6}(?:[.,]\\d{1,2})?\\s*$/i.test(text)
  && Boolean(previousFiltersV288.cameraPriority || previousFiltersV288.screenPriority || previousFiltersV288.nfc || previousFiltersV288.ramGb?.length || previousFiltersV288.storageGb?.length);
const explicitPreferenceV288 = /\\b(?:camera|tela|display|amoled|oled|ips|lcd|nfc|aproximacao|ram|armazenamento|memoria|ate|maximo|limite|orcamento|investir|gastar|faixa)\\b/.test(normalized);
if (activeState?.flow === 'sales_post_list' && (bareBudgetV288 || explicitPreferenceV288)) {
  return [{ json: {
    ...source,
    intencao: 'vendas_produtos',
    salesPostListHandled: false,
    salesRequestKind: 'categoria',
    salesCategoryId: activeState.categoryId || '8b7c4852-c195-4527-8fd7-c3cc2debda42',
    salesCategoryName: 'smartphones',
    salesSearchQuery: '',
    forceSalesPreferenceSearchV288: true,
  } }];
}

${anchor}`;
  code = replaceOnce(code, anchor, insertion, 'post-list preference continuation');
  new Function(code);
  node.parameters.jsCode = code;
}

function patchProductContext(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('structured-sales-filters-v288:start')) return;
  const anchorMatch = code.match(/const featureFilteredRowsV228\s*=\s*phoneNfcFilterRequestV228[\s\S]*?:\s*memoryFilteredRowsV155;/);
  if (!anchorMatch) throw new Error('Anchor not found: structured product filters');
  const anchor = anchorMatch[0];
  const insertion = `${anchor}
// structured-sales-filters-v288:start
const maxPriceCentsV288 = Number(base.maxPriceCents || base.salesFilters?.maxPriceCents || 0);
const cameraPriorityV288 = base.cameraPriority === true || base.salesFilters?.cameraPriority === true || base.salesFilters?.cameraQuality === 'good';
const cameraMinMpxV288 = Number(base.cameraMinMpx || base.salesFilters?.cameraMinMpx || base.salesFilters?.cameraMinMp || 0);
const screenPriorityV288 = base.screenPriority === true || base.salesFilters?.screenPriority === true || base.salesFilters?.screenQuality === 'good';
const screenTypeV288 = normalize(base.screenType || base.salesFilters?.screenType || '');
const screenMinHzV288 = Number(base.screenMinHz || base.salesFilters?.screenMinHz || base.salesFilters?.refreshRateMinHz || 0);
const numericSpecV288 = (value) => { const m = String(value ?? '').replace(',', '.').match(/\\d+(?:\\.\\d+)?/); return m ? Number(m[0]) : 0; };
const specV288 = (p, names) => { for (const name of names) { const value = p?.specs?.[name] ?? p?.custom_fields?.[name]; if (value !== undefined && value !== null && String(value).trim()) return value; } return ''; };
const cameraScoreV288 = (p) => numericSpecV288(specV288(p, ['pontuacao_dxomak','dxomark','camera_score']));
const cameraMpxV288 = (p) => numericSpecV288(specV288(p, ['cam_principal_mpx','camera_principal_mpx','main_camera_mpx']));
const screenHzV288 = (p) => numericSpecV288(specV288(p, ['celular_fps_display','fps_do_display','refresh_rate']));
const screenTextV288 = (p) => normalize(['tipo_de_display','tipo_de_tela','display','display_type'].map((name) => specV288(p, [name])).filter(Boolean).join(' '));
let structuredFilteredRowsV288 = featureFilteredRowsV228.filter((p) => {
  const price = Math.round(toNumber(p?.price_retail));
  if (maxPriceCentsV288 > 0 && price > maxPriceCentsV288) return false;
  if (cameraMinMpxV288 > 0 && cameraMpxV288(p) < cameraMinMpxV288) return false;
  if (screenTypeV288 && !screenTextV288(p).includes(screenTypeV288)) return false;
  if (screenMinHzV288 > 0 && screenHzV288(p) < screenMinHzV288) return false;
  return true;
});
if (cameraPriorityV288) {
  structuredFilteredRowsV288 = structuredFilteredRowsV288
    .filter((p) => cameraScoreV288(p) > 0)
    .sort((a, b) => cameraScoreV288(b) - cameraScoreV288(a))
    .slice(0, 12);
}
  if (screenPriorityV288) {
  const screenScoreV288 = (p) => (/amoled|oled/.test(screenTextV288(p)) ? 1000 : 0) + screenHzV288(p);
  structuredFilteredRowsV288 = structuredFilteredRowsV288
    .filter((p) => screenTextV288(p) || screenHzV288(p) > 0)
    .sort((a, b) => screenScoreV288(b) - screenScoreV288(a))
    .slice(0, 12);
}
const hasStructuredPreferenceV288 = Boolean(maxPriceCentsV288 || cameraPriorityV288 || cameraMinMpxV288 || screenPriorityV288 || screenTypeV288 || screenMinHzV288 || phoneNfcFilterRequestV228 || phoneMemoryFilterRequestV155);
// structured-sales-filters-v288:end`;
  code = replaceOnce(code, anchor, insertion, 'structured product filters');
  code = code.replace(`const candidateProducts = featureFilteredRowsV228`, `const candidateProducts = structuredFilteredRowsV288`);
  code = code.replace(
    `const unavailablePhoneOfferV165 = products.length === 0 && prefersSmartphones && !phoneNfcFilterRequestV228 && !phoneMemoryFilterRequestV155;`,
    `const unavailablePhoneOfferV165 = products.length === 0 && prefersSmartphones && !hasStructuredPreferenceV288 && !phoneNfcFilterRequestV228 && !phoneMemoryFilterRequestV155;`
  );
  code = code.replace(
    `filters: {
    nfc: requestedNfcV228,
    ramGb: requestedRamGbV155,
    storageGb: requestedStorageGbV155,
  },`,
    `filters: {
    ...(base.salesFilters || {}),
    nfc: requestedNfcV228,
    ramGb: requestedRamGbV155,
    storageGb: requestedStorageGbV155,
    maxPriceCents: maxPriceCentsV288,
    cameraPriority: cameraPriorityV288,
    cameraMinMpx: cameraMinMpxV288,
    screenPriority: screenPriorityV288,
    screenType: screenTypeV288,
    screenMinHz: screenMinHzV288,
  },`
  );
  const returnMatches = [...code.matchAll(/return\s*\[\{\s*json\s*:\s*\{/g)];
  const finalReturnMatch = returnMatches[returnMatches.length - 1];
  const returnAnchor = finalReturnMatch?.[0] || '';
  const guidance = `const structuredFilterNeedsHandoffV288 = hasStructuredPreferenceV288 && products.length === 0;
const structuredFilterGuidanceV288 = structuredFilterNeedsHandoffV288
  ? 'Obrigado pelas informações 😊 Não consegui identificar com segurança, de forma automática, qual opção combina melhor com todas as suas preferências.\\n\\nVou chamar um de nossos atendentes para te orientar e encontrar a alternativa mais adequada para você. Só um momento, por favor.'
  : '';
const phoneCatalogFollowupEligibleV289 = Boolean(isCompleteCategoryRequest && prefersSmartphones && products.length > 0);

${returnAnchor}`;
  const finalReturnIndex = finalReturnMatch?.index ?? -1;
  if (finalReturnIndex < 0 || !returnAnchor) throw new Error('Anchor not found: product context return guidance');
  code = code.slice(0, finalReturnIndex) + guidance + code.slice(finalReturnIndex + returnAnchor.length);
  const jsonAnchor = `  productsContext:`;
  code = replaceOnce(code, jsonAnchor, `  structuredFilterNeedsHandoffV288,
  phoneCatalogFollowupEligible: phoneCatalogFollowupEligibleV289,
  phoneCatalogFollowupToken: phoneCatalogFollowupEligibleV289 ? [String(base.remoteJid || ''), Date.now(), products.length].join(':') : '',
  ${jsonAnchor.trim()}`, 'product context output fields');
  code = code.replace(
    `    stockAssistantContext: unavailablePhoneGuidanceV165,`,
    `    stockAssistantContext: structuredFilterGuidanceV288 || unavailablePhoneGuidanceV165 || String(base.stockAssistantContext || ''),`
  );
  code = code.replace(
    `    aiResponseGuidance: unavailablePhoneGuidanceV165 || String(base.aiResponseGuidance || ''),`,
    `    aiResponseGuidance: structuredFilterGuidanceV288 || unavailablePhoneGuidanceV165 || String(base.aiResponseGuidance || ''),`
  );
  if ((code.match(/stockAssistantContext:/g) || []).length !== 1) throw new Error('Unexpected stockAssistantContext output count');
  if ((code.match(/aiResponseGuidance:/g) || []).length !== 1) throw new Error('Unexpected aiResponseGuidance output count');
  new Function(code);
  node.parameters.jsCode = code;
}

function patchSplit(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('phoneCatalogFollowupEligible: $json.phoneCatalogFollowupEligible')) return;
  const anchor = `messageIndex: index + 1,`;
  code = replaceOnce(code, anchor, `${anchor}
      phoneCatalogFollowupEligible: $json.phoneCatalogFollowupEligible === true,
      phoneCatalogFollowupToken: String($json.phoneCatalogFollowupToken || ''),`, 'split follow-up flags');
  new Function(code);
  node.parameters.jsCode = code;
}

function patchGraph(nodes, connections) {
  patchPrepareSearch(findNode(nodes, 'Vendas - Preparar Busca'));
  patchPostList(findNode(nodes, 'Vendas - Verificar Pos Lista'));
  patchProductContext(findNode(nodes, 'Vendas - Contexto Produtos'));
  patchSplit(findNode(nodes, 'Dividir mensagens'));

  upsertNode(nodes, makeHttpNode({
    id: 'sales-persist-preferences-v288', name: 'Vendas - Persistir Preferencias', position: [2350, 500],
    url: `${API_URL}/n8n-bot/catalog-preferences/merge`,
    bodyParameters: [
      { name: 'remoteJid', value: `={{$('Vendas - Preparar Busca').first().json.remoteJid}}` },
      { name: 'message', value: `={{$('Vendas - Preparar Busca').first().json.conversation || ''}}` },
    ],
  }));
  upsertNode(nodes, {
    id: 'sales-restore-preferences-v288', name: 'Vendas - Restaurar Preferencias', position: [2500, 500],
    type: 'n8n-nodes-base.code', typeVersion: 2,
    parameters: { jsCode: `const source = $('Vendas - Preparar Busca').first().json || {};
const payload = $json || {};
return [{ json: { ...source, salesFilters: { ...(payload.preferences?.constraints || {}), ...(source.salesFilters || {}) }, persistedSalesPreferences: payload.preferences || null } }];` },
  });
  replaceTarget(connections, 'Vendas - Preparar Busca', 'Vendas - Buscar Produtos', 'Vendas - Persistir Preferencias');
  addTarget(connections, 'Vendas - Persistir Preferencias', 'Vendas - Restaurar Preferencias');
  addTarget(connections, 'Vendas - Restaurar Preferencias', 'Vendas - Buscar Produtos');

  upsertNode(nodes, {
    id: 'send-restore-accepted-v289', name: 'Envio - Restaurar item aceito', position: [3100, 80],
    type: 'n8n-nodes-base.code', typeVersion: 2,
    parameters: { jsCode: `const current = $('Loop - Enviar mensagens em ordem').first().json || {};
return [{ json: { ...current, evolutionAccepted: true } }];` },
  });
  upsertNode(nodes, {
    id: 'followup-last-block-if-v289', name: 'Follow-up Lista - Ultimo bloco?', position: [3250, 180],
    type: 'n8n-nodes-base.if', typeVersion: 2.2,
    parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [{
      id: 'followup-last-block-condition-v289', leftValue: `={{$json.evolutionAccepted === true && $json.phoneCatalogFollowupEligible === true && Number($json.messageIndex) === Number($json.totalMessages) && Boolean($json.phoneCatalogFollowupToken)}}`, rightValue: true,
      operator: { type: 'boolean', operation: 'true', singleValue: true },
    }], combinator: 'and' }, options: {} },
  });
  upsertNode(nodes, makeHttpNode({
    id: 'followup-schedule-v289', name: 'Follow-up Lista - Agendar 10 min', position: [3420, 180],
    url: `${API_URL}/n8n-bot/phone-catalog-followups/schedule`,
    bodyParameters: [
      { name: 'remoteJid', value: '={{$json.remoteJid}}' },
      { name: 'delayMinutes', value: '=10' },
      { name: 'token', value: '={{$json.phoneCatalogFollowupToken}}' },
    ],
  }));
  replaceTarget(connections, 'Handoff - Registrar bot enviado', 'Loop - Enviar mensagens em ordem', 'Envio - Restaurar item aceito');
  addTarget(connections, 'Envio - Restaurar item aceito', 'Loop - Enviar mensagens em ordem');
  addTarget(connections, 'Envio - Restaurar item aceito', 'Follow-up Lista - Ultimo bloco?');
  addTarget(connections, 'Follow-up Lista - Ultimo bloco?', 'Follow-up Lista - Agendar 10 min', 0);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const inspect = process.argv.includes('--inspect');
  const { Client } = require('ssh2');
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('n8n Postgres container not found');
    const raw = await psql(conn, db, `COPY (
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'activeVersionId', "activeVersionId"
      )::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchGraph(nodes, connections);
    for (const node of nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
      new Function(String(node.parameters?.jsCode || ''));
    }

    const summary = {
      apply,
      workflowId: WORKFLOW_ID,
      activeVersionId: entity.activeVersionId,
      nodes: ['Vendas - Preparar Busca', 'Vendas - Verificar Pos Lista', 'Vendas - Contexto Produtos', 'Dividir mensagens', 'Vendas - Persistir Preferencias', 'Follow-up Lista - Agendar 10 min'],
      codeCompiles: true,
    };
    if (inspect) {
      summary.handoffNodes = nodes
        .filter((item) => /handoff|especialista|atendente/i.test(String(item.name || '')))
        .map((item) => ({ name: item.name, type: item.type, connections: connections[item.name]?.main || [] }));
      const productContextCode = String(findNode(nodes, 'Vendas - Contexto Produtos').parameters?.jsCode || '');
      summary.productContextRelevantLines = productContextCode.split(/\r?\n/)
        .filter((line) => /unavailablePhoneOfferV165|stockAssistantContext|aiResponseGuidance|structuredFilter/i.test(line));
      summary.salesHandoffRelevantLines = ['Vendas - Preparar Handoff Especialista', 'Vendas - Retomar Resposta Especialista']
        .flatMap((name) => {
          const target = findNode(nodes, name);
          return String(target.parameters?.jsCode || '').split(/\r?\n/)
            .filter((line) => /output|response|resposta|handoff|atendente|especialista|message/i.test(line))
            .map((line) => `${name}: ${line}`);
        });
    }
    if (!apply) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    servicesStopped = true;
    const result = await psql(conn, db, `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodesjson')}::json, connections=${dollar(JSON.stringify(connections), 'connectionsjson')}::json, "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'historynodesjson')}::json, connections=${dollar(JSON.stringify(connections), 'historyconnectionsjson')}::json, "updatedAt"=NOW() WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(entity.activeVersionId)};
COPY (
  SELECT json_build_object('entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb)::text
  FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId"
  WHERE we.id=${shQuote(WORKFLOW_ID)}
) TO STDOUT;`);
    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    console.log(JSON.stringify({ ...summary, verification: result.trim().split(/\r?\n/).filter(Boolean).pop() }, null, 2));
  } catch (error) {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    throw error;
  } finally {
    conn.end();
  }
}

module.exports = { patchGraph };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
