const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const NODE_NAME = 'Parse Classificacao';
const MARKER = '// rapid-greeting-inheritance-v160';
const CATALOG_CONTINUATION_MARKER = '// rapid-catalog-continuation-v290';

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

const greetingLogic = `${MARKER}
const normalizeGreetingV160 = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\\u0300-\\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\\s]/g, ' ')
  .replace(/\\s+/g, ' ')
  .trim();
const pureGreetingV160 = (value) => /^(?:oi+|ola+|opa+|bom dia|boa tarde|boa noite)(?: tudo bem)?$/.test(normalizeGreetingV160(value));
const currentStartsWithGreetingV160 = /^(?:oi+|ola+|opa+|bom dia|boa tarde|boa noite)(?:\\b|$)/.test(normalizeGreetingV160(source.conversation));
const recentGreetingRowsV160 = Array.isArray(source.recentMessages) ? source.recentMessages : [];
const timestampV160 = (row) => {
  const value = Date.parse(String(row?.created_at || ''));
  return Number.isFinite(value) ? value : 0;
};
const latestInboundAtV160 = recentGreetingRowsV160.reduce((latest, row) =>
  String(row?.direction || '').toLowerCase() === 'inbound' ? Math.max(latest, timestampV160(row)) : latest, 0);
const latestOutboundAtV160 = recentGreetingRowsV160.reduce((latest, row) =>
  String(row?.direction || '').toLowerCase() === 'outbound' ? Math.max(latest, timestampV160(row)) : latest, 0);
const inheritedRapidGreetingV160 = latestInboundAtV160 > 0 && recentGreetingRowsV160.some((row) => {
  if (String(row?.direction || '').toLowerCase() !== 'inbound' || !pureGreetingV160(row?.text)) return false;
  const sentAt = timestampV160(row);
  return sentAt > latestOutboundAtV160 && sentAt <= latestInboundAtV160 && latestInboundAtV160 - sentAt <= 3 * 60 * 1000;
});

${CATALOG_CONTINUATION_MARKER}
const currentCatalogContinuationV290 = normalizeGreetingV160(source.conversation);
const shortCatalogContinuationV290 = /^(?:pra mim acessar|para mim acessar|manda ai|mande ai|pode mandar|manda|mande|pode enviar|envia ai|envie ai|sim|certo|isso)$/.test(currentCatalogContinuationV290);
const rapidCatalogRequestRowsV290 = recentGreetingRowsV160
  .filter((row) => String(row?.direction || '').toLowerCase() === 'inbound')
  .filter((row) => {
    const text = normalizeGreetingV160(row?.text);
    return /(?:lista|grade|catalogo).{0,60}(?:celular|celulares|smartphone|smartphones)|(?:celular|celulares|smartphone|smartphones).{0,60}(?:lista|grade|catalogo)|(?:celular|celulares).{0,30}(?:que tem|disponiveis|estoque)/.test(text);
  });
const latestRapidCatalogRequestV290 = rapidCatalogRequestRowsV290.reduce((latest, row) =>
  timestampV160(row) > timestampV160(latest) ? row : latest, null);
const rapidCatalogRequestAtV290 = timestampV160(latestRapidCatalogRequestV290);
const outboundCatalogAfterRequestV290 = rapidCatalogRequestAtV290 > 0 && recentGreetingRowsV160.some((row) => {
  if (String(row?.direction || '').toLowerCase() !== 'outbound' || timestampV160(row) <= rapidCatalogRequestAtV290) return false;
  const text = normalizeGreetingV160(row?.text);
  return /(?:catalogo smartphones|orcamento).{0,80}(?:redmi|poco|realme|iphone|smartphone)|(?:redmi|poco|realme|iphone).{0,80}(?:r\$|pix|cartao)/.test(text);
});
const rapidCatalogContinuationV290 = shortCatalogContinuationV290
  && rapidCatalogRequestAtV290 > 0
  && latestInboundAtV160 >= rapidCatalogRequestAtV290
  && latestInboundAtV160 - rapidCatalogRequestAtV290 <= 3 * 60 * 1000
  && !outboundCatalogAfterRequestV290;`;

const catalogContinuationMigrationLogic = greetingLogic.slice(
  greetingLogic.indexOf(CATALOG_CONTINUATION_MARKER),
);

