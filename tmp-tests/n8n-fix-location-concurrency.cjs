const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const API_URL = 'https://api.xiaomipetrolina.com.br';
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
function psql(conn, dbContainer, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
      if (error) return reject(error);
      let stdout = ''; let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
      stream.end(sql);
    });
  });
}
async function waitServiceReplicas(conn, serviceName, expected, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await runRemote(conn, `docker service ls --filter name=${shQuote(serviceName)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timeout waiting for ${serviceName}=${expected}/${expected}`);
}
function readJson(conn, dbContainer, sql) {
  return psql(conn, dbContainer, `COPY (${sql}) TO STDOUT;`).then((value) => JSON.parse(value.trim()));
}

const storeLocationCode = `const source = $('Parse Classificacao').first().json || $json || {};
const company = $json || {};
const address = String(company.address || '').trim();
const lat = company.address_lat == null ? '' : String(company.address_lat).trim();
const lng = company.address_lng == null ? '' : String(company.address_lng).trim();
const hasCoords = lat && lng && lat !== '0' && lng !== '0';
const query = hasCoords ? (lat + ',' + lng) : address;
const mapsLink = query ? 'https://maps.google.com/?q=' + encodeURIComponent(query) : '';
const lines = [
  'A loja fica neste endereco:',
  address || 'Endereco nao cadastrado no sistema.',
  mapsLink ? 'Localizacao no mapa: ' + mapsLink : '',
  'Quando vier, e so chamar por aqui se precisar de ajuda. 📍',
].filter(Boolean);
return [{ json: { ...source, output: lines.join('||') } }];`;

const applyCurrentMessageCode = `const checks = $input.all();
const originals = $('Dividir mensagens').all();
return originals
  .filter((item, index) => checks[index]?.json?.isCurrent !== false)
  .map((item) => ({ json: item.json }));`;

function addOrReplaceNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}

function patchClassifier(nodes) {
  const classifier = nodes.find((node) => node.name === 'Agente Inicial - Classificador');
  const parse = nodes.find((node) => node.name === 'Parse Classificacao');
  if (!classifier || !parse) throw new Error('Classifier nodes not found');

  let system = String(classifier.parameters?.options?.systemMessage || '');
  if (!system.includes('- localizacao_loja')) {
    system = system.replace('- pedido_humano\n', '- pedido_humano\n- localizacao_loja\n');
  }
  if (!system.includes('onde fica, endereco, localizacao, mapa ou rota da loja')) {
    system += '\n- Perguntas sobre onde fica, endereco, localizacao, mapa ou rota da loja: localizacao_loja. Nunca classifique esse pedido como pedido_humano.\n';
  }
  classifier.parameters.options.systemMessage = system;

  let code = String(parse.parameters?.jsCode || '');
  code = code.replace(/const allowed = new Set\(\[([^\]]*)\]\);/, (match, values) => {
    if (values.includes('localizacao_loja')) return match;
    return `const allowed = new Set([${values}, 'localizacao_loja']);`;
  });
  if (!code.includes('storeLocationIntentV129')) {
    code = code.replace(
      /const intencao = allowed\.has\(String\(parsed\.intencao \|\| ''\)\.trim\(\)\) \? String\(parsed\.intencao\)\.trim\(\) : 'fallback';/,
      `const storeLocationNormalizedV129 = String(source.conversation || '')
  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\s+/g, ' ').trim();
const storeLocationIntentV129 = /\\b(onde fica|onde e|qual (e|eh) o endereco|me passa|manda|passa).{0,30}\\b(endereco|localizacao|mapa|rota)\\b|\\b(endereco|localizacao|mapa|rota) da loja\\b/.test(storeLocationNormalizedV129);
const intencao = storeLocationIntentV129
  ? 'localizacao_loja'
  : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback');`,
    );
  }
  if (!code.includes('storeLocationIntentV129')) throw new Error('Could not patch deterministic store location classification');
  new Function('$json', code);
  parse.parameters.jsCode = code;
}

