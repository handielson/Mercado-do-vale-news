'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');

const FILES = ['services/metaAttendanceCore.cjs', 'services/metaAttendanceServer.cjs'];
const MIGRATION = 'migrations/055_meta_attendance_events.sql';

function patchRegistration(source) {
  const normalized = source.replace(/\r\n/g, '\n');
  const anchor = 'function registerMarketingCampaignRoutes(fastify, dependencies) {';
  const hook = "  require('./metaAttendanceServer.cjs').registerMetaAttendanceRoutes(fastify, dependencies);";
  if (normalized.split(anchor).length !== 2) throw new Error('Marketing registration anchor drift');
  if (normalized.includes(hook)) {
    if (normalized.split(hook).length !== 2 || !normalized.includes(`${anchor}\n${hook}\n`)) throw new Error('Attendance registration drift');
    return source;
  }
  const next = normalized.replace(anchor, `${anchor}\n${hook}`);
  return source.includes('\r\n') ? next.replace(/\n/g, '\r\n') : next;
}

function patchEnv(source, token) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Unexpected verification token format');
  let result = source;
  for (const [key, value] of [['META_ATTENDANCE_ENABLED', 'true'], ['META_ATTENDANCE_VERIFY_TOKEN', token]]) {
    const pattern = new RegExp(`^${key}=.*$`, 'gm');
    const count = [...result.matchAll(pattern)].length;
    if (count > 1) throw new Error('Duplicate attendance environment key');
    result = count ? result.replace(pattern, `${key}=${value}`) : `${result.replace(/\s*$/, '')}\n${key}=${value}\n`;
  }
  return result;
}

