'use strict';

// Read-only cutover evidence. Raw message IDs remain in an ACL-restricted .local file.
// This script never replays events or sends customer messages.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');

const LOCAL_DIR = path.resolve(__dirname, '..', '.local');
const OVERLAP_SECONDS = 120;
const INSTANCE = 'botmercadodovale';

function remoteProgram(mode, baseline) {
  const overlapStart = mode === 'baseline' ? null : Number(baseline.overlapStart);
  const metaMaxEventId = mode === 'baseline' ? null : Number(baseline.metaMaxEventId);
  if (mode === 'reconcile' && (!Number.isSafeInteger(overlapStart) || !Number.isSafeInteger(metaMaxEventId))) {
    throw new Error('Invalid baseline markers');
  }
  return `
require('dotenv').config({ quiet: true });
const { execFileSync } = require('node:child_process');
const mysql = require('mysql2/promise');
const mode = ${JSON.stringify(mode)};
const overlapStart = ${JSON.stringify(overlapStart)};
const metaMaxEventId = ${JSON.stringify(metaMaxEventId)};
function psql(sql, uri) {
  const url = new URL(uri);
  const result = execFileSync('docker', [
    'exec', '-i', 'postgres_evolution', 'psql', '-X', '-q', '-t', '-A',
    '-v', 'ON_ERROR_STOP=1', '-U', decodeURIComponent(url.username),
    '-d', decodeURIComponent(url.pathname.slice(1)), '-c', sql,
  ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return result.trim().split(/\\r?\\n/).filter(Boolean).map(line => JSON.parse(line));
}
(async () => {
  const env = JSON.parse(execFileSync('docker', ['inspect', 'evolution_api', '--format', '{{json .Config.Env}}'], {encoding:'utf8'}));
  const uri = env.find(item => item.startsWith('DATABASE_CONNECTION_URI='))?.slice('DATABASE_CONNECTION_URI='.length);
  if (!uri) throw new Error('Active Evolution database unavailable');
  const epoch = psql("SELECT json_build_object('epoch',floor(extract(epoch from now()))::bigint)", uri)[0]?.epoch;
  if (!Number.isSafeInteger(Number(epoch))) throw new Error('Evolution clock unavailable');
  const start = mode === 'baseline' ? Number(epoch) - ${OVERLAP_SECONDS} : overlapStart;
  const sql = "SELECT json_build_object('waId',m.key->>'id','remoteJid',m.key->>'remoteJid','timestamp',m.\\\"messageTimestamp\\\") "
    + 'FROM "Message" m JOIN "Instance" i ON i.id=m."instanceId" '
    + "WHERE i.name='${INSTANCE}' AND m.key->>'fromMe'='false' "
    + 'AND m."messageTimestamp">=' + start + ' ORDER BY m."messageTimestamp",m.id LIMIT 100001';
  const evolution = psql(sql, uri);
  if (evolution.length > 100000) throw new Error('Evolution result limit exceeded; narrow the audit window manually');
  const db = await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});
  try {
    const [metaMarker] = await db.query('SELECT COALESCE(MAX(id),0) AS max_id FROM meta_attendance_events');
    const [metaRuntime] = await db.query('SELECT enabled, activation_event_id, activation_at FROM meta_attendance_runtime WHERE id=1');
    const [metaStates] = await db.query('SELECT status, COUNT(*) AS count FROM meta_attendance_jobs GROUP BY status');
    const metaEvents = mode === 'baseline' ? [] : (await db.query(
      'SELECT e.id, e.event_key, e.surface, e.event_type, e.status AS event_status, j.status AS job_status FROM meta_attendance_events e LEFT JOIN meta_attendance_jobs j ON j.event_key=e.event_key WHERE e.id>? ORDER BY e.id LIMIT 100001',
      [metaMaxEventId],
    ))[0];
    if (metaEvents.length > 100000) throw new Error('Meta result limit exceeded; audit manually');
    const ids = [...new Set(evolution.map(row => row.waId).filter(Boolean))];
    const loggedIds = [];
    for (let offset=0; offset<ids.length; offset+=500) {
      const batch = ids.slice(offset,offset+500);
      const placeholders = batch.map(() => '?').join(',');
      const [rows] = await db.query("SELECT DISTINCT wa_message_id FROM n8n_bot_messages WHERE direction='inbound' AND wa_message_id IN (" + placeholders + ')',batch);
      loggedIds.push(...rows.map(row => row.wa_message_id));
    }
    console.log(JSON.stringify({version:1,mode,observedAt:new Date().toISOString(),evolutionDbEpoch:Number(epoch),overlapStart:start,evolution,
      loggedWaIds:loggedIds,metaMaxEventId:Number(metaMarker[0].max_id),metaRuntime:metaRuntime[0] || null,metaStates,metaEvents}));
  } finally { await db.end(); }
})().catch(() => { console.error('Read-only cutover query failed; inspect service health without exposing credentials or event data.'); process.exitCode=1; });
`;
}