function patchWorkflow(nodes) {
  const node = nodeByName(nodes, NODE_NAME);
  let code = String(node.parameters?.jsCode || '');
  if (!code.includes(MARKER)) {
    const insertionPoint = "const fluxoVenda = parsed?.fluxo_venda && typeof parsed.fluxo_venda === 'object' && !Array.isArray(parsed.fluxo_venda) ? parsed.fluxo_venda : {};";
    if (!code.includes(insertionPoint)) throw new Error('Parse classification insertion point not found');
    code = code.replace(insertionPoint, `${insertionPoint}\n\n${greetingLogic}`);
  }
  if (!code.includes(CATALOG_CONTINUATION_MARKER)) {
    const catalogInsertionPoint = code.includes('// first-contact-cordiality-v227')
      ? '// first-contact-cordiality-v227'
      : 'return [{';
    if (!code.includes(catalogInsertionPoint)) throw new Error('Catalog continuation insertion point not found');
    code = code.replace(catalogInsertionPoint, `${catalogContinuationMigrationLogic}\n\n${catalogInsertionPoint}`);
  }
  const oldField = 'saudacaoDetectada: parsed.saudacao_detectada === true,';
  const newField = 'saudacaoDetectada: parsed.saudacao_detectada === true || currentStartsWithGreetingV160 || inheritedRapidGreetingV160';
  if (code.includes(oldField)) code = code.replace(oldField, `${newField},`);
  if (!code.includes(newField)) throw new Error('Greeting inheritance output field not found');
  const catalogOutputReplacements = [
    ['intencao,', "intencao: rapidCatalogContinuationV290 ? 'vendas_produtos' : intencao,"],
    ["salesRequestKind: String(venda.tipo || '').trim(),", "salesRequestKind: rapidCatalogContinuationV290 ? 'categoria' : String(venda.tipo || '').trim(),"],
    ["salesSearchQuery: String(venda.busca || '').trim(),", "salesSearchQuery: rapidCatalogContinuationV290 ? '' : String(venda.busca || '').trim(),"],
    ["salesCategoryName: String(venda.categoria || '').trim(),", "salesCategoryName: rapidCatalogContinuationV290 ? 'smartphones' : String(venda.categoria || '').trim(),"],
    ["salesCategoryId: String(venda.categoria_id || '').trim(),", "salesCategoryId: rapidCatalogContinuationV290 ? '8b7c4852-c195-4527-8fd7-c3cc2debda42' : String(venda.categoria_id || '').trim(),"],
  ];
  for (const [oldOutput, newOutput] of catalogOutputReplacements) {
    if (!code.includes(newOutput) && code.includes(oldOutput)) code = code.replace(oldOutput, newOutput);
    if (!code.includes(newOutput)) throw new Error(`Catalog continuation output field not found: ${oldOutput.trim()}`);
  }
  new Function(code);
  node.parameters.jsCode = code;
  return nodes;
}
function summarize(nodes) {
  const code = nodeByName(nodes, NODE_NAME).parameters.jsCode;
  return {
    marker: code.includes(MARKER),
    currentGreetingDetected: code.includes('currentStartsWithGreetingV160'),
    unansweredHistoryGreetingDetected: code.includes('inheritedRapidGreetingV160'),
    boundedToThreeMinutes: code.includes('3 * 60 * 1000'),
    requiresAfterLastOutbound: code.includes('sentAt > latestOutboundAtV160'),
    oldFieldRemoved: !code.includes('saudacaoDetectada: parsed.saudacao_detectada === true,'),
    rapidCatalogContinuation: code.includes(CATALOG_CONTINUATION_MARKER),
    catalogContinuationBounded: code.includes('latestInboundAtV160 - rapidCatalogRequestAtV290 <= 3 * 60 * 1000'),
    requiresCatalogNotSent: code.includes('!outboundCatalogAfterRequestV290'),
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
  'marker', we.nodes::text LIKE '%rapid-greeting-inheritance-v160%',
  'oldFieldRemoved', we.nodes::text NOT LIKE '%saudacaoDetectada: parsed.saudacao_detectada === true,%'
)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());
    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    const services = await serviceMap(conn);
    console.log(JSON.stringify({
      apply: true,
      ...result,
      ...summary,
      services: { n8n: services.n8n_n8n, runner: services['n8n_n8n-runner'], evolution: services['n8n_evolution-api'] },
    }, null, 2));
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

module.exports = { patchWorkflow, summarize, CATALOG_CONTINUATION_MARKER };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
