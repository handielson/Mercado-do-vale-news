const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = '// unavailable-phone-offer-greeting-v165';
const SMARTPHONES_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const PHONE_OFFER_GUIDANCE = [
  'O cliente procurou um celular ou smartphone que nao apareceu no estoque consultado.',
  'Responda com palavras proprias, de forma gentil e natural; isto nao e uma frase pronta.',
  'Informe que voce vai pedir para um especialista conferir o modelo e que a loja retornara assim que tiver a confirmacao.',
  'Enquanto o cliente aguarda, pergunte se ele quer receber a lista dos celulares disponiveis em estoque.',
  'Nao envie a lista, modelos, precos ou links nesta resposta; aguarde uma confirmacao clara do cliente.',
].join(' ');

function normalizeV165(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPhoneListConfirmationV165(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /^(?:sim|s|sim por favor|sim quero|quero|quero sim|quero ver|quero receber|claro|pode|pode sim|pode mandar(?: a lista)?|pode enviar(?: a lista)?|manda(?: a lista)?|mande(?: a lista)?|me manda(?: a lista)?|me envie(?: a lista)?|envia(?: a lista)?|envie(?: a lista)?|por favor)$/.test(normalized);
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

const resolverBlock = `${MARKER}
const phoneOfferRemoteJidV165 = String($json.remoteJid || source.remoteJid || '');
const phoneOfferStaticV165 = $getWorkflowStaticData('global');
phoneOfferStaticV165.pendingPhoneStockListOffer = phoneOfferStaticV165.pendingPhoneStockListOffer || {};
const pendingPhoneOfferV165 = phoneOfferRemoteJidV165 ? phoneOfferStaticV165.pendingPhoneStockListOffer[phoneOfferRemoteJidV165] : null;
const pendingPhoneOfferActiveV165 = Boolean(pendingPhoneOfferV165?.expiresAt && Number(pendingPhoneOfferV165.expiresAt) > Date.now());
const phoneOfferConfirmedV165 = pendingPhoneOfferActiveV165 && (${isPhoneListConfirmationV165.toString()})(text);
if (pendingPhoneOfferV165 && (!pendingPhoneOfferActiveV165 || !phoneOfferConfirmedV165) && phoneOfferRemoteJidV165) {
  delete phoneOfferStaticV165.pendingPhoneStockListOffer[phoneOfferRemoteJidV165];
}
if (phoneOfferConfirmedV165 && phoneOfferRemoteJidV165) {
  delete phoneOfferStaticV165.pendingPhoneStockListOffer[phoneOfferRemoteJidV165];
}
const deterministicPhoneStockListDecisionV165 = phoneOfferConfirmedV165
  ? {
      acao: 'listar_catalogo',
      intencao: 'catalogo_smartphones_confirmado',
      produto_busca: 'smartphones',
      categoria_nome: 'smartphones',
      categoria_id: '${SMARTPHONES_CATEGORY_ID}',
      confianca: 1,
      motivo: 'Cliente confirmou que deseja receber a lista de celulares disponiveis.',
    }
  : null;`;

const productContextBlock = `${MARKER}
const unavailablePhoneOfferV165 = products.length === 0 && prefersSmartphones;
const phoneOfferRemoteJidV165 = String(base.remoteJid || $('switc Mensagens').first().json.remoteJid || '');
if (unavailablePhoneOfferV165 && phoneOfferRemoteJidV165) {
  const phoneOfferStaticV165 = $getWorkflowStaticData('global');
  phoneOfferStaticV165.pendingPhoneStockListOffer = phoneOfferStaticV165.pendingPhoneStockListOffer || {};
  phoneOfferStaticV165.pendingPhoneStockListOffer[phoneOfferRemoteJidV165] = {
    requestedText: String(base.productSearchOriginalText || base.conversation || '').trim(),
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
}
const unavailablePhoneGuidanceV165 = unavailablePhoneOfferV165 ? ${JSON.stringify(PHONE_OFFER_GUIDANCE)} : '';`;

const systemPolicy = `

OFERTA DE ALTERNATIVAS PARA CELULAR INDISPONIVEL (${MARKER}):
- Esta regra vale somente quando o contexto interno confirmar que o produto procurado e um celular ou smartphone indisponivel. Nao a aplique a fontes, acessorios, smartwatches, televisores ou outros produtos.
- Avise com suas proprias palavras que um especialista vai conferir o modelo e que a loja retornara quando houver confirmacao.
- Pergunte naturalmente se, enquanto aguarda, o cliente quer receber a lista dos celulares disponiveis em estoque.
- Nao envie a lista antes da confirmacao do cliente. O fluxo enviara o catalogo real quando ele responder afirmativamente.
- Quando houver "Saudacao pendente: sim" no contexto, a primeira mensagem deve comecar exatamente com [[SAUDACAO]]. Se o nome estiver disponivel, use-o depois do marcador de forma natural. Nunca substitua o marcador por "Oi".`;

function patchWorkflow(nodes) {
  const resolver = nodeByName(nodes, 'Resolver Acao de Conversacao');
  let resolverCode = String(resolver.parameters?.jsCode || '');
  if (!resolverCode.includes(MARKER)) {
    const insertionPoint = '// fiscal-document-ai-guidance-v164';
    if (!resolverCode.includes(insertionPoint)) throw new Error('Resolver insertion point not found');
    resolverCode = resolverCode.replace(insertionPoint, `${resolverBlock}\n${insertionPoint}`);
    const decisionMatch = resolverCode.match(/^const decision = (.+);$/m);
    if (!decisionMatch) throw new Error('Resolver decision line not found');
    resolverCode = resolverCode.replace(decisionMatch[0], `const decision = deterministicPhoneStockListDecisionV165 || ${decisionMatch[1]};`);
  }
  const oldConfirmationLine = "  return /^(?:sim|s|quero|claro|pode|pode sim|pode mandar|pode enviar|manda|mande|me manda|me envie|envia|envie|por favor|sim por favor|quero sim)$/.test(normalized);";
  const expandedConfirmationLine = "  return /^(?:sim|s|sim por favor|sim quero|quero|quero sim|quero ver|quero receber|claro|pode|pode sim|pode mandar(?: a lista)?|pode enviar(?: a lista)?|manda(?: a lista)?|mande(?: a lista)?|me manda(?: a lista)?|me envie(?: a lista)?|envia(?: a lista)?|envie(?: a lista)?|por favor)$/.test(normalized);";
  if (resolverCode.includes(oldConfirmationLine)) resolverCode = resolverCode.replace(oldConfirmationLine, expandedConfirmationLine);
  if (!resolverCode.includes('deterministicPhoneStockListDecisionV165 ||')) throw new Error('Confirmed phone-list offer does not override generic routing');
  if (!resolverCode.includes('pode mandar(?: a lista)?')) throw new Error('Expanded phone-list confirmations are missing');
  new Function('$json', '$getWorkflowStaticData', resolverCode);
  resolver.parameters.jsCode = resolverCode;

  const productContext = nodeByName(nodes, 'Vendas - Contexto Produtos');
  let productCode = String(productContext.parameters?.jsCode || '');
  if (!productCode.includes(MARKER)) {
    const returnAnchor = "\nreturn [{\n  json: {\n    ...base,\n    productLookupSource:";
    if (!productCode.includes(returnAnchor)) throw new Error('Product-context final return anchor not found');
    productCode = productCode.replace(returnAnchor, `\n${productContextBlock}${returnAnchor}`);

    const oldGuidancePattern = /    stockAssistantContext: products\.length === 0 && prefersSmartphones\n      \? '[^']*'\n      : '',/;
    if (!oldGuidancePattern.test(productCode)) throw new Error('Old unavailable-phone guidance not found');
    productCode = productCode.replace(oldGuidancePattern,
      "    stockAssistantContext: unavailablePhoneGuidanceV165,\n    aiResponseGuidance: unavailablePhoneGuidanceV165 || String(base.aiResponseGuidance || ''),");
  }
  if (/O modelo procurado não está disponível agora\. Responda de forma natural/.test(productCode)) throw new Error('Old incomplete phone guidance remains');
  new Function('$json', '$input', '$getWorkflowStaticData', '$', productCode);
  productContext.parameters.jsCode = productCode;

  const agent = nodeByName(nodes, 'Agente Geral - Atendimento');
  let agentText = String(agent.parameters?.text || '');
  if (!agentText.includes('Saudacao pendente: sim')) {
    const nameContext = "(($json.clienteNome ? 'Nome do cliente salvo: ' + $json.clienteNome + '.\\n' : '') + ($json.stockAssistantContext";
    const withGreeting = "(($json.clienteNome ? 'Nome do cliente salvo: ' + $json.clienteNome + '.\\n' : '') + ($json.saudacaoDetectada === true ? 'Saudacao pendente: sim. Comece a primeira mensagem exatamente com [[SAUDACAO]] e preserve o nome salvo, se houver.\\n' : '') + ($json.stockAssistantContext";
    if (!agentText.includes(nameContext)) throw new Error('General-agent greeting context insertion point not found');
    agentText = agentText.replace(nameContext, withGreeting);
  }
  agent.parameters.text = agentText;
  let systemMessage = String(agent.parameters?.options?.systemMessage || '');
  if (!systemMessage.includes(MARKER)) systemMessage += systemPolicy;
  agent.parameters.options = { ...(agent.parameters.options || {}), systemMessage };

  return nodes;
}

function summarize(nodes) {
  const resolver = nodeByName(nodes, 'Resolver Acao de Conversacao').parameters.jsCode;
  const product = nodeByName(nodes, 'Vendas - Contexto Produtos').parameters.jsCode;
  const agent = nodeByName(nodes, 'Agente Geral - Atendimento');
  const agentText = String(agent.parameters?.text || '');
  const system = String(agent.parameters?.options?.systemMessage || '');
  return {
    pendingOfferStored: product.includes('pendingPhoneStockListOffer[phoneOfferRemoteJidV165]'),
    phoneOnlyGate: product.includes('products.length === 0 && prefersSmartphones'),
    aiOwnWords: product.includes('unavailablePhoneGuidanceV165') && system.includes('com suas proprias palavras'),
    asksBeforeCatalog: system.includes('Nao envie a lista antes da confirmacao do cliente'),
    confirmationRoutesCatalog: resolver.includes('deterministicPhoneStockListDecisionV165 ||') && resolver.includes("acao: 'listar_catalogo'"),
    smartphoneCategory: resolver.includes(`categoria_id: '${SMARTPHONES_CATEGORY_ID}'`),
    pendingCleared: resolver.includes('delete phoneOfferStaticV165.pendingPhoneStockListOffer'),
    greetingPassedToAi: agentText.includes('Saudacao pendente: sim') && agentText.includes('[[SAUDACAO]]'),
    greetingRequired: system.includes('Nunca substitua o marcador por "Oi"'),
    oldGuidanceRemoved: !product.includes('O modelo procurado não está disponível agora. Responda de forma natural'),
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
  'markerCount', (length(we.nodes::text)-length(replace(we.nodes::text, 'unavailable-phone-offer-greeting-v165', '')))/length('unavailable-phone-offer-greeting-v165'),
  'pendingOfferPresent', we.nodes::text LIKE '%pendingPhoneStockListOffer%',
  'greetingContextPresent', we.nodes::text LIKE '%Saudacao pendente: sim%',
  'oldGuidanceRemoved', we.nodes::text NOT LIKE '%O modelo procurado não está disponível agora. Responda de forma natural%'
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

module.exports = { PHONE_OFFER_GUIDANCE, isPhoneListConfirmationV165, patchWorkflow, summarize };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
