'use strict';

// Controls only the two production ingresses that can start the n8n bot.
// No customer event, API key, credential, or message body is printed.
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');

const ACTIONS = new Set(['status', 'pause', 'resume']);
const EVOLUTION_CONTAINER = 'evolution_api';
const META_API_DIRECTORY = '/var/www/mdv-api';
const EXPECTED_WEBHOOK_URL = 'https://n8n.mercadodovale.com.br/webhook/whatsapp';
const EXPECTED_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'];

function buildEvolutionProgram(action) {
  if (!ACTIONS.has(action)) throw new Error('Invalid ingress action');
  return `
(async () => {
  const action = ${JSON.stringify(action)};
  const base = 'http://127.0.0.1:8080';
  const instance = 'botmercadodovale';
  const expectedUrl = ${JSON.stringify(EXPECTED_WEBHOOK_URL)};
  const expectedEvents = ${JSON.stringify(EXPECTED_EVENTS)};
  const key = process.env.AUTHENTICATION_API_KEY;
  if (!key) throw new Error('Evolution API key unavailable inside active container');
  const read = async () => {
    const response = await fetch(base + '/webhook/find/' + instance, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Evolution readback HTTP ' + response.status);
    const value = await response.json();
    return value.webhook || value;
  };
  const before = await read();
  const configMatches = before.url === expectedUrl
    && typeof before.enabled === 'boolean'
    && before.webhookByEvents === false
    && before.webhookBase64 === true
    && expectedEvents.every(event => before.events?.includes(event));
  const isKnownPaused = value => value.enabled === false && value.url === expectedUrl
    && value.webhookByEvents === false && value.webhookBase64 === true
    && (!value.events || value.events.length === 0) && value.headers == null;
  const recoveringDisabledWebhook = action === 'resume' && isKnownPaused(before);
  if (action !== 'status' && !configMatches && !recoveringDisabledWebhook) throw new Error('Evolution webhook config differs from expected production contract');
  let after = before;
  if (action !== 'status') {
    const desired = action === 'resume';
    if (before.enabled !== desired || recoveringDisabledWebhook) {
      const webhook = {
        enabled: desired,
        url: recoveringDisabledWebhook ? expectedUrl : before.url,
        byEvents: recoveringDisabledWebhook ? false : before.webhookByEvents,
        base64: recoveringDisabledWebhook ? true : before.webhookBase64,
        events: recoveringDisabledWebhook ? expectedEvents : before.events,
      };
      if (!recoveringDisabledWebhook && before.headers !== null && before.headers !== undefined) webhook.headers = before.headers;
      const response = await fetch(base + '/webhook/set/' + instance, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Evolution webhook update HTTP ' + response.status);
    }
    after = await read();
    const matchesEnabledConfig = after.url === (recoveringDisabledWebhook ? expectedUrl : before.url)
      && after.webhookByEvents === (recoveringDisabledWebhook ? false : before.webhookByEvents)
      && after.webhookBase64 === (recoveringDisabledWebhook ? true : before.webhookBase64)
      && JSON.stringify([...(after.events || [])].sort()) === JSON.stringify([...(recoveringDisabledWebhook ? expectedEvents : before.events || [])].sort())
      && JSON.stringify(after.headers ?? null) === (recoveringDisabledWebhook ? 'null' : JSON.stringify(before.headers ?? null));
    if (after.enabled !== desired || !(matchesEnabledConfig || (!desired && isKnownPaused(after)))) {
      throw new Error('Evolution webhook readback differs from requested state');
    }
  }
  console.log(JSON.stringify({
    service: 'evolution',
    observedAt: new Date().toISOString(),
    enabled: after.enabled === true,
    beforeEnabled: before.enabled === true,
    changed: before.enabled !== after.enabled,
    configMatches,
    disabledConfigCleared: isKnownPaused(after),
    eventCount: Array.isArray(after.events) ? after.events.length : 0,
    headersType: after.headers === null ? 'null' : typeof after.headers,
    urlMatches: after.url === expectedUrl,
    urlEmpty: !after.url,
    byEvents: after.webhookByEvents,
    base64: after.webhookBase64,
  }));
})().catch(error => {
  console.error(error.message || 'Evolution ingress control failed');
  process.exitCode = 1;
});
`;
}

