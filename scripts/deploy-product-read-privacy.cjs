const fs = require('node:fs');
const path = require('node:path');
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const MODULE = 'services/productReadPrivacy.cjs';
const HOOK = "require('./services/productReadPrivacy.cjs').registerProductReadPrivacy(fastify, {\n  getAuth: getVpsBearerAuthContext,\n});\n\n";
function patchProductReadPrivacy(source) {
  let updated = source.replace(/\r\n/g, '\n');
  const start = updated.indexOf('async function getVpsBearerAuthContext(');
  const end = updated.indexOf('async function isAdminBearerToken(', start);
  if (start < 0 || end < 0) throw new Error('Missing auth anchors');
  let block = updated.slice(start, end);
  if (!block.includes('customerType: customer?.customer_type || null,')) {
    const anchor = '      customerId: customer?.id || null,';
    if (block.split(anchor).length !== 2) throw new Error('Ambiguous customer type anchor');
    block = block.replace(anchor, anchor + '\n      customerType: customer?.customer_type || null,');
  }
  if (!block.includes(HOOK)) {
    if (block.includes('registerProductReadPrivacy')) throw new Error('Remote privacy hook differs');
    block += HOOK;
  }
  updated = updated.slice(0, start) + block + updated.slice(end);
  return source.includes('\r\n') ? updated.replace(/\n/g, '\r\n') : updated;
}
async function deployProductReadPrivacy({ appDir, apiProc, root, read, write, exec, checkOnly = false,
  files = [...ENTRIES, MODULE], patchFile, backupPrefix = 'product-read-privacy' }) {
  if (appDir !== '/var/www/mdv-api' || apiProc.name !== 'mdv-api'
    || !ENTRIES.some(file => apiProc.pm2_env?.pm_exec_path === `${appDir}/${file}`)) throw new Error('Unexpected API target');
  const changes = [];
  if (!/^[a-z0-9-]+$/.test(backupPrefix)) throw new Error('Invalid backup prefix');
  for (const file of files) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(file) || file.startsWith('/') || file.split('/').includes('..')) throw new Error('Invalid deployment file path');
    const original = await read(`${appDir}/${file}`);
    if (!original && ENTRIES.includes(file)) throw new Error(`Missing entry ${file}`);
    const updated = patchFile ? patchFile(original, file)
      : file === MODULE ? fs.readFileSync(path.join(root, file), 'utf8') : patchProductReadPrivacy(original);
    if (original !== updated) changes.push({ file, original, updated });
  }
  console.log(JSON.stringify({ checkOnly, files: changes.map(change => change.file) }));
  if (checkOnly || !changes.length) return;
  const backup = `${appDir}/backups/${backupPrefix}-${Date.now()}`;
  const directories = new Set(changes.map(change => path.posix.dirname(change.file)).filter(directory => directory !== '.'));
  await exec(`mkdir -p ${backup} ${[...directories].flatMap(directory => [`${backup}/${directory}`, `${appDir}/${directory}`]).join(' ')}`);
  const checkPath = file => `${appDir}/${file}.release-check${path.extname(file) === '.mjs' ? '.mjs' : '.cjs'}`;
  for (const change of changes) {
    if (await read(`${appDir}/${change.file}`) !== change.original) throw new Error('Remote changed during preflight');
    if (change.original) await write(`${backup}/${change.file}`, change.original);
  }
  let promoted = false;
  try {
    for (const change of changes) {
      await write(checkPath(change.file), change.updated);
      await exec(`node --check ${checkPath(change.file)}`);
    }
    for (const change of changes) {
      promoted = true;
      await exec(`mv ${checkPath(change.file)} ${appDir}/${change.file}`);
    }
    await exec('pm2 restart mdv-api');
    console.log(`Product read privacy backup: ${backup}`);
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
    for (const change of changes) await exec(`rm -f ${checkPath(change.file)}`);
  }
}
module.exports = { patchProductReadPrivacy, deployProductReadPrivacy };
