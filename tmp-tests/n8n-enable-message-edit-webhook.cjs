const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const INSTANCE = 'botmercadodovale';
const WEBHOOK_URL = 'https://n8n.mercadodovale.com.br/webhook/whatsapp';
const REQUIRED_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'];

function q(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function remote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `remote exit ${code}`)));
  }));
}

function buildRemoteProgram(apply) {
  return String.raw`(async () => {
const instance = ${JSON.stringify(INSTANCE)};
const expectedUrl = ${JSON.stringify(WEBHOOK_URL)};
const requiredEvents = ${JSON.stringify(REQUIRED_EVENTS)};
const baseUrl = String(process.env.EVOLUTION_SERVER_URL || '').replace(/\/+$/, '');
const apiKey = String(process.env.EVOLUTION_API_KEY || '');
if (!baseUrl || !apiKey) throw new Error('Evolution environment is unavailable in n8n');
const request = async (path, method = 'GET', body) => {
  const response = await fetch(baseUrl + path, {
    method,
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = {}; }
  if (!response.ok) throw new Error('Evolution request failed: ' + response.status);
  return json;
};
const compact = (value) => {
  const webhook = value?.webhook || value || {};
  return {
    enabled: webhook.enabled === true,
    url: String(webhook.url || ''),
    webhookByEvents: webhook.webhookByEvents === true,
    webhookBase64: webhook.webhookBase64 === true,
    events: Array.isArray(webhook.events) ? webhook.events : [],
  };
};
const beforeRaw = await request('/webhook/find/' + encodeURIComponent(instance));
const before = compact(beforeRaw);
${apply ? String.raw`
const events = [...new Set([...before.events, ...requiredEvents])];
await request('/webhook/set/' + encodeURIComponent(instance), 'POST', {
  webhook: {
    enabled: true,
    url: expectedUrl,
    webhookByEvents: false,
    webhookBase64: true,
    events,
  },
});` : ''}
const after = compact(await request('/webhook/find/' + encodeURIComponent(instance)));
if (${apply ? 'true' : 'false'}) {
  assert(after.enabled && after.url === expectedUrl && after.webhookByEvents === false && after.webhookBase64 === true && requiredEvents.every((event) => after.events.includes(event)), 'Evolution webhook verification failed');
}
console.log(JSON.stringify({ mode: ${JSON.stringify(apply ? 'applied' : 'readonly')}, before, after }, null, 2));
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });`;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const container = (await remote(conn, "docker ps --filter 'label=com.docker.swarm.service.name=n8n_n8n' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(container, 'n8n container unavailable');
    const program = Buffer.from(buildRemoteProgram(apply), 'utf8').toString('base64');
    const output = await remote(conn, `docker exec ${q(container)} node -e ${q(`eval(Buffer.from('${program}', 'base64').toString('utf8'))`)}`);
    process.stdout.write(output);
  } finally {
    conn.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
module.exports = { buildRemoteProgram };