function patchResolver(nodes) {
  const resolver = nodes.find((node) => node.name === 'Resolver Acao de Conversacao');
  if (!resolver?.parameters?.jsCode) throw new Error('Resolver Acao de Conversacao not found');
  let code = String(resolver.parameters.jsCode);
  code = code.replace(/const allowedActions = new Set\(\[([^\]]*)\]\);/, (match, values) => {
    if (values.includes('consultar_localizacao_loja')) return match;
    return `const allowedActions = new Set([${values},'consultar_localizacao_loja']);`;
  });
  if (!code.includes('deterministicStoreLocationV129')) {
    code = code.replace(
      'const allowedActions = new Set(',
      `const normalizedStoreLocationV129 = normalize(text);
const deterministicStoreLocationV129 = /\\b(onde fica|onde e|qual e o endereco|qual eh o endereco|me passa|manda|passa).{0,30}\\b(endereco|localizacao|mapa|rota)\\b|\\b(endereco|localizacao|mapa|rota) da loja\\b/.test(normalizedStoreLocationV129)
  ? { acao: 'consultar_localizacao_loja', intencao: 'localizacao_loja', confianca: 1, motivo: 'Pedido deterministico de endereco ou localizacao da loja.' }
  : null;

const allowedActions = new Set(`,
    );
    code = code.replace(
      'const decision = parsed && allowedActions.has(String(parsed.acao || \'\')) ? parsed : (legacy || fallbackDecision());',
      'const decision = deterministicStoreLocationV129 || (parsed && allowedActions.has(String(parsed.acao || \'\')) ? parsed : (legacy || fallbackDecision()));',
    );
  }
  if (!code.includes('deterministicStoreLocationV129 ||')) throw new Error('Could not prioritize deterministic store location action');
  new Function('$json', code);
  resolver.parameters.jsCode = code;
}

function ensureStoreLocationRoute(nodes, connections) {
  addOrReplaceNode(nodes, {
    id: 'store-location-company-settings-001',
    name: 'Loja - Buscar Dados Empresa',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [2080, 176],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    continueOnFail: true, onError: 'continueRegularOutput', alwaysOutputData: true,
    parameters: { url: `${API_URL}/public/company-settings`, options: {} },
  });
  addOrReplaceNode(nodes, {
    id: 'store-location-specialist-001', name: 'Loja - Localizacao',
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [2320, 176],
    parameters: { jsCode: storeLocationCode },
  });
  new Function('$json', storeLocationCode);

  const switchNode = nodes.find((node) => node.name === 'Switch Especialistas');
  const values = switchNode?.parameters?.rules?.values;
  const main = connections['Switch Especialistas']?.main;
  if (!Array.isArray(values) || !Array.isArray(main)) throw new Error('Switch Especialistas rules/connections not found');
  let index = values.findIndex((rule) => rule.outputKey === 'localizacao_loja' || JSON.stringify(rule).includes('consultar_localizacao_loja'));
  if (index < 0) {
    values.push({
      outputKey: 'localizacao_loja', renameOutput: true,
      conditions: {
        options: { version: 3, leftValue: '', caseSensitive: true, typeValidation: 'strict' }, combinator: 'and',
        conditions: [{
          id: 'action-localizacao-loja-v129',
          operator: { type: 'string', operation: 'equals' },
          leftValue: '={{$json.conversationAction}}', rightValue: 'consultar_localizacao_loja',
        }],
      },
    });
    index = values.length - 1;
  }
  while (main.length < values.length) main.push([]);
  main[index] = [{ node: 'Loja - Buscar Dados Empresa', type: 'main', index: 0 }];
  connections['Switch Especialistas'] = { main };
  connections['Loja - Buscar Dados Empresa'] = { main: [[{ node: 'Loja - Localizacao', type: 'main', index: 0 }]] };
  connections['Loja - Localizacao'] = { main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]] };
}

