const { Client } = require('ssh2');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dotenv = require('dotenv');
for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'mercado-do-vale')]) {
  dotenv.config({ path: path.join(root, '.env.vps.local'), quiet: true });
  dotenv.config({ path: path.join(root, '.env.local'), quiet: true });
}
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const TIME_ZONE = 'America/Recife';

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
  return new Promise((resolve, reject) => conn.exec(`docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
    stream.end(sql);
  }));
}
async function waitService(conn, service, expected, timeoutMs = 150000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await runRemote(conn, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
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
function replaceTimeZone(value) {
  if (typeof value === 'string') return value.replace(/America\/Sao_Paulo/g, TIME_ZONE);
  if (Array.isArray(value)) return value.map(replaceTimeZone);
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) value[key] = replaceTimeZone(child);
  }
  return value;
}

const productGreetingOld = `const greetingLine = (() => {
  if (base.saudacaoDetectada !== true) return '';
  const text = normalize(base.conversation || base.productSearchOriginalText || '');
  if (text.includes('bom dia')) return 'Bom dia! 😊';
  if (text.includes('boa tarde')) return 'Boa tarde! 😊';
  if (text.includes('boa noite')) return 'Boa noite! 😊';
  const hour = Number(new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife', hour: '2-digit', hour12: false }));
  if (hour >= 5 && hour < 12) return 'Bom dia! 😊';
  if (hour >= 12 && hour < 18) return 'Boa tarde! 😊';
  return 'Boa noite! 😊';
})();`;
const productGreetingNew = `const greetingLine = (() => {
  if (base.saudacaoDetectada !== true) return '';
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (hour >= 5 && hour < 12) return 'Bom dia! 😊';
  if (hour >= 12 && hour < 18) return 'Boa tarde! 😊';
  return 'Boa noite! 😊';
})();`;
const postListGreetingOld = `const periodGreeting = () => {
  if (source.saudacaoDetectada !== true) return '';
  if (normalized.includes('bom dia')) return 'Bom dia! 😊';
  if (normalized.includes('boa tarde')) return 'Boa tarde! 😊';
  if (normalized.includes('boa noite')) return 'Boa noite! 😊';
  const hour = Number(new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife', hour: '2-digit', hour12: false }));
  if (hour >= 5 && hour < 12) return 'Bom dia! 😊';
  if (hour >= 12 && hour < 18) return 'Boa tarde! 😊';
  return 'Boa noite! 😊';
};`;
const postListGreetingNew = `const periodGreeting = () => {
  if (source.saudacaoDetectada !== true) return '';
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (hour >= 5 && hour < 12) return 'Bom dia! 😊';
  if (hour >= 12 && hour < 18) return 'Boa tarde! 😊';
  return 'Boa noite! 😊';
};`;

const splitGreetingHelpers = `const GREETING_TIME_ZONE = 'America/Recife';
const currentGreetingHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: GREETING_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
const currentGreeting = currentGreetingHour >= 5 && currentGreetingHour < 12
  ? 'Bom dia'
  : (currentGreetingHour >= 12 && currentGreetingHour < 18 ? 'Boa tarde' : 'Boa noite');
const normalizeGreetingPeriod = (value) => String(value || '')
  .replace(/\\[\\[SAUDACAO\\]\\]\\s*(?:bom dia|boa tarde|boa noite)(?=$|[\\s,!\\.\\:;?\\-])/gi, '[[SAUDACAO]]')
  .replace(/\\[\\[SAUDACAO\\]\\]/gi, currentGreeting)
  .replace(/\\[\\[BR\\]\\]/gi, '\\n')
  .replace(/^(\\s*(?:(?:😊|👋|🙂|😀|😃|🤗)\\s*)?)(?:bom dia|boa tarde|boa noite)(?=$|[\\s,!\\.\\:;?\\-])/i, (_, prefix) => prefix + currentGreeting);`;

const greetingPlaceholderNormalizer = ".replace(/\\[\\[SAUDACAO\\]\\]/gi, currentGreeting)";
const duplicateGreetingGuard = ".replace(/\\[\\[SAUDACAO\\]\\]\\s*(?:bom dia|boa tarde|boa noite)(?=$|[\\s,!\\.\\:;?\\-])/gi, '[[SAUDACAO]]')";
const internalLineBreakNormalizer = ".replace(/\\[\\[BR\\]\\]/gi, '\\n')";

const oldToItem = "const toItem = (message, index, all) => ({ json: { message: message.text || message.caption || message, caption: message.caption || message.text || message, messageType: message.type === 'image' ? 'image' : 'text', mediaUrl: message.mediaUrl || '', mimetype: message.mimetype || (message.type === 'image' ? 'image/jpeg' : ''), fileName: message.fileName || 'produto.jpg', delayMs: Number(message.delayMs || 0), messageIndex: index + 1, totalMessages: all.length, remoteJid, instancia, inboundWaMessageId } });";
const newToItem = `const normalizeOutboundPayload = (rawMessage) => {
  if (!rawMessage || typeof rawMessage !== 'object') return normalizeGreetingPeriod(rawMessage);
  const normalizedText = normalizeGreetingPeriod(rawMessage.text || rawMessage.caption || '');
  return { ...rawMessage, text: normalizedText, caption: normalizedText };
};
const toItem = (rawMessage, index, all) => {
  const message = normalizeOutboundPayload(rawMessage);
  return { json: { message: message.text || message.caption || message, caption: message.caption || message.text || message, messageType: message.type === 'image' ? 'image' : 'text', mediaUrl: message.mediaUrl || '', mimetype: message.mimetype || (message.type === 'image' ? 'image/jpeg' : ''), fileName: message.fileName || 'produto.jpg', delayMs: Number(message.delayMs || 0), messageIndex: index + 1, totalMessages: all.length, remoteJid, instancia, inboundWaMessageId } };
};`;

function patchAgentPrompt(node) {
  let prompt = String(node.parameters?.options?.systemMessage || '');
  prompt = prompt.replace(
    /Ao iniciar uma conversa:\n- Entre 05:00 e 11:59, responda com uma saudação de bom dia\.\n- Entre 12:00 e 17:59, responda com uma saudação de boa tarde\.\n- Entre 18:00 e 04:59, responda com uma saudação de boa noite\.\n/,
    'Ao iniciar uma conversa:\n- Nao calcule nem escolha o periodo do dia. O sistema corrige a saudacao pelo horario oficial de Petrolina.\n- Quando precisar cumprimentar, comece a primeira mensagem exatamente com [[SAUDACAO]].\n',
  );
  prompt = prompt.replace(
    'A primeira mensagem deve ser obrigatoriamente a saudação do período. Nunca coloque a apresentação antes da saudação.',
    'A primeira mensagem deve começar exatamente com [[SAUDACAO]]. Nunca coloque a apresentação antes da saudação.',
  );
  prompt = prompt.replace(
    'Na saudacao inicial, crie as duas mensagens de forma natural a partir do contexto. Nao use texto-modelo fixo.',
    'Na saudacao inicial, use [[SAUDACAO]] e complete a frase de forma natural a partir do contexto.',
  );
  if (/Entre 05:00|Entre 12:00|Entre 18:00/.test(prompt)) throw new Error('Old AI time ranges remain');
  if (!prompt.includes('[[SAUDACAO]]')) throw new Error('Greeting placeholder missing from AI prompt');
  node.parameters.options.systemMessage = prompt;
}

function patchSplitNode(node) {
  let code = String(node.parameters?.jsCode || '');
  if (!code.includes("const GREETING_TIME_ZONE = 'America/Recife';")) {
    const marker = "const text = $json.output || $json.text || $json.response || '';";
    if (!code.includes(marker)) throw new Error('Split text marker not found');
    code = code.replace(marker, `${marker}\n${splitGreetingHelpers}`);
  }
  if (!code.includes(duplicateGreetingGuard)) {
    if (!code.includes(greetingPlaceholderNormalizer)) throw new Error('Greeting placeholder normalizer not found');
    code = code.replace(greetingPlaceholderNormalizer, `${duplicateGreetingGuard}\n  ${greetingPlaceholderNormalizer}`);
  }
  if (!code.includes(internalLineBreakNormalizer)) {
    if (!code.includes(greetingPlaceholderNormalizer)) throw new Error('Greeting normalizer marker not found');
    code = code.replace(
      greetingPlaceholderNormalizer,
      `${greetingPlaceholderNormalizer}\n  ${internalLineBreakNormalizer}`,
    );
  }
  if (code.includes(oldToItem)) code = code.replace(oldToItem, newToItem);
  if (!code.includes('const normalizeOutboundPayload =')) throw new Error('Split outbound normalizer missing');
  node.parameters.jsCode = code;
}

function patchWorkflow(nodes) {
  for (const node of nodes) node.parameters = replaceTimeZone(node.parameters || {});
  patchAgentPrompt(nodeByName(nodes, 'Agente Geral - Atendimento'));
  patchSplitNode(nodeByName(nodes, 'Dividir mensagens'));

  const productNode = nodeByName(nodes, 'Vendas - Contexto Produtos');
  if (productNode.parameters.jsCode.includes(productGreetingOld)) {
    productNode.parameters.jsCode = productNode.parameters.jsCode.replace(productGreetingOld, productGreetingNew);
  }
  if (!productNode.parameters.jsCode.includes("timeZone: 'America/Recife'")) throw new Error('Product greeting timezone not patched');
  if (productNode.parameters.jsCode.includes("text.includes('bom dia')")) throw new Error('Product greeting still trusts customer period');

  const postListNode = nodeByName(nodes, 'Vendas - Verificar Pos Lista');
  if (postListNode.parameters.jsCode.includes(postListGreetingOld)) {
    postListNode.parameters.jsCode = postListNode.parameters.jsCode.replace(postListGreetingOld, postListGreetingNew);
  }
  if (!postListNode.parameters.jsCode.includes("timeZone: 'America/Recife'")) throw new Error('Post-list greeting timezone not patched');
  if (postListNode.parameters.jsCode.includes("normalized.includes('bom dia')")) throw new Error('Post-list greeting still trusts customer period');

  for (const node of nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
    if (node.parameters?.jsCode) new Function(node.parameters.jsCode);
  }
  return nodes;
}

function summarize(nodes) {
  const allParameters = JSON.stringify(nodes.map((node) => node.parameters || {}));
  const agentPrompt = nodeByName(nodes, 'Agente Geral - Atendimento').parameters.options.systemMessage;
  const splitCode = nodeByName(nodes, 'Dividir mensagens').parameters.jsCode;
  const productCode = nodeByName(nodes, 'Vendas - Contexto Produtos').parameters.jsCode;
  const postListCode = nodeByName(nodes, 'Vendas - Verificar Pos Lista').parameters.jsCode;
  return {
    timezone: TIME_ZONE,
    legacyTimezoneRemoved: !allParameters.includes('America/Sao_Paulo'),
    aiTimeRangesRemoved: !/Entre 05:00|Entre 12:00|Entre 18:00/.test(agentPrompt),
    aiUsesGreetingPlaceholder: agentPrompt.includes('[[SAUDACAO]]'),
    centralNormalizer: splitCode.includes('const normalizeGreetingPeriod ='),
    centralNormalizerUsesRecife: splitCode.includes("const GREETING_TIME_ZONE = 'America/Recife';"),
    internalLineBreakNormalizer: splitCode.includes(internalLineBreakNormalizer),
    productIgnoresCustomerPeriod: !productCode.includes("text.includes('bom dia')"),
    postListIgnoresCustomerPeriod: !postListCode.includes("normalized.includes('bom dia')"),
  };
}

async function readServiceMap(conn) {
  const output = await runRemote(conn, "docker service ls --filter name=n8n --format '{{.Name}} {{.Replicas}}'");
  return Object.fromEntries(output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.trim().split(/\s+/)));
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('n8n Postgres container not found');
    const raw = await psql(conn, db, `COPY (SELECT json_build_object('nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'), 'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'), 'activeVersionId', \"activeVersionId\")::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes);
    const summary = summarize(nodes);
    if (!APPLY) return console.log(JSON.stringify({ apply: false, ...summary }, null, 2));

    const backupPath = path.join(os.tmpdir(), `n8n-workflow-${WORKFLOW_ID}-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({
      workflowId: WORKFLOW_ID,
      activeVersionId: entity.activeVersionId,
      nodes: JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8')),
      connections,
    }, null, 2), { flag: 'wx' });

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null'); await waitService(conn, 'n8n_n8n', 0); servicesStopped = true;
    const sql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, connections=${dollar(JSON.stringify(connections), 'connections')}::json, \"versionId\"=\"activeVersionId\", \"updatedAt\"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'hnodes')}::json, connections=${dollar(JSON.stringify(connections), 'hconnections')}::json, \"updatedAt\"=NOW() WHERE \"workflowId\"=${shQuote(WORKFLOW_ID)} AND \"versionId\"=${shQuote(entity.activeVersionId)};
COPY (SELECT json_build_object('entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb, 'legacyTimezoneRemoved', we.nodes::text NOT LIKE '%America/Sao_Paulo%', 'centralNormalizer', we.nodes::text LIKE '%const normalizeGreetingPeriod =%', 'aiTimeRangesRemoved', we.nodes::text NOT LIKE '%Entre 05:00 e 11:59%', 'aiUsesGreetingPlaceholder', we.nodes::text LIKE '%[[SAUDACAO]]%')::text FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());
    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 1); servicesStopped = false;
    const services = await readServiceMap(conn);
    console.log(JSON.stringify({
      apply: true,
      ...result,
      ...summary,
      backupPath,
      n8nReplicas: services.n8n_n8n,
      runnerReplicas: services['n8n_n8n-runner'],
      evolutionReplicas: services['n8n_evolution-api'],
    }, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = { patchWorkflow, summarize };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
