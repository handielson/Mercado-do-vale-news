const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MARKER = 'memory-context-confirmation-v319';
const APPLY = process.argv.includes('--apply');
const SELF_TEST = process.argv.includes('--self-test');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function quote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}
function run(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `remote command failed: ${code}`)));
  }));
}
function psql(connection, database, sql) {
  return new Promise((resolve, reject) => connection.exec(`docker exec -i ${quote(database)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
    stream.end(sql);
  }));
}
async function waitService(connection, service, expected, timeoutMs = 150000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await run(connection, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}
function nodeByName(nodes, name) {
  const node = nodes.find((item) => item?.name === name);
  assert.ok(node, `${name} not found`);
  return node;
}

const PROMPT_GUARD = `REGRA DE CONTEXTO APOS OCIOSIDADE (${MARKER}):
- Se a mensagem atual for apenas uma saudacao, cumprimente uma unica vez e pergunte como pode ajudar. Nao retome produto, foto, compra ou pergunta antiga sem o cliente mencionar o assunto novamente.
- O historico e apenas apoio; uma saudacao isolada nunca autoriza ressuscitar uma oferta anterior.
- Depois de [[SAUDACAO]], nao escreva novamente Bom dia, Boa tarde ou Boa noite na mesma mensagem.`;

function patchAgent(node) {
  let prompt = String(node.parameters?.options?.systemMessage || '');
  if (!prompt.includes(MARKER)) prompt = `${PROMPT_GUARD}\n\n${prompt}`;
  node.parameters.options.systemMessage = prompt;
}

function patchSplitter(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`// ${MARKER}-greeting`)) return;
  const anchor = `const normalizeContinuationGreeting = (value) => {\n  const normalized = normalizeGreetingPeriod(value);`;
  assert.ok(code.includes(anchor), 'continuation greeting normalizer anchor not found');
  const helper = `// ${MARKER}-greeting
const collapseRepeatedPeriodGreetingV319 = (value) => {
  const escapedGreetingV319 = String(currentGreeting).replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
  const repeatedGreetingV319 = new RegExp('^(' + escapedGreetingV319 + ')(\\\\s+[^\\\\n,.!?]{1,60})?\\\\s*,?\\\\s*' + escapedGreetingV319 + '(?=$|[\\\\s,.!?])', 'i');
  return String(value || '').replace(repeatedGreetingV319, '$1$2');
};
const normalizeContinuationGreeting = (value) => {
  const normalized = collapseRepeatedPeriodGreetingV319(normalizeGreetingPeriod(value));`;
  code = code.replace(anchor, () => helper);
  new Function(code);
  node.parameters.jsCode = code;
}

function patchPostList(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`// ${MARKER}-photo-confirmation`)) return;
  const outboundAnchor = `  const previousOutbound = [...(Array.isArray(source.recentMessages) ? source.recentMessages : [])].reverse()
    .find((item) => String(item?.direction || '') === 'outbound');
  const followsPhotoNumberPrompt =`;
  assert.ok(code.includes(outboundAnchor), 'previous outbound anchor not found');
  const offerContext = `  const previousOutbound = [...(Array.isArray(source.recentMessages) ? source.recentMessages : [])].reverse()
    .find((item) => String(item?.direction || '') === 'outbound');
  // ${MARKER}-photo-confirmation
  const previousOutboundTextV319 = String(previousOutbound?.text || '').trim();
  const affirmativePhotoConfirmationV319 = /^(?:sim|sim por favor|pode|pode sim|quero|manda|manda sim|envia|envia sim|isso)$/i.test(normalized)
    && /(?:quer que eu .*envie|posso .*enviar|posso .*mandar).*foto/i.test(normalize(previousOutboundTextV319));
  const offeredPhotoMatchV319 = affirmativePhotoConfirmationV319
    ? previousOutboundTextV319.match(/\\bfoto\\s+(?:do|da|de)\\s+(.+?)(?:\\?|$)/i)
    : null;
  const offeredProductTextV319 = String(offeredPhotoMatchV319?.[1] || '').trim();
  const offeredMemoryMatchV319 = offeredProductTextV319.match(/(\\d+)\\s*gb\\s*[\\/+]\\s*(\\d+)\\s*gb/i);
  const offeredRamV319 = Number(offeredMemoryMatchV319?.[1] || 0);
  const offeredStorageV319 = Number(offeredMemoryMatchV319?.[2] || 0);
  const offeredColorsV319 = ['preto', 'branco', 'verde', 'azul', 'dourado', 'prata', 'roxo', 'rosa', 'cinza', 'amarelo', 'laranja', 'vermelho', 'lilas', 'rose', 'vinho'];
  const normalizedOfferV319 = normalize(offeredProductTextV319);
  const offeredColorV319 = offeredColorsV319.find((color) => new RegExp('(?:^|\\\\s)' + color + '$').test(normalizedOfferV319)) || '';
  const offeredModelQueryV319 = normalize(offeredProductTextV319)
    .replace(/\\b\\d+\\s*gb(?:\\s*[\\/+ ]\\s*)\\d+\\s*gb\\b/g, ' ')
    .replace(offeredColorV319 ? new RegExp('\\\\b' + offeredColorV319 + '\\\\b', 'g') : /$^/, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
  const effectiveQueryV319 = classifiedQuery || offeredModelQueryV319;
  const followsPhotoNumberPrompt =`;
  code = code.replace(outboundAnchor, () => offerContext);

  code = code.replace(
    `  const requestedColor = normalize(aiColor);`,
    `  const requestedColor = normalize(aiColor || offeredColorV319);`,
  );
  code = code.replace(
    `  const searchWords = normalize(classifiedQuery).split(/\\s+/).filter((word) => word && !ignoredWords.has(word));`,
    `  const searchWords = normalize(effectiveQueryV319).split(/\\s+/).filter((word) => word && !ignoredWords.has(word));`,
  );
  code = code.replace(
    `&category_id=' + encodeURIComponent(SMARTPHONES_CATEGORY_ID_V289) + '&search=`,
    `&category=' + encodeURIComponent(SMARTPHONES_CATEGORY_ID_V289) + '&search=`,
  );
  const candidateAnchor = `      const productColor = normalize(product?.specs?.color || product?.specs?.cor || product?.color);
      if (requestedColor && productColor !== requestedColor) return false;`;
  assert.ok(code.includes(candidateAnchor), 'candidate color anchor not found');
  code = code.replace(candidateAnchor, `${candidateAnchor}
      const productRamV319 = Number(String(product?.specs?.ram || '').match(/\\d+/)?.[0] || 0);
      const productStorageV319 = Number(String(product?.specs?.storage || '').match(/\\d+/)?.[0] || 0);
      if (offeredRamV319 && productRamV319 !== offeredRamV319) return false;
      if (offeredStorageV319 && productStorageV319 !== offeredStorageV319) return false;`);
  code = code.replace(
    `      name: product?.name || classifiedQuery || 'Produto',`,
    `      name: product?.name || effectiveQueryV319 || 'Produto',`,
  );
  for (const required of [
    `${MARKER}-photo-confirmation`,
    'affirmativePhotoConfirmationV319',
    'offeredRamV319',
    "&category=' + encodeURIComponent(SMARTPHONES_CATEGORY_ID_V289)",
  ]) assert.ok(code.includes(required), `${required} missing from patched post-list node`);
  new AsyncFunction('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', code);
  node.parameters.jsCode = code;
}

