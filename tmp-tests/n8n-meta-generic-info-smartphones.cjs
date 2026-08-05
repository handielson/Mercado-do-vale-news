const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const OLD_MARKER = '// meta-generic-info-smartphones-v166';
const MARKER = '// meta-smartphones-ai-intro-v167';
const SMARTPHONES_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const META_GENERIC_MESSAGE = 'ola posso ter mais informacoes sobre isso';
const META_INTRO_GUIDANCE = [
  'Esta mensagem veio do anuncio de smartphones da Mercado do Vale.',
  'Escreva com palavras proprias uma unica introducao curta, simpatica, educada e acolhedora; nao use resposta pronta.',
  'Diga naturalmente que voce vai apresentar os celulares disponiveis em estoque logo em seguida.',
  'Nao cite modelos, precos ou links, pois o catalogo real sera anexado depois da sua introducao.',
  'Nao faca uma pergunta final nesta introducao, porque a lista e a pergunta de escolha serao enviadas na sequencia.',
].join(' ');

function isMetaSmartphonesListMessageV167(value) {
  const expectedMessage = 'ola posso ter mais informacoes sobre isso';
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() === expectedMessage;
}

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
function upsertNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}

const resolverBlock = `${MARKER}
const metaSmartphonesListMessageV167 = (${isMetaSmartphonesListMessageV167.toString()})(text);
const metaSmartphoneIntroGuidanceV167 = metaSmartphonesListMessageV167 ? ${JSON.stringify(META_INTRO_GUIDANCE)} : '';
const deterministicMetaSmartphonesIntroV167 = metaSmartphonesListMessageV167
  ? {
      acao: 'responder_direto',
      intencao: 'meta_anuncio_intro_smartphones',
      confianca: 1,
      motivo: 'A IA deve criar uma introducao natural antes de o fluxo anexar o catalogo real de smartphones.',
    }
  : null;`;

const restoreContextCode = `${MARKER}
const source = $('Resolver Acao de Conversacao').first().json || {};
const intro = String($json.output || $json.text || $json.response || '').trim();
if (!intro) throw new Error('A introducao da IA para o catalogo veio vazia; a lista nao sera enviada sozinha.');
return [{ json: {
  ...source,
  metaSmartphoneAdRequest: true,
  metaSmartphoneCatalogIntro: intro,
  conversationAction: 'listar_catalogo',
  conversationIntent: 'meta_anuncio_catalogo_apos_intro',
  productSearchTerm: 'smartphones',
  productSearchOriginalText: String(source.conversation || ''),
  salesRequestKind: 'categoria',
  salesSearchQuery: '',
  salesCategoryName: 'smartphones',
  salesCategoryId: '${SMARTPHONES_CATEGORY_ID}',
  saudacaoDetectada: false,
  directOutput: '',
  output: '',
} }];`;

const systemPolicy = `

INTRODUCAO DO ANUNCIO DE SMARTPHONES (${MARKER}):
- Quando o Direcionamento interno disser que a mensagem veio do anuncio de smartphones, escreva uma unica introducao curta com suas proprias palavras, de forma simpatica, educada e acolhedora.
- Se houver Saudacao pendente, comece exatamente com [[SAUDACAO]] e use o nome salvo de forma natural quando estiver disponivel.
- Avise que os celulares disponiveis em estoque serao apresentados logo em seguida.
- Nao inclua modelos, precos, links, lista ou pergunta final na introducao. O fluxo anexara o catalogo real e a pergunta de escolha depois.
- Nunca copie uma frase-modelo nem diga que esta usando um direcionamento interno.`;

