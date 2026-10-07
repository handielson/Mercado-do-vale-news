const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const MODULE = 'services/whatsappStatusHealth.cjs';
const REGISTRATION = "require('./services/whatsappStatusHealth.cjs').registerWhatsAppStatusHealthRoute(fastify, requireAdminBearerToken);";
const normalize = source => source.replace(/\r\n/g, '\n');

function patchSystemStatus(source) {
  if (!source.includes('async function requireAdminBearerToken(')) throw new Error('Admin authentication missing');
  const occurrences = source.split(REGISTRATION).length - 1;
  if (occurrences > 1) throw new Error('Duplicate health registration');
  if (occurrences === 1) return source;
  const anchor = "fastify.get('/status', async (req, reply) => {";
  if (source.split(anchor).length !== 2) throw new Error('API status anchor is ambiguous');
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  return source.replace(anchor, `${REGISTRATION}${newline}${newline}${anchor}`);
}

async function deploySystemStatus({ appDir, apiProc, root, read, write, exec, checkOnly = false }) {
  if (appDir !== '/var/www/mdv-api' || apiProc.name !== 'mdv-api'
    || !ENTRIES.some(file => apiProc.pm2_env?.pm_exec_path === `${appDir}/${file}`)) {
    throw new Error('Unexpected API target');
  }
  const changes = [];
  for (const file of ENTRIES) {
    const original = await read(`${appDir}/${file}`);
    if (!original) throw new Error(`Missing server entry: ${file}`);
    const updated = patchSystemStatus(original);
    if (updated !== original) changes.push({ file, original, updated });
  }
  const original = await read(`${appDir}/${MODULE}`);
  const updated = fs.readFileSync(path.join(root, MODULE), 'utf8');
  const baselineRef = process.env.VPS_SYSTEM_STATUS_BASELINE || 'HEAD^';
  const tracked = execFileSync('git', ['ls-tree', baselineRef, '--', MODULE], { cwd: root, encoding: 'utf8' }).trim();
  const previous = tracked ? execFileSync('git', ['show', `${baselineRef}:${MODULE}`], { cwd: root, encoding: 'utf8' }) : '';
  if (![normalize(previous), normalize(updated)].includes(normalize(original))) {
    throw new Error('Remote health module differs from release baseline');
  }
  if (normalize(original) !== normalize(updated)) changes.push({ file: MODULE, original, updated });
  const plan = { checkOnly, target: apiProc.name, entry: apiProc.pm2_env.pm_exec_path, files: changes.map(change => change.file) };
  console.log(JSON.stringify(plan));
  if (checkOnly || !changes.length) return plan;

  const backupDir = `${appDir}/backups/system-status-${Date.now()}`;
  await exec(`mkdir -p ${backupDir}`);
  for (const change of changes) {
    if (await read(`${appDir}/${change.file}`) !== change.original) throw new Error(`Remote file changed during preflight: ${change.file}`);
    await write(`${backupDir}/${change.file.replaceAll('/', '__')}`, change.original);
  }
  await write(`${backupDir}/manifest.json`, JSON.stringify(changes.map(({ file, original }) => ({ file, existed: Boolean(original) })), null, 2));
  let promoted = false;
  try {
    for (const change of changes) {
      await write(`${appDir}/${change.file}.release-check.cjs`, change.updated);
      await exec(`node --check ${appDir}/${change.file}.release-check.cjs`);
    }
    // Stage and validate every file before changing any running entry.
    for (const change of changes) {
      promoted = true;
      await exec(`mv ${appDir}/${change.file}.release-check.cjs ${appDir}/${change.file}`);
    }
    console.log((await exec('pm2 restart mdv-api')).trim());
    console.log(`System status backup: ${backupDir}`);
    return { ...plan, backupDir };
  } catch (error) {
    if (promoted) {
      for (const change of changes) {
        if (change.original) await write(`${appDir}/${change.file}`, change.original);
        else await exec(`rm -f ${appDir}/${change.file}`);
      }
      await exec('pm2 restart mdv-api');
    }
    throw error;
  } finally {
    for (const change of changes) await exec(`rm -f ${appDir}/${change.file}.release-check.cjs`);
  }
}

module.exports = { deploySystemStatus, patchSystemStatus, REGISTRATION };
