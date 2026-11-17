// bling-nfe-launch-guard-v1: deploy seletivo da rede de segurança de estoque/contas das NF-e do Bling, sem o deploy completo.
// Mesmo modelo do deploy do relay da Evolution: só segue se o server.js em produção for uma versão conhecida do git,
// com backup, checagem de sintaxe, health check e rollback.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MODULE = 'services/blingNfeLaunchGuard.cjs';
const FILES = [
  { local: MODULE, remote: MODULE },
  { local: 'vps_server.js', remote: 'server.js', runtime: true },
  { local: 'vps_server.js', remote: 'vps_server.js' },
  { local: 'vps_server.cjs', remote: 'vps_server.cjs' },
];
const normalize = source => String(source || '').replace(/\r\n/g, '\n');
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const knownVersions = (root, file, depth = 40) => git(root, ['log', '--format=%H', '-n', String(depth), '--', file]).split('\n').filter(Boolean)
  .map(commit => normalize(git(root, ['show', `${commit}:${file}`])));

async function deployBlingNfeLaunchGuard({ appDir, apiProc, exec, root, read, write }) {
  if (appDir !== '/var/www/mdv-api' || apiProc.name !== 'mdv-api') throw new Error('Unexpected API target');
  const dirty = git(root, ['status', '--porcelain', '--', ...new Set(FILES.map(file => file.local))]).trim();
  if (dirty) throw new Error(`Commit antes de publicar: ${dirty}`);
  const changes = [];
  for (const file of FILES) {
    const original = await read(`${appDir}/${file.remote}`).catch(() => '');
    const updated = fs.readFileSync(path.join(root, file.local), 'utf8');
    if (normalize(original) === normalize(updated)) continue;
    if (file.runtime && !knownVersions(root, file.local).includes(normalize(original))) throw new Error(`server.js em produção não bate com o git (${file.remote}); use o deploy completo revisado`);
    changes.push({ ...file, original, updated });
  }
  if (!changes.length) { console.log('Bling NF-e launch guard already up to date'); return; }
  const backupDir = `${appDir}/backups/bling-nfe-launch-guard-${Date.now()}`;
  await exec(`mkdir -p ${backupDir} ${appDir}/services`);
  for (const change of changes) if (change.original) await write(`${backupDir}/${change.remote.replaceAll('/', '__')}`, change.original);
  const restore = async () => {
    for (const change of changes) {
      if (change.original) await write(`${appDir}/${change.remote}`, change.original);
      else await exec(`rm -f ${appDir}/${change.remote}`);
    }
    await exec('pm2 restart mdv-api');
  };
  try {
    for (const change of changes) {
      await write(`${appDir}/${change.remote}.release-check.cjs`, change.updated);
      await exec(`node --check ${appDir}/${change.remote}.release-check.cjs`);
    }
    // Módulo primeiro, servidor por último: o server.js novo exige o módulo.
    for (const change of [...changes].sort((a, b) => Number(Boolean(a.runtime)) - Number(Boolean(b.runtime)))) {
      await exec(`mv ${appDir}/${change.remote}.release-check.cjs ${appDir}/${change.remote}`);
    }
    await exec('pm2 restart mdv-api');
    let healthy = false;
    for (let attempt = 0; attempt < 15 && !healthy; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      healthy = /"ok":\s*true/.test(await exec('curl -s -m 5 http://127.0.0.1:4000/status || true'));
    }
    if (!healthy) throw new Error('API não ficou saudável depois do reinício');
    // A rota de status exige a chave de sync: sem ela tem de recusar (401/403), nunca 404 (rota ausente).
    const code = (await exec('curl -s -o /dev/null -w "%{http_code}" -m 5 http://127.0.0.1:4000/api/bling-nfe-launch-guard || true')).trim();
    if (!['401', '403'].includes(code)) throw new Error(`Rota da rede de segurança respondeu ${code}`);
    console.log(`Bling NF-e launch guard: ${changes.map(change => change.remote).join(', ')}`);
    console.log(`Bling NF-e launch guard backup: ${backupDir}`);
  } catch (error) {
    await restore();
    throw error;
  }
}

module.exports = { deployBlingNfeLaunchGuard, FILES };
