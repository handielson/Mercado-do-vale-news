const path = require('node:path');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const SMARTPHONES_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const APPLY = process.argv.includes('--apply');

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
    stream.on('close', (code) => code === 0
      ? resolve(stdout)
      : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}
function psql(conn, db, sql) {
  return new Promise((resolve, reject) => conn.exec(
    `docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`,
    (error, stream) => {
      if (error) return reject(error);
      let stdout = ''; let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0
        ? resolve(stdout)
        : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
      stream.end(sql);
    },
  ));
}
async function waitService(conn, service, expected, timeoutMs = 150000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`,
    )).trim();
    if (replicas === `${expected}/${expected}`) return replicas;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}
function nodeByName(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  if (!node) throw new Error(`${name} not found`);
  return node;
}

function requireDependency(name) {
  try {
    return require(name);
  } catch (error) {
    if (error?.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(__dirname, '..', '..', '..', 'mercado-do-vale', 'node_modules', name));
  }
}

function loadRemoteDependencies() {
  const dotenv = requireDependency('dotenv');
  for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'mercado-do-vale')]) {
    dotenv.config({ path: path.join(root, '.env.vps.local'), quiet: true });
    dotenv.config({ path: path.join(root, '.env.local'), quiet: true });
  }
  return {
    Client: requireDependency('ssh2').Client,
    getVpsSshConfig: require('./vps-ssh-config.cjs').getVpsSshConfig,
  };
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNfcValue(value) {
  const normalized = normalize(value).replace(/\s+/g, '');
  if (['sim', 'yes', 'true', '1'].includes(normalized)) return 'sim';
  if (['nao', 'no', 'false', '0'].includes(normalized)) return 'nao';
  if (['consulte', 'consultar', 'verificar', 'naoinformado'].includes(normalized)) return 'consulte';
  return '';
}

function detectPhoneNfcFilter(value, options = {}) {
  const raw = String(value || '');
  const normalized = normalize(raw);
  const fiscal = /\bnfc\s*-\s*e\b/i.test(raw)
    || /\bnfce\b|\bnota fiscal\b|\bcupom fiscal\b|\bdanfe\b/.test(normalized);
  const accessory = /\b(?:capa|capinha|pelicula|carregador|cabo|fonte|fone|acessorio|smartwatch|relogio inteligente)\b/.test(normalized);
  if (fiscal || accessory) return '';
  const directNfc = /\bnfc\b/.test(normalized);
  const explicitPhone = /\b(?:celular|celulares|smartphone|smartphones|aparelho|aparelhos|telefone|telefones|iphone|iphones)\b/.test(normalized);
  const productQuestion = /\b(?:qual|quais|modelo|modelos|tem|tenham|possui|possuem)\b/.test(normalized);
  const proximity = /\b(?:pagamento por aproximacao|aproximacao|contactless)\b/.test(normalized);
  const activeSmartphoneCatalog = options.activeCategoryId === SMARTPHONES_CATEGORY_ID;
  if (directNfc || (proximity && (explicitPhone || productQuestion || activeSmartphoneCatalog))) return 'sim';
  return '';
}

function conflictKey(product) {
  const sku = normalize(product?.sku).replace(/\s+/g, '');
  if (sku) return `sku:${sku}`;
  return `id:${String(product?.id || '')}`;
}

function conflictingNfcKeys(rows) {
  const valuesByKey = new Map();
  for (const product of rows || []) {
    const key = conflictKey(product);
    if (!valuesByKey.has(key)) valuesByKey.set(key, new Set());
    const value = normalizeNfcValue(product?.specs?.nfc ?? product?.custom_fields?.nfc);
    if (value) valuesByKey.get(key).add(value);
  }
  return new Set([...valuesByKey.entries()]
    .filter(([, values]) => values.has('sim') && (values.has('consulte') || values.has('nao')))
    .map(([key]) => key));
}

function filterRowsByNfc(rows, requestedNfc = 'sim') {
  const normalizedRequest = normalizeNfcValue(requestedNfc);
  if (!normalizedRequest) return [...(rows || [])];
  const conflicts = conflictingNfcKeys(rows);
  return (rows || []).filter((product) => (
    !conflicts.has(conflictKey(product))
    && normalizeNfcValue(product?.specs?.nfc ?? product?.custom_fields?.nfc) === normalizedRequest
  ));
}

function buildFilterLabel({ requestedNfc = '', memoryFilterLabel = '' } = {}) {
  return [normalizeNfcValue(requestedNfc) === 'sim' ? 'NFC' : '', String(memoryFilterLabel || '').trim()]
    .filter(Boolean)
    .join(' e ');
}

function patchClassifier(node) {
  let prompt = String(node.parameters?.options?.systemMessage || '');
  if (prompt.includes('phone-nfc-filter-v228')) return;
  const marker = '- Se o cliente pede celulares por armazenamento ou RAM, por exemplo "quais celulares de 128GB" ou "celulares com 4GB de RAM", tambem use venda.tipo="categoria", venda.categoria="smartphones", venda.categoria_id="8b7c4852-c195-4527-8fd7-c3cc2debda42", venda.busca="". O sistema aplicara o filtro exato.';
  if (!prompt.includes(marker)) throw new Error('Classifier memory-filter rule not found');
  const addition = `${marker}
- Se o cliente perguntar quais celulares tem NFC, pagamento por aproximacao no aparelho ou combinar NFC com RAM/armazenamento, use a mesma categoria smartphones e preencha venda.filtros.nfc="sim". // phone-nfc-filter-v228
- Em perguntas de produto, preserve os filtros combinados em venda.filtros: {"nfc":"sim" ou "", "ram_gb":[], "armazenamento_gb":[]}. Nao confunda NFC de aparelho com NFC-e, NFe, nota fiscal, cupom fiscal ou DANFE.`;
  prompt = prompt.replace(marker, addition);
  const jsonMarker = '    "categoria_id": "8b7c4852-c195-4527-8fd7-c3cc2debda42"\n  },';
  const jsonReplacement = '    "categoria_id": "8b7c4852-c195-4527-8fd7-c3cc2debda42",\n    "filtros": {"nfc": "sim", "ram_gb": [], "armazenamento_gb": []}\n  },';
  if (!prompt.includes(jsonMarker)) throw new Error('Classifier JSON example marker not found');
  node.parameters.options.systemMessage = prompt.replace(jsonMarker, jsonReplacement);
}

function patchParse(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('classifierNfcFilterV228')) return;
  const marker = "const fluxoVenda = parsed?.fluxo_venda && typeof parsed.fluxo_venda === 'object' && !Array.isArray(parsed.fluxo_venda) ? parsed.fluxo_venda : {};";
  if (!code.includes(marker)) throw new Error('Parse fluxo_venda marker not found');
  code = code.replace(marker, `${marker}
const vendaFiltrosV228 = venda?.filtros && typeof venda.filtros === 'object' && !Array.isArray(venda.filtros) ? venda.filtros : {};
const classifierNfcFilterV228 = (() => {
  const value = String(vendaFiltrosV228.nfc || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
  return ['sim', 'yes', 'true', '1'].includes(value) ? 'sim' : '';
})();`);
  const outputMarker = "    salesFlowNewSearchTerm: String(fluxoVenda.termo_nova_busca || '').trim(),";
  if (!code.includes(outputMarker)) throw new Error('Parse sales output marker not found');
  node.parameters.jsCode = code.replace(outputMarker, `${outputMarker}
    salesNfcFilter: classifierNfcFilterV228,`);
}

const resolverAddition = `const rawPhoneNfcTextV228 = String(text || '');
const normalizedPhoneNfcTextV228 = normalize(rawPhoneNfcTextV228);
const activePhoneNfcStateV228 = getActivePostList();
const fiscalNfcGuardV228 = /\\bnfc\\s*-\\s*e\\b/i.test(rawPhoneNfcTextV228)
  || /\\bnfce\\b|\\bnota fiscal\\b|\\bcupom fiscal\\b|\\bdanfe\\b/.test(normalizedPhoneNfcTextV228);
const accessoryNfcGuardV228 = /\\b(?:capa|capinha|pelicula|carregador|cabo|fonte|fone|acessorio|smartwatch|relogio inteligente)\\b/.test(normalizedPhoneNfcTextV228);
const directNfcMentionV228 = /\\bnfc\\b/.test(normalizedPhoneNfcTextV228);
const explicitPhoneNfcContextV228 = /\\b(?:celular|celulares|smartphone|smartphones|aparelho|aparelhos|telefone|telefones|iphone|iphones)\\b/.test(normalizedPhoneNfcTextV228);
const productQuestionNfcContextV228 = /\\b(?:qual|quais|modelo|modelos|tem|tenham|possui|possuem)\\b/.test(normalizedPhoneNfcTextV228);
const proximityNfcMentionV228 = /\\b(?:pagamento por aproximacao|aproximacao|contactless)\\b/.test(normalizedPhoneNfcTextV228);
const activeSmartphoneCatalogV228 = String(activePhoneNfcStateV228?.categoryId || '') === '${SMARTPHONES_CATEGORY_ID}';
const inheritedNfcFilterV228 = String($json.salesNfcFilter || '').toLowerCase() === 'sim';
const phoneNfcFilterIntentV228 = !fiscalNfcGuardV228 && !accessoryNfcGuardV228 && (
  directNfcMentionV228
  || inheritedNfcFilterV228
  || (proximityNfcMentionV228 && (explicitPhoneNfcContextV228 || productQuestionNfcContextV228 || activeSmartphoneCatalogV228))
);
const deterministicPhoneNfcFilterV228 = phoneNfcFilterIntentV228
  ? { acao: 'listar_catalogo', intencao: 'catalogo_nfc', produto_busca: 'smartphones', nfc: 'sim', confianca: 1, motivo: 'Filtro deterministico de NFC em smartphones.' }
  : null;`;

function patchResolver(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('deterministicPhoneNfcFilterV228')) return;
  const marker = 'const parsed = safeJsonParse(rawOutput);';
  if (!code.includes(marker)) throw new Error('Resolver parsed marker not found');
  code = code.replace(marker, `${marker}
${resolverAddition}`);
  const decisionPattern = /const decision = ([^;]*deterministicFiscalDocumentDecisionV164[^;]*);/;
  const decisionMatch = code.match(decisionPattern);
  if (!decisionMatch) throw new Error('Resolver decision chain with fiscal priority not found');
  const chain = decisionMatch[1];
  const fiscalMarker = 'deterministicFiscalDocumentDecisionV164 ||';
  if (!chain.includes(fiscalMarker)) throw new Error('Resolver fiscal priority marker not found');
  const nextChain = chain.replace(fiscalMarker, `${fiscalMarker} deterministicPhoneNfcFilterV228 ||`);
  code = code.replace(decisionMatch[0], `const decision = ${nextChain};`);
  const outputMarker = "    requestedMemory: String(decision.memoria || ''),";
  if (!code.includes(outputMarker)) throw new Error('Resolver requestedMemory marker not found');
  node.parameters.jsCode = code.replace(outputMarker, `${outputMarker}
    requestedNfc: phoneNfcFilterIntentV228 ? 'sim' : '',`);
}

function patchPrepare(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('phoneNfcFilterRequestV228')) return;
  const marker = 'const phoneMemoryFilterRequest = explicitPhoneDeviceRequest && !accessoryRequest && (requestedRamGb.length > 0 || requestedStorageGb.length > 0);';
  if (!code.includes(marker)) throw new Error('Prepare memory-filter marker not found');
  const addition = `const requestedNfcV228 = String(source.requestedNfc || source.salesNfcFilter || '').toLowerCase() === 'sim' ? 'sim' : '';
const phoneNfcFilterRequestV228 = !accessoryRequest && requestedNfcV228 === 'sim';
const phoneMemoryFilterRequest = (explicitPhoneDeviceRequest || phoneNfcFilterRequestV228)
  && !accessoryRequest
  && (requestedRamGb.length > 0 || requestedStorageGb.length > 0);`;
  code = code.replace(marker, addition);
  const forceMarker = '  || phoneMemoryFilterRequest\n);';
  if (!code.includes(forceMarker)) throw new Error('Prepare force-smartphone marker not found');
  code = code.replace(forceMarker, '  || phoneMemoryFilterRequest\n  || phoneNfcFilterRequestV228\n);');
  const outputMarker = '    phoneMemoryFilterRequest,\n    requestedRamGb,';
  if (!code.includes(outputMarker)) throw new Error('Prepare filter output marker not found');
  node.parameters.jsCode = code.replace(outputMarker, `    phoneMemoryFilterRequest,
    phoneNfcFilterRequest: phoneNfcFilterRequestV228,
    requestedNfc: requestedNfcV228,
    requestedRamGb,`);
}

const contextNfcHelpers = `const normalizeNfcValueV228 = (value) => {
  const normalized = String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\s+/g, '').trim();
  if (['sim', 'yes', 'true', '1'].includes(normalized)) return 'sim';
  if (['nao', 'no', 'false', '0'].includes(normalized)) return 'nao';
  if (['consulte', 'consultar', 'verificar', 'naoinformado'].includes(normalized)) return 'consulte';
  return '';
};
const nfcConflictKeyV228 = (product) => {
  const sku = String(product?.sku || '').trim().toLowerCase().replace(/\\s+/g, '');
  return sku ? 'sku:' + sku : 'id:' + String(product?.id || '');
};
const nfcValuesByKeyV228 = new Map();
for (const product of rows) {
  const key = nfcConflictKeyV228(product);
  if (!nfcValuesByKeyV228.has(key)) nfcValuesByKeyV228.set(key, new Set());
  const value = normalizeNfcValueV228(product?.specs?.nfc ?? product?.custom_fields?.nfc);
  if (value) nfcValuesByKeyV228.get(key).add(value);
}
const conflictingNfcKeysV228 = new Set([...nfcValuesByKeyV228.entries()]
  .filter(([, values]) => values.has('sim') && (values.has('consulte') || values.has('nao')))
  .map(([key]) => key));
const requestedNfcV228 = String(base.requestedNfc || '').toLowerCase() === 'sim' ? 'sim' : '';
const phoneNfcFilterRequestV228 = base.phoneNfcFilterRequest === true && requestedNfcV228 === 'sim';
const featureFilteredRowsV228 = phoneNfcFilterRequestV228
  ? memoryFilteredRowsV155.filter((product) => (
      !conflictingNfcKeysV228.has(nfcConflictKeyV228(product))
      && normalizeNfcValueV228(product?.specs?.nfc ?? product?.custom_fields?.nfc) === requestedNfcV228
    ))
  : memoryFilteredRowsV155;`;

function patchContext(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('featureFilteredRowsV228')) return;
  const helperMarker = 'const selectedCardFee = fees';
  if (!code.includes(helperMarker)) throw new Error('Context fees marker not found');
  code = code.replace(helperMarker, `${contextNfcHelpers}

${helperMarker}`);
  const candidateMarker = 'const candidateProducts = memoryFilteredRowsV155';
  if (!code.includes(candidateMarker)) throw new Error('Context memory candidate marker not found');
  code = code.replace(candidateMarker, 'const candidateProducts = featureFilteredRowsV228');
  const titleMarker = `const memoryFilterTitleV155 = phoneMemoryFilterRequestV155 && base.memoryFilterLabel
  ? '📱 Celulares com ' + base.memoryFilterLabel
  : '';`;
  if (!code.includes(titleMarker)) throw new Error('Context filtered-title marker not found');
  const titleReplacement = `const phoneFilterLabelV228 = [phoneNfcFilterRequestV228 ? 'NFC' : '', String(base.memoryFilterLabel || '').trim()].filter(Boolean).join(' e ');
const memoryFilterTitleV155 = phoneFilterLabelV228 ? '📱 Celulares com ' + phoneFilterLabelV228 : '';`;
  code = code.replace(titleMarker, titleReplacement);

  const stateMarker = `      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 60 * 60 * 1000,
      options: products.map((product, index) => ({`;
  if (!code.includes(stateMarker)) throw new Error('Context salesPostList state marker not found');
  code = code.replace(stateMarker, `      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 60 * 60 * 1000,
      categoryId: String(base.productCategoryId || base.salesCategoryId || ''),
      filters: {
        nfc: requestedNfcV228,
        ramGb: requestedRamGbV155,
        storageGb: requestedStorageGbV155,
      },
      options: products.map((product, index) => ({`);

  const unavailableMarker = 'const unavailablePhoneOfferV165 = products.length === 0 && prefersSmartphones;';
  if (!code.includes(unavailableMarker)) throw new Error('Context unavailable-phone offer marker not found');
  code = code.replace(
    unavailableMarker,
    'const unavailablePhoneOfferV165 = products.length === 0 && prefersSmartphones && !phoneNfcFilterRequestV228 && !phoneMemoryFilterRequestV155;',
  );

  const returnMarker = "    productsContext: lines.join('\\n'),";
  if (!code.includes(returnMarker)) throw new Error('Context productsContext marker not found');
  const returnReplacement = `    productsContext: phoneNfcFilterRequestV228 && products.length === 0
      ? 'FILTRO_INTERNO_NFC_SEM_RESULTADO_CONFIRMADO: nenhum smartphone ativo, visivel e com estoque correspondeu simultaneamente aos filtros solicitados e ao NFC com valor exato Sim. Valores Consulte, vazios e SKUs conflitantes Sim/Consulte foram excluidos. Responda com palavras proprias e, se for util, ofereca conferencia por especialista.'
      : lines.join('\\n'),`;
  node.parameters.jsCode = code.replace(returnMarker, returnReplacement);
}

function patchSalesContextState(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('filtros: activeState.filters')) return;
  const marker = "      pedidoEmMontagem: activeState.orderDraft || null,\n      opcoes:";
  if (!code.includes(marker)) throw new Error('Sales context state marker not found');
  node.parameters.jsCode = code.replace(
    marker,
    "      pedidoEmMontagem: activeState.orderDraft || null,\n      filtros: activeState.filters || {},\n      categoriaId: activeState.categoryId || '',\n      opcoes:",
  );
}

function patchSalesSpecialist(node) {
  let prompt = String(node.parameters?.options?.systemMessage || '');
  if (prompt.includes('FILTRO_INTERNO_NFC_SEM_RESULTADO_CONFIRMADO')) return;
  const marker = '- Se nao houver produtos no contexto, isso significa apenas que a busca automatica nao localizou resultado. Nao afirme que o item acabou ou esta sem estoque.';
  if (!prompt.includes(marker)) throw new Error('Sales specialist no-result marker not found');
  const addition = `${marker}
- Se o contexto contiver FILTRO_INTERNO_NFC_SEM_RESULTADO_CONFIRMADO, escreva uma resposta propria, curta e gentil. Diga apenas que nao encontrou no estoque atual um aparelho com NFC confirmado e com os demais filtros solicitados. Se couber, ofereca pedir a um especialista para conferir opcoes ainda nao confirmadas. Nao copie o marcador, nao invente modelos e nao envie a lista geral. // phone-nfc-filter-v228`;
  node.parameters.options.systemMessage = prompt.replace(marker, addition);
}

function patchWorkflow(nodes, connections) {
  patchClassifier(nodeByName(nodes, 'Agente Inicial - Classificador'));
  patchParse(nodeByName(nodes, 'Parse Classificacao'));
  patchResolver(nodeByName(nodes, 'Resolver Acao de Conversacao'));
  patchPrepare(nodeByName(nodes, 'Vendas - Preparar Busca'));
  patchContext(nodeByName(nodes, 'Vendas - Contexto Produtos'));
  patchSalesContextState(nodeByName(nodes, 'Vendas - Preparar Contexto IA'));
  patchSalesSpecialist(nodeByName(nodes, 'Especialista - Vendas'));
  for (const node of nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
    if (node.parameters?.jsCode) new Function(node.parameters.jsCode);
  }
  return { nodes, connections };
}

function summarize(nodes, connections) {
  const classifier = nodeByName(nodes, 'Agente Inicial - Classificador').parameters.options.systemMessage;
  const parse = nodeByName(nodes, 'Parse Classificacao').parameters.jsCode;
  const resolver = nodeByName(nodes, 'Resolver Acao de Conversacao').parameters.jsCode;
  const prepare = nodeByName(nodes, 'Vendas - Preparar Busca').parameters.jsCode;
  const context = nodeByName(nodes, 'Vendas - Contexto Produtos').parameters.jsCode;
  const specialist = nodeByName(nodes, 'Especialista - Vendas').parameters.options.systemMessage;
  return {
    classifierUnderstandsNfc: classifier.includes('phone-nfc-filter-v228'),
    classifierCarriesStructuredFilters: classifier.includes('"filtros": {"nfc": "sim"'),
    parseCarriesNfc: parse.includes('classifierNfcFilterV228'),
    resolverHasFiscalGuard: resolver.includes('fiscalNfcGuardV228')
      && resolver.indexOf('deterministicFiscalDocumentDecisionV164') < resolver.lastIndexOf('deterministicPhoneNfcFilterV228'),
    resolverHasNfcRoute: resolver.includes('deterministicPhoneNfcFilterV228'),
    prepareForcesSmartphoneCategory: prepare.includes('|| phoneNfcFilterRequestV228'),
    contextIntersectsFilters: context.includes('featureFilteredRowsV228')
      && context.includes('const candidateProducts = featureFilteredRowsV228'),
    contextRejectsConflicts: context.includes("values.has('sim') && (values.has('consulte') || values.has('nao'))"),
    contextUsesExistingBrandFormatter: context.includes('quoteBrandGroupV227')
      && context.includes('memoryFilterTitleV155 ||'),
    stateCarriesFilters: context.includes('filters: {') && context.includes('categoryId:'),
    noResultIsNatural: specialist.includes('FILTRO_INTERNO_NFC_SEM_RESULTADO_CONFIRMADO'),
    noResultSpecialistGatePreserved: Boolean(connections['Vendas - Produto encontrado?']),
  };
}

async function main() {
  const { Client, getVpsSshConfig } = loadRemoteDependencies();
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
    patchWorkflow(nodes, connections);
    const summary = summarize(nodes, connections);
    if (!Object.values(summary).every(Boolean)) throw new Error(`Patch validation failed: ${JSON.stringify(summary)}`);
    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, ...summary }, null, 2));
      return;
    }

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const sql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, connections=${dollar(JSON.stringify(connections), 'connections')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'hnodes')}::json, connections=${dollar(JSON.stringify(connections), 'hconnections')}::json, "updatedAt"=NOW() WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(entity.activeVersionId)};
COPY (
  SELECT json_build_object(
    'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
    'nfcResolver', we.nodes::text LIKE '%deterministicPhoneNfcFilterV228%',
    'nfcContext', we.nodes::text LIKE '%featureFilteredRowsV228%',
    'nfcConflictGuard', we.nodes::text LIKE '%conflictingNfcKeysV228%'
  )::text
  FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId"
  WHERE we.id=${shQuote(WORKFLOW_ID)}
) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    console.log(JSON.stringify({ apply: true, ...result, ...summary }, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = {
  SMARTPHONES_CATEGORY_ID,
  normalizeNfcValue,
  detectPhoneNfcFilter,
  conflictingNfcKeys,
  filterRowsByNfc,
  buildFilterLabel,
  patchResolver,
  patchPrepare,
  patchContext,
  patchSalesContextState,
  patchSalesSpecialist,
  patchWorkflow,
  summarize,
};

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
