const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = '// used-phone-policy-v161';

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

const detectorBlock = `${MARKER}
const usedPolicyNormalizedV161 = String(source.conversation || '')
  .normalize('NFD')
  .replace(/[\\u0300-\\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\\s]/g, ' ')
  .replace(/\\s+/g, ' ')
  .trim();
const usedDescriptorV161 = /\\b(?:usad[oa]s?|seminov[oa]s?|semi nov[oa]s?)\\b/.test(usedPolicyNormalizedV161);
const deviceMentionV161 = /\\b(?:celular|celulares|aparelho|aparelhos|smartphone|smartphones|telefone|telefones|iphone|iphones|galaxy|xiaomi|redmi|samsung|motorola)\\b/.test(usedPolicyNormalizedV161);
const usedCommerceQuestionV161 = usedDescriptorV161 && (
  (deviceMentionV161 && /\\b(?:compra|compram|compramos|pega|pegam|aceita|aceitam|vende|vendem|tem|possui|trabalha|trabalham)\\b/.test(usedPolicyNormalizedV161))
  || (deviceMentionV161 && usedPolicyNormalizedV161.split(' ').length <= 4)
  || /\\bnov[oa]s?\\b.{0,30}\\busad[oa]s?\\b|\\busad[oa]s?\\b.{0,30}\\bnov[oa]s?\\b/.test(usedPolicyNormalizedV161)
);
const deviceTradeInQuestionV161 = deviceMentionV161 && (
  /\\b(?:como|de|da|na|por) entrada\\b/.test(usedPolicyNormalizedV161)
  || /\\btroca com entrada\\b/.test(usedPolicyNormalizedV161)
  || /\\b(?:como|de|da|na|por) troca\\b/.test(usedPolicyNormalizedV161)
  || /\\b(?:abate|abater|desconta|descontar)\\b/.test(usedPolicyNormalizedV161)
);
const usedPhonePolicyIntentV161 = usedCommerceQuestionV161 || deviceTradeInQuestionV161;`;

const paymentDetectorBlock = `${MARKER}
  const usedDescriptorV161 = /\\b(?:usad[oa]s?|seminov[oa]s?|semi nov[oa]s?)\\b/.test(normalized);
  const deviceMentionV161 = /\\b(?:celular|celulares|aparelho|aparelhos|smartphone|smartphones|telefone|telefones|iphone|iphones|galaxy|xiaomi|redmi|samsung|motorola)\\b/.test(normalized);
  const usedCommerceQuestionV161 = usedDescriptorV161 && (
    (deviceMentionV161 && /\\b(?:compra|compram|compramos|pega|pegam|aceita|aceitam|vende|vendem|tem|possui|trabalha|trabalham)\\b/.test(normalized))
    || (deviceMentionV161 && normalized.trim().split(/\\s+/).length <= 4)
    || /\\bnov[oa]s?\\b.{0,30}\\busad[oa]s?\\b|\\busad[oa]s?\\b.{0,30}\\bnov[oa]s?\\b/.test(normalized)
  );
  const deviceTradeInQuestionV161 = deviceMentionV161 && (
    /\\b(?:como|de|da|na|por) entrada\\b/.test(normalized)
    || /\\btroca com entrada\\b/.test(normalized)
    || /\\b(?:como|de|da|na|por) troca\\b/.test(normalized)
    || /\\b(?:abate|abater|desconta|descontar)\\b/.test(normalized)
  );
  const usedPhonePolicyV161 = usedCommerceQuestionV161 || deviceTradeInQuestionV161;

  if (usedPhonePolicyV161) {
    return [
      'No momento, trabalhamos somente com celulares novos. 😊',
      'Por isso, nao compramos aparelhos usados e tambem nao os aceitamos como entrada ou troca.',
    ].join('||');
  }`;

function patchWorkflow(nodes) {
  const parseNode = nodeByName(nodes, 'Parse Classificacao');
  let parseCode = String(parseNode.parameters?.jsCode || '');
  if (!parseCode.includes(MARKER)) {
    const insertionPoint = "const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'formas_pagamento', 'fallback', 'localizacao_loja']);";
    if (!parseCode.includes(insertionPoint)) throw new Error('Parse insertion point not found');
    parseCode = parseCode.replace(insertionPoint, `${insertionPoint}\n${detectorBlock}`);
    const oldIntent = `const intencao = storeLocationIntentV129
  ? 'localizacao_loja'
  : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback');`;
    const newIntent = `const intencao = usedPhonePolicyIntentV161
  ? 'formas_pagamento'
  : (storeLocationIntentV129
    ? 'localizacao_loja'
    : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback'));`;
    if (!parseCode.includes(oldIntent)) throw new Error('Parse intent block not found');
    parseCode = parseCode.replace(oldIntent, newIntent);
  }
  if (!parseCode.includes("const intencao = usedPhonePolicyIntentV161")) throw new Error('Used policy does not override classifier');
  new Function(parseCode);
  parseNode.parameters.jsCode = parseCode;

  const paymentNode = nodeByName(nodes, 'Pagamento - Politica');
  let paymentCode = String(paymentNode.parameters?.jsCode || '');
  const oldPolicy = `  if (/\\b(usado|usados|troca|entrada)\\b/.test(normalized) && !/\\b(dinheiro|pix|valor|r\\$|real|reais)\\b/.test(normalized)) {
    return [
      'A gente trabalha somente com produtos novos.',
      'Por isso nao aceitamos aparelho usado como entrada.',
      accepted,
    ].join('||');
  }`;
  if (!paymentCode.includes(MARKER)) {
    if (!paymentCode.includes(oldPolicy)) throw new Error('Old payment used policy not found');
    paymentCode = paymentCode.replace(oldPolicy, paymentDetectorBlock);
  }
  if (paymentCode.includes('Por isso nao aceitamos aparelho usado como entrada.')) throw new Error('Old incomplete used policy remains');
  new Function(paymentCode);
  paymentNode.parameters.jsCode = paymentCode;
  return nodes;
}

function summarize(nodes) {
  const parseCode = nodeByName(nodes, 'Parse Classificacao').parameters.jsCode;
  const paymentCode = nodeByName(nodes, 'Pagamento - Politica').parameters.jsCode;
  return {
    classifierMarker: parseCode.includes(MARKER),
    paymentMarker: paymentCode.includes(MARKER),
    deterministicRoute: parseCode.includes("usedPhonePolicyIntentV161\n  ? 'formas_pagamento'"),
    refusesBuyingUsed: paymentCode.includes('nao compramos aparelhos usados'),
    refusesTradeIn: paymentCode.includes('nao os aceitamos como entrada ou troca'),
    oldIncompletePolicyRemoved: !paymentCode.includes('Por isso nao aceitamos aparelho usado como entrada.'),
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
  'markerCount', (length(we.nodes::text)-length(replace(we.nodes::text, 'used-phone-policy-v161', '')))/length('used-phone-policy-v161'),
  'oldPolicyRemoved', we.nodes::text NOT LIKE '%Por isso nao aceitamos aparelho usado como entrada.%',
  'correctPolicyPresent', we.nodes::text LIKE '%nao compramos aparelhos usados e tambem nao os aceitamos como entrada ou troca%'
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

module.exports = { patchWorkflow, summarize };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