function remoteCommand(mode, baseline) {
  const encoded = Buffer.from(remoteProgram(mode, baseline), 'utf8').toString('base64');
  return `cd /var/www/mdv-api && node -e "eval(Buffer.from('${encoded}','base64').toString('utf8'))"`;
}

function queryRemote(command) {
  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn.once('ready', () => {
      conn.exec(command, (error, stream) => {
        if (error) { conn.end(); return reject(error); }
        let output = '';
        stream.on('data', chunk => { output += chunk; });
        stream.on('close', code => {
          conn.end();
          if (code !== 0) return reject(new Error('Remote read-only cutover query failed'));
          try { resolve(JSON.parse(output.trim())); }
          catch { reject(new Error('Remote cutover query returned invalid data')); }
        });
      });
    }).once('error', reject).connect(getVpsSshConfig());
  });
}

function summarize(baseline, current) {
  const before = new Set(baseline.evolution.map(row => row.waId).filter(Boolean));
  const logged = new Set(current.loggedWaIds);
  const newEvolution = current.evolution.filter(row => row.waId && !before.has(row.waId));
  const missing = current.evolution.filter(row => row.waId && !logged.has(row.waId));
  const newMissing = missing.filter(row => !before.has(row.waId));
  const oldMissing = missing.filter(row => before.has(row.waId));
  const missingMetaJobs = current.metaEvents.filter(row => !row.job_status);
  const unresolvedMetaJobs = current.metaEvents.filter(row => row.job_status && !['completed','suppressed'].includes(row.job_status));
  return { newEvolution, newMissing, oldMissing, missingMetaJobs, unresolvedMetaJobs };
}

function restrictFile(file) {
  fs.chmodSync(file, 0o600);
  if (process.platform === 'win32') {
    const user = execFileSync('whoami', {encoding:'utf8'}).trim();
    execFileSync('icacls', [file, '/inheritance:r', '/grant:r', `${user}:F`], {stdio:'ignore'});
  }
}

function savePrivate(kind, value) {
  fs.mkdirSync(LOCAL_DIR, {recursive:true});
  const file = path.join(LOCAL_DIR, `n8n-cutover-${kind}-${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}.private.json`);
  try {
    fs.writeFileSync(file, JSON.stringify(value, null, 2), {flag:'wx', mode:0o600});
    restrictFile(file);
    return file;
  } catch (error) {
    fs.rmSync(file, {force:true});
    throw error;
  }
}

async function main() {
  const mode = process.argv[2];
  if (!['baseline','reconcile'].includes(mode) || (mode === 'reconcile' && !process.argv[3])) {
    throw new Error('Usage: node scripts/n8n-upgrade-reconcile.cjs baseline|reconcile <baseline.private.json>');
  }
  const baseline = mode === 'reconcile' ? JSON.parse(fs.readFileSync(path.resolve(process.argv[3]), 'utf8')) : null;
  if (baseline && (baseline.version !== 1 || baseline.mode !== 'baseline')) throw new Error('Invalid cutover baseline file');
  const current = await queryRemote(remoteCommand(mode, baseline));
  if (current.version !== 1 || current.mode !== mode) throw new Error('Unexpected cutover evidence format');
  if (mode === 'baseline') {
    const file = savePrivate('baseline', current);
    console.log(JSON.stringify({file,observedAt:current.observedAt,overlapSeconds:OVERLAP_SECONDS,evolutionInboundInOverlap:current.evolution.length,metaMaxEventId:current.metaMaxEventId,metaWorkerEnabled:current.metaRuntime?.enabled===1}));
    return;
  }
  const result = summarize(baseline, current);
  const file = savePrivate('reconcile', {version:1,baselineObservedAt:baseline.observedAt,observedAt:current.observedAt,overlapStart:baseline.overlapStart,
    evolutionDbEpoch:current.evolutionDbEpoch,metaMaxEventId:current.metaMaxEventId,metaRuntime:current.metaRuntime,
    ...result});
  console.log(JSON.stringify({file,observedAt:current.observedAt,newEvolutionInbound:result.newEvolution.length,
    newEvolutionWithoutBotLog:result.newMissing.length,preexistingWithoutBotLog:result.oldMissing.length,
    newMetaEvents:current.metaEvents.length,newMetaEventsWithoutJob:result.missingMetaJobs.length,
    newMetaJobsUnresolved:result.unresolvedMetaJobs.length}));
}

if (require.main === module) main().catch(() => { console.error('Cutover reconciliation failed. No events were replayed or sent.'); process.exitCode=1; });
module.exports = {remoteProgram,remoteCommand,summarize};
