const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const OLD_NODE_NAME = 'Groq - Transcrever audio';
const NEW_NODE_NAME = 'OpenAI - Transcrever audio';
const OPENAI_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';

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
function runRemoteInput(conn, command, input) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
    stream.end(input);
  }));
}
function psql(conn, db, sql) {
  return new Promise((resolve, reject) => conn.exec(`docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
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
function renameConnectionNode(connections, oldName, newName) {
  if (Object.prototype.hasOwnProperty.call(connections, oldName)) {
    connections[newName] = connections[oldName];
    delete connections[oldName];
  }
  for (const outputs of Object.values(connections)) {
    for (const channelGroups of Object.values(outputs || {})) {
      for (const channel of channelGroups || []) {
        for (const target of channel || []) {
          if (target.node === oldName) target.node = newName;
        }
      }
    }
  }
}
function patchWorkflow(nodes, connections) {
  const transcriptionNode = nodes.find((item) => item.name === OLD_NODE_NAME)
    || nodeByName(nodes, NEW_NODE_NAME);
  transcriptionNode.name = NEW_NODE_NAME;
  transcriptionNode.id = String(transcriptionNode.id || '').replace(/groq/gi, 'openai');
  transcriptionNode.parameters.url = 'https://api.openai.com/v1/audio/transcriptions';
  const bodyParameters = transcriptionNode.parameters?.bodyParameters?.parameters || [];
  const modelParameter = bodyParameters.find((item) => item.name === 'model');
  if (!modelParameter) throw new Error('Transcription model parameter not found');
  modelParameter.value = OPENAI_TRANSCRIPTION_MODEL;
  const authorization = (transcriptionNode.parameters?.headerParameters?.parameters || [])
    .find((item) => String(item.name).toLowerCase() === 'authorization');
  if (!authorization) throw new Error('Authorization header not found');
  authorization.value = '={{"Bearer " + $env.OPENAI_API_KEY}}';

  const resolver = nodeByName(nodes, 'Audio - Resolver transcricao');
  resolver.id = String(resolver.id || '').replace(/groq/gi, 'openai');
  resolver.parameters.jsCode = String(resolver.parameters.jsCode || '')
    .replace("audioTranscriptionProvider: 'groq'", "audioTranscriptionProvider: 'openai'")
    .replace("audioTranscriptionModel: 'whisper-large-v3-turbo'", `audioTranscriptionModel: '${OPENAI_TRANSCRIPTION_MODEL}'`);

  const fallbackNode = nodeByName(nodes, 'Audio - Sem transcricao?');
  fallbackNode.id = String(fallbackNode.id || '').replace(/groq/gi, 'openai');
  for (const condition of fallbackNode.parameters?.conditions?.conditions || []) {
    if (condition.id === 'audio-groq-fallback-condition') condition.id = 'audio-openai-fallback-condition';
  }

  renameConnectionNode(connections, OLD_NODE_NAME, NEW_NODE_NAME);
  for (const node of nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
    if (node.parameters?.jsCode) new Function(node.parameters.jsCode);
  }
  return { nodes, connections };
}
function summarize(nodes, connections) {
  const serialized = JSON.stringify({ nodes, connections });
  const groqLocations = [];
  const walk = (value, path = '$') => {
    if (typeof value === 'string' && /groq/i.test(value)) groqLocations.push({ path, value: value.slice(0, 160) });
    else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => walk(child, `${path}.${key}`));
  };
  walk({ nodes, connections });
  const transcriptionNode = nodeByName(nodes, NEW_NODE_NAME);
  const model = (transcriptionNode.parameters?.bodyParameters?.parameters || []).find((item) => item.name === 'model')?.value;
  const authorization = (transcriptionNode.parameters?.headerParameters?.parameters || [])
    .find((item) => String(item.name).toLowerCase() === 'authorization')?.value;
  return {
    provider: 'openai',
    endpoint: transcriptionNode.parameters.url,
    model,
    usesOpenAiEnv: authorization === '={{"Bearer " + $env.OPENAI_API_KEY}}',
    resolverUsesOpenAi: nodeByName(nodes, 'Audio - Resolver transcricao').parameters.jsCode.includes("audioTranscriptionProvider: 'openai'"),
    oldNodeRemoved: !nodes.some((item) => item.name === OLD_NODE_NAME),
    oldConnectionRemoved: !Object.prototype.hasOwnProperty.call(connections, OLD_NODE_NAME),
    groqRuntimeReferences: (serialized.match(/groq/gi) || []).length,
    groqLocations,
  };
}
async function readServiceEnvNames(conn, service) {
  const raw = await runRemote(conn, `docker service inspect ${shQuote(service)} --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}'`);
  return JSON.parse(raw.trim()).map((value) => String(value).split('=')[0]);
}
async function syncOpenAiEnv(conn, service) {
  const names = await readServiceEnvNames(conn, service);
  const remoteScript = `
require('dotenv').config({ path: '.env', quiet: true });
const mysql = require('mysql2/promise');
const { execFileSync } = require('node:child_process');
(async () => {
  const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, connectionLimit: 1 });
  try {
    const [rows] = await pool.query('SELECT openai_api_key FROM autoresponder_settings WHERE id = 1 LIMIT 1');
    const key = String(rows?.[0]?.openai_api_key || process.env.OPENAI_API_KEY || '').trim();
    if (!key) throw new Error('OpenAI API key is not configured');
    const args = ['service', 'update'];
    if (${JSON.stringify(names.includes('GROQ_API_KEY'))}) args.push('--env-rm', 'GROQ_API_KEY');
    if (${JSON.stringify(names.includes('OPENAI_API_KEY'))}) args.push('--env-rm', 'OPENAI_API_KEY');
    args.push('--env-add', 'OPENAI_API_KEY=' + key, ${JSON.stringify(service)});
    execFileSync('docker', args, { stdio: 'ignore' });
  } finally {
    await pool.end();
  }
})().catch((error) => { console.error(error.message); process.exit(1); });`;
  await runRemoteInput(conn, 'cd /var/www/mdv-api && node', remoteScript);
}
async function readOpenAiKeyStatus(conn) {
  const remoteScript = `
require('dotenv').config({ path: '.env', quiet: true });
const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, connectionLimit: 1 });
  try {
    const [rows] = await pool.query('SELECT openai_api_key FROM autoresponder_settings WHERE id = 1 LIMIT 1');
    const settingsKey = String(rows?.[0]?.openai_api_key || '').trim();
    const envKey = String(process.env.OPENAI_API_KEY || '').trim();
    process.stdout.write(JSON.stringify({ configured: Boolean(settingsKey || envKey), source: settingsKey ? 'autoresponder_settings' : (envKey ? 'mdv_api_env' : '') }));
  } finally {
    await pool.end();
  }
})().catch((error) => { console.error(error.message); process.exit(1); });`;
  return JSON.parse(await runRemoteInput(conn, 'cd /var/www/mdv-api && node', remoteScript));
}
async function serviceMap(conn) {
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
    const openAiKeyStatus = await readOpenAiKeyStatus(conn);
    const openAiKeyConfigured = openAiKeyStatus.configured === true;
    if (!openAiKeyConfigured) throw new Error('OPENAI_API_KEY is not configured in autoresponder settings or mdv-api');
    const raw = await psql(conn, db, `COPY (SELECT json_build_object('nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'), 'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'), 'activeVersionId', "activeVersionId")::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes, connections);
    const summary = summarize(nodes, connections);
    if (!APPLY) return console.log(JSON.stringify({ apply: false, openAiKeyConfigured, openAiKeySource: openAiKeyStatus.source, ...summary }, null, 2));

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const sql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, connections=${dollar(JSON.stringify(connections), 'connections')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'hnodes')}::json, connections=${dollar(JSON.stringify(connections), 'hconnections')}::json, "updatedAt"=NOW() WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(entity.activeVersionId)};
COPY (SELECT json_build_object(
  'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
  'openAiEndpoint', we.nodes::text LIKE '%api.openai.com/v1/audio/transcriptions%',
  'openAiModel', we.nodes::text LIKE '%${OPENAI_TRANSCRIPTION_MODEL}%',
  'groqRuntimeRemoved', we.nodes::text NOT ILIKE '%groq%' AND we.connections::text NOT ILIKE '%groq%'
)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());

    await syncOpenAiEnv(conn, 'n8n_n8n');
    await syncOpenAiEnv(conn, 'n8n_n8n-runner');
    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    const n8nEnv = await readServiceEnvNames(conn, 'n8n_n8n');
    const runnerEnv = await readServiceEnvNames(conn, 'n8n_n8n-runner');
    const services = await serviceMap(conn);
    console.log(JSON.stringify({
      apply: true,
      ...result,
      ...summary,
      env: {
        n8nOpenAi: n8nEnv.includes('OPENAI_API_KEY'),
        n8nGroqRemoved: !n8nEnv.includes('GROQ_API_KEY'),
        runnerOpenAi: runnerEnv.includes('OPENAI_API_KEY'),
        runnerGroqRemoved: !runnerEnv.includes('GROQ_API_KEY'),
      },
      services: {
        n8n: services.n8n_n8n,
        runner: services['n8n_n8n-runner'],
        evolution: services['n8n_evolution-api'],
      },
    }, null, 2));
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

module.exports = { patchWorkflow, summarize, OPENAI_TRANSCRIPTION_MODEL };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
