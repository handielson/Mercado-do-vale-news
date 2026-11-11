// product-promotions-list-v1: deploy seletivo dos módulos da campanha/promoções (sem tocar no server.js).
// Só publica se o arquivo remoto for uma versão conhecida do git (ou ainda não existir), com backup e rollback.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MODULES = ['services/productPromotionsList.cjs', 'services/promoCampaignServer.cjs'];
const normalize = source => String(source || '').replace(/\r\n/g, '\n');

function knownVersions(root, file) {
  const commits = execFileSync('git', ['log', '--format=%H', '-n', '30', '--', file], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  return commits.map(commit => normalize(execFileSync('git', ['show', `${commit}:${file}`], { cwd: root, encoding: 'utf8' })));
}

async function deployPromoCampaign({ appDir, apiProc, exec, root, read, write }) {
  if (appDir !== '/var/www/mdv-api' || apiProc.name !== 'mdv-api') throw new Error('Unexpected API target');
  const dirty = execFileSync('git', ['status', '--porcelain', '--', ...MODULES], { cwd: root, encoding: 'utf8' }).trim();
  if (dirty) throw new Error(`Commit antes de publicar: ${dirty}`);
  const changes = [];
  for (const file of MODULES) {
    const original = await read(`${appDir}/${file}`);
    const updated = fs.readFileSync(path.join(root, file), 'utf8');
    if (normalize(original) === normalize(updated)) continue;
    if (original && !knownVersions(root, file).includes(normalize(original))) throw new Error(`Remote module differs from git history: ${file}`);
    changes.push({ file, original, updated });
  }
  if (!changes.length) { console.log('Promo campaign modules already up to date'); return; }
  const backupDir = `${appDir}/backups/promo-campaign-${Date.now()}`;
  await exec(`mkdir -p ${backupDir}`);
  for (const change of changes) if (change.original) await write(`${backupDir}/${change.file.replaceAll('/', '__')}`, change.original);
  try {
    for (const change of changes) {
      await write(`${appDir}/${change.file}.release-check.cjs`, change.updated);
      await exec(`node --check ${appDir}/${change.file}.release-check.cjs`);
    }
    for (const change of changes) await exec(`mv ${appDir}/${change.file}.release-check.cjs ${appDir}/${change.file}`);
    console.log((await exec('pm2 restart mdv-api')).trim().split('\n').slice(-3).join('\n'));
    console.log(`Promo campaign modules: ${changes.map(change => change.file).join(', ')}`);
    console.log(`Promo campaign backup: ${backupDir}`);
  } catch (error) {
    for (const change of changes) {
      if (change.original) await write(`${appDir}/${change.file}`, change.original);
      else await exec(`rm -f ${appDir}/${change.file}`);
    }
    await exec('pm2 restart mdv-api');
    throw error;
  }
}

module.exports = { deployPromoCampaign, MODULES };
