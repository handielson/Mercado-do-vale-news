const fs = require('node:fs');
const path = require('node:path');
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const ROUTE_START = "// A vitrine lê a mesma configuração do painel, sem expor o responsável.";
const ANCHOR = "fastify.get('/catalog-settings', async (req, reply) => {";
const PUBLIC_ANCHOR = "    pathname === '/catalog/metadata' ||";

function patchCatalogSections(source, local) {
  const normalized = source.replace(/\r\n/g, '\n');
  const normalizedLocal = local.replace(/\r\n/g, '\n');
  const block = normalizedLocal.slice(normalizedLocal.indexOf(ROUTE_START), normalizedLocal.indexOf(ANCHOR));
  if (!block.startsWith(ROUTE_START) || !block.includes("fastify.get('/catalog/sections'")) throw new Error('Missing local route');
  let updated = normalized;
  if (updated.includes("fastify.get('/catalog/sections'")) {
    if (!updated.includes(block)) throw new Error('Remote catalog route differs');
  } else {
    if (updated.split(ANCHOR).length !== 2) throw new Error('Ambiguous catalog settings anchor');
    updated = updated.replace(ANCHOR, block + ANCHOR);
  }
  if (!updated.includes("    pathname === '/catalog/sections' ||")) {
    if (updated.split(PUBLIC_ANCHOR).length !== 2) throw new Error('Ambiguous public proxy anchor');
    updated = updated.replace(PUBLIC_ANCHOR, PUBLIC_ANCHOR + "\n    pathname === '/catalog/sections' ||");
  }
  return source.includes('\r\n') ? updated.replace(/\n/g, '\r\n') : updated;
}

async function deployCatalogSections({ appDir, apiProc, root, read, write, exec, checkOnly = false }) {
  if (appDir !== '/var/www/mdv-api' || apiProc.name !== 'mdv-api'
    || !ENTRIES.some(file => apiProc.pm2_env?.pm_exec_path === `${appDir}/${file}`)) throw new Error('Unexpected API target');
  const changes = [];
  for (const file of ENTRIES) {
    const original = await read(`${appDir}/${file}`);
    if (!original) throw new Error(`Missing entry ${file}`);
    const updated = patchCatalogSections(original, fs.readFileSync(path.join(root, file), 'utf8'));
    if (original !== updated) changes.push({ file, original, updated });
  }
  console.log(JSON.stringify({ checkOnly, files: changes.map(change => change.file) }));
  if (checkOnly || !changes.length) return;
  const backup = `${appDir}/backups/catalog-sections-${Date.now()}`;
  await exec(`mkdir -p ${backup}`);
  for (const change of changes) {
    if (await read(`${appDir}/${change.file}`) !== change.original) throw new Error('Remote changed during preflight');
    await write(`${backup}/${change.file}`, change.original);
  }
  let promoted = false;
  try {
    for (const change of changes) {
      await write(`${appDir}/${change.file}.release-check.cjs`, change.updated);
      await exec(`node --check ${appDir}/${change.file}.release-check.cjs`);
    }
    for (const change of changes) {
      promoted = true;
      await exec(`mv ${appDir}/${change.file}.release-check.cjs ${appDir}/${change.file}`);
    }
    await exec('pm2 restart mdv-api');
    console.log(`Catalog sections backup: ${backup}`);
  } catch (error) {
    if (promoted) {
      for (const change of changes) await write(`${appDir}/${change.file}`, change.original);
      await exec('pm2 restart mdv-api');
    }
    throw error;
  } finally {
    for (const change of changes) await exec(`rm -f ${appDir}/${change.file}.release-check.cjs`);
  }
}
module.exports = { patchCatalogSections, deployCatalogSections };