function patchSplitterAndStaleGuard(nodes, connections) {
  const splitter = nodes.find((node) => node.name === 'Dividir mensagens');
  if (!splitter?.parameters?.jsCode) throw new Error('Dividir mensagens not found');
  let code = String(splitter.parameters.jsCode);
  if (!code.includes('inboundWaMessageId')) {
    code = code.replace(
      'const instancia = $json.Instancia || $json.instancia || source.Instancia || contact.Instancia;',
      "const instancia = $json.Instancia || $json.instancia || source.Instancia || contact.Instancia;\nconst inboundWaMessageId = String($json.messageId || source.messageId || contact.messageId || prepared.messageId || '').trim();",
    );
    code = code.replace('remoteJid, instancia } });', 'remoteJid, instancia, inboundWaMessageId } });');
  }
  if (!code.includes('const suffix = shouldInviteName')) {
    code = code.replace('const prefix = shouldInviteName ? [nameInvitation] : [];', 'const suffix = shouldInviteName ? [nameInvitation] : [];');
    code = code.replace('const messages = [...prefix, ...$json.messages.filter', 'const messages = [...$json.messages.filter');
    code = code.replace('message.mediaUrl))];', 'message.mediaUrl)), ...suffix];');
    code = code.replace('return [...prefix, ...parts].map(toItem);', 'return [...parts, ...suffix].map(toItem);');
  }
  if (!code.includes('inboundWaMessageId') || !code.includes('const suffix = shouldInviteName')) throw new Error('Could not patch splitter');
  new Function('$json', code);
  splitter.parameters.jsCode = code;

  addOrReplaceNode(nodes, {
    id: 'n8n-current-message-check-001', name: 'Controle Bot - Verificar mensagem atual',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1392, 80],
    onError: 'continueRegularOutput', continueOnFail: true, retryOnFail: true, maxTries: 2, waitBetweenTries: 500,
    parameters: {
      url: `={{'${API_URL}/n8n-bot/messages/is-current?remoteJid=' + encodeURIComponent($json.remoteJid) + '&waMessageId=' + encodeURIComponent($json.inboundWaMessageId || '')}}`,
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'x-sync-key', value: '={{$env.SYNC_SECRET}}' }] },
      options: {},
    },
  });
  addOrReplaceNode(nodes, {
    id: 'n8n-current-message-apply-001', name: 'Controle Bot - Aplicar mensagem atual',
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [1536, 80],
    parameters: { jsCode: applyCurrentMessageCode },
  });
  new Function('$json', '$input', applyCurrentMessageCode);
  connections['Dividir mensagens'] = { main: [[{ node: 'Controle Bot - Verificar mensagem atual', type: 'main', index: 0 }]] };
  connections['Controle Bot - Verificar mensagem atual'] = { main: [[{ node: 'Controle Bot - Aplicar mensagem atual', type: 'main', index: 0 }]] };
  connections['Controle Bot - Aplicar mensagem atual'] = { main: [[{ node: 'Controle Bot - Registrar Saida', type: 'main', index: 0 }]] };
}

function patchContactResponse(nodes) {
  const node = nodes.find((item) => item.name === 'Contato - Resposta salvo');
  if (!node?.parameters?.jsCode) throw new Error('Contato - Resposta salvo not found');
  node.parameters.jsCode = String(node.parameters.jsCode)
    .split("$('Mensagem parece nome?').item.json").join("$('Contato - Preparar').first().json")
    .split("$('Mensagem parece nome?').first().json").join("$('Contato - Preparar').first().json");
  if (node.parameters.jsCode.includes("$('Mensagem parece nome?')")) throw new Error('Old contact response reference remains');
  new Function('$json', node.parameters.jsCode);
}

function patchWorkflow(nodes, connections) {
  patchClassifier(nodes);
  patchResolver(nodes);
  ensureStoreLocationRoute(nodes, connections);
  patchSplitterAndStaleGuard(nodes, connections);
  patchContactResponse(nodes);
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('n8n Postgres container not found');
    if (DRY_RUN) {
      const entity = await readJson(conn, db, `SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'))::text
        FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}`);
      const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
      const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
      patchWorkflow(nodes, connections);
      console.log(JSON.stringify({
        dryRun: true,
        locationAction: nodes.some((node) => String(node.parameters?.jsCode || '').includes('consultar_localizacao_loja')),
        staleGuard: nodes.some((node) => node.name === 'Controle Bot - Verificar mensagem atual'),
        contactReferenceFixed: !String(nodes.find((node) => node.name === 'Contato - Resposta salvo')?.parameters?.jsCode || '').includes("$('Mensagem parece nome?')"),
      }, null, 2));
      return;
    }
    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitServiceReplicas(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null'); await waitServiceReplicas(conn, 'n8n_n8n', 0); servicesStopped = true;
    const entity = await readJson(conn, db, `SELECT json_build_object(
      'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
      'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
      'activeVersionId', "activeVersionId")::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}`);
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes, connections);
    const sql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, connections=${dollar(JSON.stringify(connections), 'connections')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'hnodes')}::json, connections=${dollar(JSON.stringify(connections), 'hconnections')}::json, "updatedAt"=NOW() WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(entity.activeVersionId)};
COPY (SELECT json_build_object(
  'versionAligned', "versionId"="activeVersionId",
  'locationAction', nodes::text LIKE '%consultar_localizacao_loja%',
  'locationTarget', connections::text LIKE '%Loja - Buscar Dados Empresa%',
  'staleGuard', nodes::text LIKE '%Controle Bot - Verificar mensagem atual%',
  'nameAfterAnswer', nodes::text LIKE '%const suffix = shouldInviteName%',
  'oldContactReferenceRemoved', nodes::text NOT LIKE '%Mensagem parece nome?%item%'
)::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());
    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null'); await waitServiceReplicas(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitServiceReplicas(conn, 'n8n_n8n-runner', 1); servicesStopped = false;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitServiceReplicas(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); await waitServiceReplicas(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });
module.exports = { patchWorkflow, patchClassifier, patchResolver, patchSplitterAndStaleGuard, patchContactResponse };