function patchWorkflow(nodes) {
  const cloned = structuredClone(nodes);
  patchAgent(nodeByName(cloned, 'Agente Geral - Atendimento'));
  patchSplitter(nodeByName(cloned, 'Dividir mensagens'));
  patchPostList(nodeByName(cloned, 'Vendas - Verificar Pos Lista'));
  return cloned;
}

async function runSelfTest(nodes) {
  const postListCode = nodeByName(nodes, 'Vendas - Verificar Pos Lista').parameters.jsCode;
  const blueprint = 'https://api.xiaomipetrolina.com.br/images/products/blueprints/realme-note-70.png';
  const photo = 'https://api.xiaomipetrolina.com.br/images/model-color/realme-note-70-preto.jpg';
  const product = {
    id: 'fixture-product', category_id: '8b7c4852-c195-4527-8fd7-c3cc2debda42',
    name: 'Realme Note 70', sku: 'FIXTURE', status: 'active', stock_quantity: 2, track_inventory: 1,
    slug: 'realme-note-70-fixture', specs: { ram: '4GB', storage: '256GB', color: 'Preto', keywords: ['realme note 70'] },
    images: [photo], resolved_images: [photo], model_color_images: [photo], blueprint_image_url: blueprint,
  };
  const requestUrls = [];
  const result = await new AsyncFunction('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', postListCode)(
    {
      remoteJid: 'fixture@s.whatsapp.net', conversation: 'sim', salesFlowAction: 'pedir_foto',
      recentMessages: [{ direction: 'outbound', text: 'Quer que eu te envie a foto do Realme Note 70 4GB/256GB preto? Estou aqui para ajudar!' }],
    },
    {},
    () => ({}),
    () => ({ first: () => ({ json: {} }), all: () => [] }),
    {},
    { httpRequest: async (options) => { requestUrls.push(options.url); return [product]; } },
  );
  assert.match(requestUrls[0], /category=8b7c4852/);
  assert.match(requestUrls[0], /search=realme%20note%2070/);
  if (result?.[0]?.json?.salesPostListStep !== 'photo_recovered_without_list') {
    throw new Error(`unexpected self-test result: ${JSON.stringify({ requestUrls, result })}`);
  }
  assert.equal(result[0].json.salesPostListStep, 'photo_recovered_without_list');
  assert.equal(result[0].json.messages[0].mediaUrl, blueprint);
  assert.equal(result[0].json.messages[1].mediaUrl, photo);
  return { requestUrlUsesCategory: true, confirmationRecovered: true, blueprintFirst: true, realPhotoSecond: true };
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const database = (await run(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!database) throw new Error('n8n database container not found');
    const raw = await psql(connection, database, `COPY (
      SELECT json_build_object(
        'nodesHex', encode(convert_to(we.nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(we.connections::text, 'UTF8'), 'hex'),
        'activeVersionId', we."activeVersionId",
        'active', we.active,
        'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb
      )::text
      FROM workflow_entity we
      JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId"
      WHERE we.id=${quote(WORKFLOW_ID)}
    ) TO STDOUT;`);
    const workflow = JSON.parse(raw.trim());
    const originalNodes = JSON.parse(Buffer.from(workflow.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(workflow.connectionsHex, 'hex').toString('utf8'));
    const patchedNodes = patchWorkflow(originalNodes);
    const changed = JSON.stringify(originalNodes) !== JSON.stringify(patchedNodes);
    const selfTest = SELF_TEST ? await runSelfTest(patchedNodes) : null;
    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, active: workflow.active, entityHistoryEqual: workflow.entityHistoryEqual, changed, codeCompiles: true, selfTest }, null, 2));
      return;
    }

    const activeExecutions = Number((await psql(connection, database, `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());
    assert.equal(activeExecutions, 0, 'workflow has active executions; refusing update');
    const backupPath = path.join(os.tmpdir(), `n8n-workflow-${WORKFLOW_ID}-before-${MARKER}-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ workflowId: WORKFLOW_ID, activeVersionId: workflow.activeVersionId, nodes: originalNodes, connections }, null, 2), { flag: 'wx' });
    await run(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(connection, 'n8n_n8n-runner', 0);
    await run(connection, 'docker service scale n8n_n8n=0 >/dev/null'); await waitService(connection, 'n8n_n8n', 0); servicesStopped = true;
    const sql = `\\set ON_ERROR_STOP on
BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(patchedNodes), 'nodes')}::json, connections=${dollar(JSON.stringify(connections), 'connections')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(patchedNodes), 'hnodes')}::json, connections=${dollar(JSON.stringify(connections), 'hconnections')}::json, "updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(workflow.activeVersionId)};
COMMIT;
COPY (SELECT json_build_object('entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb, 'markerPresent', we.nodes::text LIKE '%${MARKER}%')::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(connection, database, sql)).trim());
    await run(connection, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(connection, 'n8n_n8n', 1);
    await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(connection, 'n8n_n8n-runner', 1); servicesStopped = false;
    const health = (await run(connection, 'curl -fsS https://n8n.mercadodovale.com.br/healthz')).trim();
    console.log(JSON.stringify({ apply: true, changed, codeCompiles: true, selfTest, health, backupPath, ...result }, null, 2));
  } finally {
    if (servicesStopped) {
      await run(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitService(connection, 'n8n_n8n', 1).catch(() => {});
      await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

module.exports = { MARKER, patchWorkflow, patchAgent, patchSplitter, patchPostList, runSelfTest };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
