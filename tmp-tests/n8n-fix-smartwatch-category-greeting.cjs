const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = '// smartwatch-category-greeting-v162';

function quote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}
function run(conn, command) {
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
  return new Promise((resolve, reject) => conn.exec(`docker exec -i ${quote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
    stream.end(sql);
  }));
}
async function waitService(conn, service, expected, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await run(conn, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
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

const smartwatchDecisionBlock = `${MARKER}
const normalizedSmartwatchTextV162 = normalize(text);
const smartwatchMentionV162 = /\\b(?:smartwatch|smartwacth|smartwhatch|smartwach|smart watch|relogio inteligente|relogios inteligentes|apple watch|redmi watch)\\b/.test(normalizedSmartwatchTextV162);
const smartwatchAccessoryV162 = /\\b(?:pulseira|bracelete|carregador|cabo|pelicula|capa|case|acessorio|acessorios)\\b/.test(normalizedSmartwatchTextV162);
const deterministicSmartwatchCatalogV162 = smartwatchMentionV162 && !smartwatchAccessoryV162
  ? {
      acao: 'listar_catalogo',
      intencao: 'catalogo_smartwatch',
      produto_busca: 'smartwatchs',
      categoria_nome: 'Smartwatchs',
      categoria_id: '6acd2038-2dd6-463d-a33b-3a0e80ee4350',
      confianca: 1,
      motivo: 'Categoria deterministica de smartwatches, incluindo grafias comuns.',
    }
  : null;`;

function patchResolver(nodes) {
  const node = nodeByName(nodes, 'Resolver Acao de Conversacao');
  let code = String(node.parameters?.jsCode || '');
  if (!code.includes(MARKER)) {
    const insertionPoint = 'const legacy = legacyDecision($json, text);';
    if (!code.includes(insertionPoint)) throw new Error('Resolver insertion point not found');
    code = code.replace(insertionPoint, `${smartwatchDecisionBlock}\n${insertionPoint}`);
    const oldDecision = 'const decision = deterministicPhoneMemoryFilterV155 || deterministicStoreLocationV129 || deterministicServiceDecisionV135 || (parsed && allowedActions.has(String(parsed.acao || \'\')) ? parsed : (legacy || fallbackDecision()));';
    const newDecision = 'const decision = deterministicSmartwatchCatalogV162 || deterministicPhoneMemoryFilterV155 || deterministicStoreLocationV129 || deterministicServiceDecisionV135 || (parsed && allowedActions.has(String(parsed.acao || \'\')) ? parsed : (legacy || fallbackDecision()));';
    if (!code.includes(oldDecision)) throw new Error('Resolver decision line not found');
    code = code.replace(oldDecision, newDecision);

    const booleans = `const catalogRequest = action === 'listar_catalogo';
const productSearchRequest = action === 'buscar_produto';`;
    const categoryResolution = `${booleans}
const catalogCategoryIdV162 = catalogRequest ? String(decision.categoria_id || SMARTPHONES_CATEGORY_ID).trim() : '';
const catalogCategoryNameV162 = catalogRequest ? String(decision.categoria_nome || 'smartphones').trim() : '';
const catalogSearchTermV162 = catalogRequest ? String(decision.produto_busca || catalogCategoryNameV162 || 'smartphones').trim() : '';`;
    if (!code.includes(booleans)) throw new Error('Resolver catalog booleans not found');
    code = code.replace(booleans, categoryResolution);
    code = code.replace("productSearchTerm: catalogRequest ? 'smartphones' : productQuery,", 'productSearchTerm: catalogRequest ? catalogSearchTermV162 : productQuery,');
    code = code.replace("salesCategoryName: catalogRequest ? 'smartphones' : String($json.salesCategoryName || ''),", "salesCategoryName: catalogRequest ? catalogCategoryNameV162 : String($json.salesCategoryName || ''),");
    code = code.replace("salesCategoryId: catalogRequest ? SMARTPHONES_CATEGORY_ID : String($json.salesCategoryId || ''),", "salesCategoryId: catalogRequest ? catalogCategoryIdV162 : String($json.salesCategoryId || ''),");
  }
  if (code.includes("productSearchTerm: catalogRequest ? 'smartphones' : productQuery,")) throw new Error('Old universal smartphone category remains');
  if (!code.includes('deterministicSmartwatchCatalogV162 || deterministicPhoneMemoryFilterV155')) throw new Error('Smartwatch priority missing');
  new Function(code);
  node.parameters.jsCode = code;
}

function patchGreetingDetection(nodes) {
  const node = nodeByName(nodes, 'Parse Classificacao');
  let code = String(node.parameters?.jsCode || '');
  const oldPure = "const pureGreetingV160 = (value) => /^(?:oi+|ola+|opa+|bom dia|boa tarde|boa noite)(?: tudo bem)?$/.test(normalizeGreetingV160(value));";
  const newPure = "const pureGreetingV160 = (value) => /^(?:oi+|ola+|opa+|bo+m+ dia|boa tarde|boa noite)(?: tudo bem)?$/.test(normalizeGreetingV160(value));";
  const oldStart = "const currentStartsWithGreetingV160 = /^(?:oi+|ola+|opa+|bom dia|boa tarde|boa noite)(?:\\b|$)/.test(normalizeGreetingV160(source.conversation));";
  const newStart = "const currentStartsWithGreetingV160 = /^(?:oi+|ola+|opa+|bo+m+ dia|boa tarde|boa noite)(?:\\b|$)/.test(normalizeGreetingV160(source.conversation));";
  if (code.includes(oldPure)) code = code.replace(oldPure, newPure);
  if (code.includes(oldStart)) code = code.replace(oldStart, newStart);
  if (!code.includes(newPure) || !code.includes(newStart)) throw new Error('Greeting typo detection patch failed');
  new Function(code);
  node.parameters.jsCode = code;
}

function patchProductContext(nodes) {
  const node = nodeByName(nodes, 'Vendas - Contexto Produtos');
  let code = String(node.parameters?.jsCode || '');
  if (!code.includes(MARKER)) {
    const insertionPoint = "const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Recife' });";
    const categoryBlock = `${MARKER}
const SMARTWATCH_CATEGORY_ID_V162 = '6acd2038-2dd6-463d-a33b-3a0e80ee4350';
const smartwatchCatalogV162 = String(base.productCategoryId || base.salesCategoryId || '') === SMARTWATCH_CATEGORY_ID_V162;
const catalogTitleV162 = smartwatchCatalogV162 ? '⌚ Smartwatches disponíveis agora' : '';
const smartwatchAvailabilityIntroV162 = smartwatchCatalogV162 && products.length > 0
  ? 'Temos sim! Vou te mostrar os smartwatches disponíveis agora:'
  : '';`;
    if (!code.includes(insertionPoint)) throw new Error('Product context insertion point not found');
    code = code.replace(insertionPoint, `${categoryBlock}\n${insertionPoint}`);

    const oldGreeting = `const greetingLine = (() => {
  if (base.saudacaoDetectada !== true) return '';
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (hour >= 5 && hour < 12) return 'Bom dia! 😊';
  if (hour >= 12 && hour < 18) return 'Boa tarde! 😊';
  return 'Boa noite! 😊';
})();`;
    const newGreeting = `const greetingLine = (() => {
  if (base.saudacaoDetectada !== true) return '';
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const period = hour >= 5 && hour < 12 ? 'Bom dia' : (hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite');
  const firstName = String(base.clienteNome || '').trim().split(/\\s+/).filter(Boolean)[0] || '';
  return period + (firstName ? ', ' + firstName : '') + ', tudo bem? 😊';
})();`;
    if (!code.includes(oldGreeting)) throw new Error('Old product greeting not found');
    code = code.replace(oldGreeting, newGreeting);
    code = code.replaceAll("memoryFilterTitleV155 || (unavailableRequestedDevice ? 'Celulares disponiveis agora' : '📱 Orçamento')", "catalogTitleV162 || memoryFilterTitleV155 || (unavailableRequestedDevice ? 'Celulares disponiveis agora' : '📱 Orçamento')");
    const oldOutput = 'output: [greetingLine, unavailableDeviceIntroMessage, ...finalQuoteMessages].filter(Boolean).join(\'[[MSG]]\'),';
    const newOutput = 'output: [greetingLine, smartwatchAvailabilityIntroV162, unavailableDeviceIntroMessage, ...finalQuoteMessages].filter(Boolean).join(\'[[MSG]]\'),';
    if (!code.includes(oldOutput)) throw new Error('Product output line not found');
    code = code.replace(oldOutput, newOutput);
  }
  if (code.includes("if (hour >= 5 && hour < 12) return 'Bom dia! 😊';")) throw new Error('Nameless product greeting remains');
  if (!code.includes('smartwatchAvailabilityIntroV162')) throw new Error('Smartwatch intro missing');
  new Function(code);
  node.parameters.jsCode = code;
}

function patchWorkflow(nodes) {
  patchResolver(nodes);
  patchGreetingDetection(nodes);
  patchProductContext(nodes);
  return nodes;
}

function summarize(nodes) {
  const resolver = nodeByName(nodes, 'Resolver Acao de Conversacao').parameters.jsCode;
  const parse = nodeByName(nodes, 'Parse Classificacao').parameters.jsCode;
  const context = nodeByName(nodes, 'Vendas - Contexto Produtos').parameters.jsCode;
  return {
    resolverMarker: resolver.includes(MARKER),
    productMarker: context.includes(MARKER),
    smartwatchCategory: resolver.includes("categoria_id: '6acd2038-2dd6-463d-a33b-3a0e80ee4350'"),
    typoSupported: resolver.includes('smartwhatch'),
    accessoriesExcluded: resolver.includes('smartwatchAccessoryV162'),
    genericCatalogPreserved: resolver.includes("decision.categoria_id || SMARTPHONES_CATEGORY_ID"),
    universalSmartphoneRouteRemoved: !resolver.includes("productSearchTerm: catalogRequest ? 'smartphones' : productQuery,"),
    misspelledGreetingSupported: parse.includes('bo+m+ dia'),
    namedGreeting: context.includes("firstName ? ', ' + firstName"),
    naturalSmartwatchIntro: context.includes('Temos sim! Vou te mostrar os smartwatches disponíveis agora:'),
  };
}

async function serviceMap(conn) {
  const output = await run(conn, "docker service ls --filter name=n8n --format '{{.Name}} {{.Replicas}}'");
  return Object.fromEntries(output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.trim().split(/\s+/)));
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = (await run(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('n8n Postgres container not found');
    const raw = await psql(conn, db, `COPY (SELECT json_build_object('nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'), 'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'), 'activeVersionId', "activeVersionId")::text FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes);
    const summary = summarize(nodes);
    if (!APPLY) return console.log(JSON.stringify({ apply: false, ...summary }, null, 2));

    await run(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await run(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const sql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, connections=${dollar(JSON.stringify(connections), 'connections')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'hnodes')}::json, connections=${dollar(JSON.stringify(connections), 'hconnections')}::json, "updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(entity.activeVersionId)};
COPY (SELECT json_build_object(
  'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
  'markerCount', (length(we.nodes::text)-length(replace(we.nodes::text, 'smartwatch-category-greeting-v162', '')))/length('smartwatch-category-greeting-v162'),
  'oldUniversalRouteRemoved', we.nodes::text NOT LIKE '%productSearchTerm: catalogRequest ? ''smartphones'' : productQuery,%',
  'smartwatchCategoryPresent', we.nodes::text LIKE '%6acd2038-2dd6-463d-a33b-3a0e80ee4350%',
  'namedGreetingPresent', we.nodes::text LIKE '%firstName ? '', '' + firstName%'
)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());
    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    const services = await serviceMap(conn);
    console.log(JSON.stringify({ apply: true, ...result, ...summary, services: {
      n8n: services.n8n_n8n,
      runner: services['n8n_n8n-runner'],
      evolution: services['n8n_evolution-api'],
    } }, null, 2));
  } finally {
    if (servicesStopped) {
      await run(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = { patchWorkflow, summarize };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