function patchResolver(nodes) {
  const resolver = nodeByName(nodes, 'Resolver Acao de Conversacao');
  let code = String(resolver.parameters?.jsCode || '');
  if (!code.includes(MARKER)) {
    const oldStart = code.indexOf(OLD_MARKER);
    if (oldStart >= 0) {
      const oldEnd = code.indexOf('// unavailable-phone-offer-greeting-v165', oldStart);
      if (oldEnd < 0) throw new Error('End of old Meta rule not found');
      code = code.slice(0, oldStart) + resolverBlock + '\n' + code.slice(oldEnd);
    } else {
      const insertionPoint = '// unavailable-phone-offer-greeting-v165';
      if (!code.includes(insertionPoint)) throw new Error('Resolver insertion point not found');
      code = code.replace(insertionPoint, `${resolverBlock}\n${insertionPoint}`);
    }
  }

  code = code.replace('const decision = deterministicMetaSmartphonesListV166 || ', 'const decision = ');
  if (!code.includes('const decision = deterministicMetaSmartphonesIntroV167 ||')) {
    const decisionMatch = code.match(/^const decision = (.+);$/m);
    if (!decisionMatch) throw new Error('Resolver decision line not found');
    code = code.replace(decisionMatch[0], `const decision = deterministicMetaSmartphonesIntroV167 || ${decisionMatch[1]};`);
  }

  const oldGuidance = "aiResponseGuidance: fiscalDocumentGuidanceV164 || String($json.aiResponseGuidance || ''),";
  const newGuidance = "aiResponseGuidance: metaSmartphoneIntroGuidanceV167 || fiscalDocumentGuidanceV164 || String($json.aiResponseGuidance || ''),";
  if (code.includes(oldGuidance)) code = code.replace(oldGuidance, newGuidance);
  if (!code.includes(newGuidance)) throw new Error('Meta AI guidance was not added to resolver output');

  const intentLine = "conversationIntent: String(decision.intencao || ''),";
  const flagLine = "metaSmartphoneAdRequest: metaSmartphonesListMessageV167,";
  if (!code.includes(flagLine)) {
    if (!code.includes(intentLine)) throw new Error('Resolver Meta flag insertion point not found');
    code = code.replace(intentLine, `${intentLine}\n    ${flagLine}`);
  }

  for (const removed of [OLD_MARKER, 'deterministicMetaSmartphonesListV166', "acao: 'listar_catalogo',\n      intencao: 'meta_anuncio_lista_smartphones'"]) {
    if (code.includes(removed)) throw new Error(`Old ready-response path remains: ${removed}`);
  }
  if (!code.includes("acao: 'responder_direto'")) throw new Error('Meta request does not route through AI');
  new Function('$json', '$getWorkflowStaticData', code);
  resolver.parameters.jsCode = code;
}

function patchGeneralAgent(nodes) {
  const agent = nodeByName(nodes, 'Agente Geral - Atendimento');
  let system = String(agent.parameters?.options?.systemMessage || '');
  if (!system.includes(MARKER)) system += systemPolicy;
  agent.parameters.options = { ...(agent.parameters.options || {}), systemMessage: system };
}

function patchProductContext(nodes) {
  const node = nodeByName(nodes, 'Vendas - Contexto Produtos');
  let code = String(node.parameters?.jsCode || '');
  if (!code.includes('metaSmartphoneCatalogIntro')) {
    const oldOutput = "output: [greetingLine, smartwatchAvailabilityIntroV162, unavailableDeviceIntroMessage, ...finalQuoteMessages].filter(Boolean).join('[[MSG]]'),";
    const newOutput = "output: [String(base.metaSmartphoneCatalogIntro || '').trim(), greetingLine, smartwatchAvailabilityIntroV162, unavailableDeviceIntroMessage, ...finalQuoteMessages].filter(Boolean).join('[[MSG]]'),";
    if (!code.includes(oldOutput)) throw new Error('Product-context output insertion point not found');
    code = code.replace(oldOutput, newOutput);
  }
  new Function('$json', '$input', '$getWorkflowStaticData', '$', code);
  node.parameters.jsCode = code;
}

function patchGraph(nodes, connections) {
  const agent = nodeByName(nodes, 'Agente Geral - Atendimento');
  const [x, y] = Array.isArray(agent.position) ? agent.position : [2800, 0];
  upsertNode(nodes, {
    id: 'meta-ai-intro-route-v167',
    name: 'Meta - Anuncio de smartphones?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [x + 260, y],
    parameters: {
      conditions: {
        options: { version: 2, leftValue: '', caseSensitive: true, typeValidation: 'strict' },
        combinator: 'and',
        conditions: [{
          id: 'meta-ai-intro-route-condition-v167',
          leftValue: "={{ $('Resolver Acao de Conversacao').first().json.metaSmartphoneAdRequest === true }}",
          rightValue: true,
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        }],
      },
      options: {},
    },
  });
  upsertNode(nodes, {
    id: 'meta-ai-intro-restore-v167',
    name: 'Meta - Preservar introducao e listar',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [x + 520, y - 100],
    parameters: { jsCode: restoreContextCode },
  });

  connections['Agente Geral - Atendimento'] = {
    ...(connections['Agente Geral - Atendimento'] || {}),
    main: [[{ node: 'Meta - Anuncio de smartphones?', type: 'main', index: 0 }]],
  };
  connections['Meta - Anuncio de smartphones?'] = { main: [
    [{ node: 'Meta - Preservar introducao e listar', type: 'main', index: 0 }],
    [{ node: 'Dividir mensagens', type: 'main', index: 0 }],
  ] };
  connections['Meta - Preservar introducao e listar'] = {
    main: [[{ node: 'Vendas - Preparar Busca', type: 'main', index: 0 }]],
  };
}