function buildMetaProgram(action) {
  if (!ACTIONS.has(action)) throw new Error('Invalid ingress action');
  return `
require('dotenv').config({ quiet: true });
(async () => {
  const action = ${JSON.stringify(action)};
  const mysql = require('mysql2/promise');
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  let held = false;
  try {
    if (action !== 'status') {
      const [[lock]] = await db.query("SELECT GET_LOCK('mdv.meta.attendance.worker',180) AS acquired");
      if (Number(lock?.acquired) !== 1) throw new Error('Meta worker did not drain before timeout');
      held = true;
    }
    const [[before]] = await db.query(
      'SELECT enabled, activation_event_id, activation_at FROM meta_attendance_runtime WHERE id=1'
    );
    if (!before) throw new Error('Meta runtime control row missing');
    if (action === 'pause') {
      const [[planning]] = await db.query(
        "SELECT COUNT(*) AS count FROM meta_attendance_jobs WHERE status='planning'"
      );
      const [[sending]] = await db.query(
        "SELECT COUNT(*) AS count FROM meta_attendance_outbox WHERE status='sending'"
      );
      if (Number(planning.count) !== 0 || Number(sending.count) !== 0) {
        throw new Error('Meta worker has in-flight jobs after lock acquisition');
      }
    }
    if (action !== 'status') {
      const desired = action === 'resume' ? 1 : 0;
      if (Number(before.enabled) !== desired) {
        await db.query('UPDATE meta_attendance_runtime SET enabled=? WHERE id=1', [desired]);
      }
    }
    const [[after]] = await db.query(
      'SELECT enabled, activation_event_id, activation_at FROM meta_attendance_runtime WHERE id=1'
    );
    const markerPreserved = Number(after.activation_event_id) === Number(before.activation_event_id)
      && new Date(after.activation_at || 0).getTime() === new Date(before.activation_at || 0).getTime();
    if (action !== 'status' && (!markerPreserved || Number(after.enabled) !== (action === 'resume' ? 1 : 0))) {
      throw new Error('Meta worker readback or activation marker mismatch');
    }
    const [jobs] = await db.query('SELECT status,COUNT(*) AS count FROM meta_attendance_jobs GROUP BY status');
    const [outbox] = await db.query('SELECT status,COUNT(*) AS count FROM meta_attendance_outbox GROUP BY status');
    const cp = require('child_process');
    const app = JSON.parse(cp.execFileSync('pm2', ['jlist'], { encoding: 'utf8' }))
      .find(item => item.name === 'mdv-api');
    console.log(JSON.stringify({
      service: 'meta',
      observedAt: new Date().toISOString(),
      enabled: Number(after.enabled) === 1,
      beforeEnabled: Number(before.enabled) === 1,
      changed: Number(before.enabled) !== Number(after.enabled),
      activationMarkerPreserved: markerPreserved,
      workerProcessOnline: app?.pm2_env?.status === 'online',
      workerConfigured: app?.pm2_env?.META_ATTENDANCE_REPLIES_ENABLED === 'true',
      planningJobs: Number(jobs.find(row => row.status === 'planning')?.count || 0),
      readyJobs: Number(jobs.find(row => row.status === 'ready')?.count || 0),
      sendingBlocks: Number(outbox.find(row => row.status === 'sending')?.count || 0),
      resultUnknownBlocks: Number(outbox.find(row => row.status === 'result_unknown')?.count || 0),
    }));
  } finally {
    if (held) await db.query("SELECT RELEASE_LOCK('mdv.meta.attendance.worker')").catch(() => {});
    await db.end();
  }
})().catch(error => {
  console.error(error.message || 'Meta ingress control failed');
  process.exitCode = 1;
});
`;
}

function remoteCommand(service, action) {
  const program = service === 'evolution' ? buildEvolutionProgram(action) : buildMetaProgram(action);
  const encoded = Buffer.from(program, 'utf8').toString('base64');
  const evalProgram = `eval(Buffer.from('${encoded}','base64').toString('utf8'))`;
  if (service === 'evolution') return `docker exec ${EVOLUTION_CONTAINER} node -e "${evalProgram}"`;
  if (service === 'meta') return `cd ${META_API_DIRECTORY} && node -e "${evalProgram}"`;
  throw new Error('Invalid ingress service');
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', chunk => { stdout += chunk; });
      stream.stderr.on('data', chunk => { stderr += chunk; });
      stream.on('close', code => {
        if (code === 0) resolve(stdout);
        else reject(new Error((stderr || stdout || 'Remote ingress operation failed').trim().slice(0, 300)));
      });
    });
  });
}

function parseSummary(output, expectedService) {
  for (const line of String(output).trim().split(/\r?\n/).reverse()) {
    if (!line.startsWith('{')) continue;
    let value;
    try { value = JSON.parse(line); } catch { continue; }
    if (value.service === expectedService && typeof value.enabled === 'boolean') return value;
  }
  throw new Error(`Missing ${expectedService} ingress readback`);
}

async function inspect(conn, service, action) {
  return parseSummary(await runRemote(conn, remoteCommand(service, action)), service);
}

async function control(conn, action) {
  if (action === 'status') {
    const [evolution, meta] = await Promise.all([
      inspect(conn, 'evolution', 'status'),
      inspect(conn, 'meta', 'status'),
    ]);
    return { action, evolution, meta };
  }
  if (action === 'pause') {
    const meta = await inspect(conn, 'meta', 'pause');
    try {
      const evolution = await inspect(conn, 'evolution', 'pause');
      return { action, evolution, meta };
    } catch (error) {
      let restorationFailed = false;
      try {
        const state = await inspect(conn, 'evolution', 'status');
        if (!state.enabled && state.disabledConfigCleared) await inspect(conn, 'evolution', 'resume');
        else if (!state.enabled || !state.configMatches) restorationFailed = true;
      } catch { restorationFailed = true; }
      if (meta.changed && meta.beforeEnabled) {
        await inspect(conn, 'meta', 'resume').catch(() => { restorationFailed = true; });
      }
      if (restorationFailed) throw new Error('Ingress pause failed and restoration was incomplete. Inspect both ingresses immediately.');
      throw error;
    }
  }
  if (action === 'resume') {
    const evolution = await inspect(conn, 'evolution', 'resume');
    try {
      const meta = await inspect(conn, 'meta', 'resume');
      return { action, evolution, meta };
    } catch (error) {
      if (evolution.changed && !evolution.beforeEnabled) {
        await inspect(conn, 'evolution', 'pause').catch(() => {
          throw new Error('Meta resume failed; Evolution restoration also failed. Inspect both ingresses immediately.');
        });
      }
      throw error;
    }
  }
  throw new Error('Invalid ingress action');
}

async function main() {
  const action = process.argv[2];
  if (!ACTIONS.has(action)) throw new Error('Usage: node scripts/n8n-upgrade-ingress-control.cjs status|pause|resume');
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const result = await control(conn, action);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    conn.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message || 'Ingress control failed');
    process.exitCode = 1;
  });
}

module.exports = {
  buildEvolutionProgram,
  buildMetaProgram,
  remoteCommand,
  parseSummary,
  control,
};