async function remoteDeploy(bundle) {
  const fs = require('node:fs'), cp = require('node:child_process'), crypto = require('node:crypto');
  const root = '/var/www/mdv-api';
  process.chdir(root);
  require('dotenv').config({ quiet: true });
  const processes = JSON.parse(cp.execFileSync('pm2', ['jlist'], { encoding: 'utf8' })).filter(p => p.name === 'mdv-api');
  if (processes.length !== 1 || processes[0].pm2_env.pm_cwd !== root || processes[0].pm2_env.pm_exec_path !== `${root}/server.js`) throw new Error('Unexpected API runtime');
  const digest = value => crypto.createHash('sha256').update(value).digest('hex');
  const file = `${root}/services/marketingCampaignApi.cjs`, original = fs.readFileSync(file, 'utf8');
  const patched = patchRegistration(original);
  const oldEnv = fs.readFileSync(`${root}/.env`, 'utf8');
  const existing = process.env.META_ATTENDANCE_VERIFY_TOKEN;
  if (existing && !/^[a-f0-9]{64}$/.test(existing)) throw new Error('Existing verification token requires explicit review');
  const token = existing || crypto.randomBytes(32).toString('hex');
  const nextEnv = patchEnv(oldEnv, token);
  const staged = [{ relative: 'services/marketingCampaignApi.cjs', before: original, after: patched }];
  for (const [relative, content] of Object.entries(bundle.modules)) {
    if (!['services/metaAttendanceCore.cjs', 'services/metaAttendanceServer.cjs'].includes(relative)) throw new Error('Unexpected module path');
    const before = fs.existsSync(`${root}/${relative}`) ? fs.readFileSync(`${root}/${relative}`, 'utf8') : null;
    if (before !== null && before !== content) throw new Error('Remote attendance module drift');
    staged.push({ relative, before, after: content });
  }
  const db = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  try {
    const [tables] = await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='meta_attendance_events'");
    const exists = tables.length > 0;
    if (exists) {
      const [columns] = await db.query('SHOW COLUMNS FROM meta_attendance_events');
      const names = columns.map(c => c.Field);
      if (!['event_key', 'normalized_event', 'status', 'account_id', 'received_at'].every(name => names.includes(name))) throw new Error('Inbox schema drift');
      const [indexes] = await db.query('SHOW INDEX FROM meta_attendance_events');
      if (!indexes.some(i => i.Key_name === 'uq_meta_attendance_event' && i.Column_name === 'event_key' && i.Non_unique === 0)) throw new Error('Inbox uniqueness drift');
    }
    const report = { apply: bundle.apply, mode: 'capture_only', outboundEnabled: false, n8nChanged: false, tableExists: exists,
      files: staged.map(s => ({ file: s.relative, changed: s.before !== s.after, hash: digest(s.after) })), envChanged: oldEnv !== nextEnv };
    if (!bundle.apply) { console.log(JSON.stringify(report)); return; }
    if (exists && staged.every(s => s.before === s.after) && oldEnv === nextEnv) { console.log(JSON.stringify({ ...report, changed: false, restarted: false })); return; }
    const backup = `${root}/backups/meta-attendance-${Date.now()}`;
    fs.mkdirSync(`${backup}/services`, { recursive: true, mode: 0o700 });
    fs.chmodSync(backup, 0o700);
    fs.writeFileSync(`${backup}/env.before`, oldEnv, { mode: 0o600 });
    for (const s of staged) if (s.before !== null) fs.writeFileSync(`${backup}/${s.relative}`, s.before, { mode: 0o600 });
    fs.writeFileSync(`${backup}/migration.sql`, bundle.migration, { mode: 0o600 });
    const manifest = staged.map(s => ({ file: s.relative, existed: s.before !== null, beforeHash: s.before === null ? null : digest(s.before), afterHash: digest(s.after) }));
    fs.writeFileSync(`${backup}/manifest.json`, JSON.stringify(manifest), { mode: 0o600 });
    let runtimeChanged = false;
    try {
      for (const s of staged) {
        const target = `${root}/${s.relative}.next.cjs`;
        fs.writeFileSync(target, s.after, { mode: 0o600 });
        cp.execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' });
      }
      for (const s of staged) {
        const actual = fs.existsSync(`${root}/${s.relative}`) ? fs.readFileSync(`${root}/${s.relative}`, 'utf8') : null;
        if (actual !== s.before) throw new Error('Runtime changed during staging');
      }
      if (fs.readFileSync(`${root}/.env`, 'utf8') !== oldEnv) throw new Error('Environment changed during staging');
      // DDL is additive; rollback deliberately keeps the inbox and any received events.
      if (!exists) await db.query(bundle.migration);
      runtimeChanged = true;
      for (const s of staged) fs.renameSync(`${root}/${s.relative}.next.cjs`, `${root}/${s.relative}`);
      fs.writeFileSync(`${root}/.env`, nextEnv, { mode: 0o600 });
      fs.chmodSync(`${root}/.env`, 0o600);
      // Register the actual marketing routes against inert dependencies before the real restart.
      const probe = `const app=require('fastify')();const pool={query:async()=>[[]]};const auth=async()=>{};require('./services/marketingCampaignApi.cjs').registerMarketingCampaignRoutes(app,{pool,requireAdminBearerToken:auth,requireSyncKeyOrAdmin:auth,getBearerAuthContext:async()=>({}),getPublicAppUrl:()=> 'https://www.mercadodovale.com.br',uploadsDir:'/tmp',publicApiUrl:'https://api.xiaomipetrolina.com.br'});app.ready().then(()=>app.close()).then(()=>process.exit(0)).catch(()=>process.exit(1));`;
      cp.execFileSync(process.execPath, ['-e', probe], { cwd: root, stdio: 'pipe', timeout: 10000 });
      cp.execFileSync('pm2', ['restart', 'mdv-api', '--update-env'], { stdio: 'pipe', env: { ...process.env, META_ATTENDANCE_ENABLED: 'true', META_ATTENDANCE_VERIFY_TOKEN: token } });
      let ready = false;
      const base = `http://127.0.0.1:${process.env.PORT || 4000}`;
      for (let attempt = 0; attempt < 25; attempt++) {
        try {
          const health = await fetch(`${base}/status`, { signal: AbortSignal.timeout(2000) });
          const status = await health.json();
          const query = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': token, 'hub.challenge': 'mdv-pilot-readiness' });
          const callback = await fetch(`${base}/integrations/meta/attendance/webhook?${query}`, { signal: AbortSignal.timeout(2000) });
          if (health.ok && status.mysql?.ok === true && callback.ok && await callback.text() === 'mdv-pilot-readiness') { ready = true; break; }
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!ready) throw new Error('API readiness or webhook verification failed');
      for (const s of staged) if (fs.readFileSync(`${root}/${s.relative}`, 'utf8') !== s.after) throw new Error('Runtime readback mismatch');
      console.log(JSON.stringify({ ...report, backup, changed: true, restarted: true }));
    } catch (error) {
      if (runtimeChanged) {
        for (const s of staged) {
          if (s.before === null) { if (fs.existsSync(`${root}/${s.relative}`)) fs.unlinkSync(`${root}/${s.relative}`); }
          else fs.writeFileSync(`${root}/${s.relative}`, s.before, { mode: 0o600 });
        }
        fs.writeFileSync(`${root}/.env`, oldEnv, { mode: 0o600 });
        cp.execFileSync('pm2', ['restart', 'mdv-api', '--update-env'], { stdio: 'pipe', env: { ...process.env, META_ATTENDANCE_ENABLED: process.env.META_ATTENDANCE_ENABLED || 'false', META_ATTENDANCE_VERIFY_TOKEN: existing || '' } });
      }
      throw error;
    } finally {
      for (const s of staged) { const temp = `${root}/${s.relative}.next.cjs`; if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    }
  } finally { await db.end(); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--apply')) throw new Error('Use no arguments for dry-run or --apply');
  const root = path.resolve(__dirname, '..');
  const modules = Object.fromEntries(FILES.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
  const bundle = { apply: args.includes('--apply'), modules, migration: fs.readFileSync(path.join(root, MIGRATION), 'utf8') };
  const script = `const patchRegistration=${patchRegistration.toString()};const patchEnv=${patchEnv.toString()};(${remoteDeploy.toString()})(${JSON.stringify(bundle)}).catch(e=>{console.error('Meta attendance deployment failed: '+String(e.message).replace(/[^a-zA-Z0-9 ._-]/g,'').slice(0,120));process.exitCode=1;});`;
  const client = new Client();
  try {
    await new Promise((resolve, reject) => client.on('ready', resolve).on('error', reject).connect({ ...getVpsSshConfig(), readyTimeout: 15000 }));
    const result = await new Promise((resolve, reject) => client.exec('cd /var/www/mdv-api && node', (error, stream) => {
      if (error) return reject(new Error('SSH command unavailable'));
      let output = '', diagnostics = '';
      stream.on('data', chunk => { output += chunk; });
      stream.stderr.on('data', chunk => { diagnostics += chunk; });
      stream.on('close', code => code ? reject(new Error(diagnostics.startsWith('Meta attendance deployment failed:') ? diagnostics.trim() : 'Remote deploy failed; sensitive output omitted')) : resolve(output));
      stream.end(script);
    }));
    console.log(result.trim());
  } finally { client.end(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { FILES, MIGRATION, patchRegistration, patchEnv };