function patchWorkflow(nodes, connections = {}) {
  patchResolver(nodes);
  patchGeneralAgent(nodes);
  patchProductContext(nodes);
  patchGraph(nodes, connections);
  return nodes;
}

function summarize(nodes, connections = {}) {
  const resolver = nodeByName(nodes, 'Resolver Acao de Conversacao').parameters.jsCode;
  const agent = nodeByName(nodes, 'Agente Geral - Atendimento');
  const product = nodeByName(nodes, 'Vendas - Contexto Produtos').parameters.jsCode;
  const restore = nodeByName(nodes, 'Meta - Preservar introducao e listar').parameters.jsCode;
  return {
    exactMessageRule: resolver.includes(META_GENERIC_MESSAGE),
    routesThroughAi: resolver.includes("acao: 'responder_direto'") && resolver.includes("intencao: 'meta_anuncio_intro_smartphones'"),
    aiGuidance: resolver.includes('metaSmartphoneIntroGuidanceV167') && String(agent.parameters?.options?.systemMessage || '').includes(MARKER),
    noCannedOutput: resolver.includes("const directOutput = '';") && !resolver.includes('deterministicMetaSmartphonesListV166'),
    introRequiredBeforeList: restore.includes("if (!intro) throw new Error"),
    realSmartphoneCategory: restore.includes(SMARTPHONES_CATEGORY_ID),
    introPrepended: product.includes("String(base.metaSmartphoneCatalogIntro || '').trim(), greetingLine"),
    generalAgentBranches: connections['Agente Geral - Atendimento']?.main?.[0]?.[0]?.node === 'Meta - Anuncio de smartphones?',
    metaContinuesToCatalog: connections['Meta - Preservar introducao e listar']?.main?.[0]?.[0]?.node === 'Vendas - Preparar Busca',
    ordinaryAiStillSends: connections['Meta - Anuncio de smartphones?']?.main?.[1]?.[0]?.node === 'Dividir mensagens',
    oldRuleRemoved: !resolver.includes(OLD_MARKER) && !resolver.includes('meta_anuncio_lista_smartphones'),
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
    patchWorkflow(nodes, connections);
    const summary = summarize(nodes, connections);
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
  'newMarkerPresent', we.nodes::text LIKE '%meta-smartphones-ai-intro-v167%',
  'oldMarkerRemoved', we.nodes::text NOT LIKE '%meta-generic-info-smartphones-v166%',
  'oldIntentRemoved', we.nodes::text NOT LIKE '%meta_anuncio_lista_smartphones%',
  'aiRoutePresent', we.nodes::text LIKE '%meta_anuncio_intro_smartphones%',
  'introNodePresent', we.nodes::text LIKE '%Meta - Preservar introducao e listar%',
  'introBeforeCatalogPresent', we.nodes::text LIKE '%metaSmartphoneCatalogIntro%'
)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());

    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    const services = await serviceMap(conn);
    const n8nHealth = (await run(conn, 'curl -fsS https://n8n.mercadodovale.com.br/healthz')).trim();
    console.log(JSON.stringify({ apply: true, ...result, ...summary, services: {
      n8n: services.n8n_n8n,
      runner: services['n8n_n8n-runner'],
      evolution: services['n8n_evolution-api'],
    }, n8nHealth }, null, 2));
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

module.exports = {
  META_GENERIC_MESSAGE,
  META_INTRO_GUIDANCE,
  SMARTPHONES_CATEGORY_ID,
  isMetaSmartphonesListMessageV167,
  patchWorkflow,
  summarize,
};

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
