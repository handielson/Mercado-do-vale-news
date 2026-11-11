// evolution-webhook-relay-v1: deploy seletivo do relay do webhook da Evolution (API) sem o deploy completo.
// Publica o módulo novo e as três entradas do servidor geradas do commit atual. Só segue se o server.js em
// produção for uma versão conhecida do git (nada publicado por fora seria sobrescrito), com backup, checagem e rollback.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MODULE = 'services/evolutionWebhookRelay.cjs';
const FILES = [
  { local: MODULE, remote: MODULE },
  { local: 'services/botErrorAlerts.cjs', remote: 'services/botErrorAlerts.cjs' }, // bot-error-alerts-v1
  { local: 'vps_server.js', remote: 'server.js', runtime: true },
  { local: 'vps_server.js', remote: 'vps_server.js' },
  { local: 'vps_server.cjs', remote: 'vps_server.cjs' },
];
const normalize = source => String(source || '').replace(/\r\n/g, '\n');
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function knownVersions(root, file, depth = 40) {
  return git(root, ['log', '--format=%H', '-n', String(depth), '--', file]).split('\n').filter(Boolean)
    .map(commit => normalize(git(root, ['show', `${commit}:${file}`])));
}

async function deployEvolutionWebhookRelay({ appDir, apiProc, exec, root, read, write }) {
  if (appDir !== '/var/www/mdv-api' || apiProc.name !== 'mdv-api') throw new Error('Unexpected API target');
  const dirty = git(root, ['status', '--porcelain', '--', ...new Set(FILES.map(file => file.local))]).trim();
  if (dirty) throw new Error(`Commit antes de publicar: ${dirty}`);
  const changes = [];
  for (const file of FILES) {
    const original = await read(`${appDir}/${file.remote}`);
    const updated = fs.readFileSync(path.join(root, file.local), 'utf8');
    if (normalize(original) === normalize(updated)) continue;
    if (file.runtime && !knownVersions(root, file.local).includes(normalize(original))) throw new Error(`server.js em produção não bate com o git (${file.remote}); use o deploy completo revisado`);
    changes.push({ ...file, original, updated });
  }
  if (!changes.length) { console.log('Evolution webhook relay already up to date'); return; }
  const backupDir = `${appDir}/backups/evolution-webhook-relay-${Date.now()}`;
  await exec(`mkdir -p ${backupDir}`);
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
    // Recibo de entrega de teste: tem de ser descartado pela API (não chega ao n8n).
    const probe = JSON.stringify({ event: 'messages.update', instance: 'botmercadodovale', data: { keyId: 'deploy-probe', status: 'DELIVERY_ACK' } });
    const relay = await exec(`curl -s -m 5 -X POST -H "content-type: application/json" -d '${probe}' http://127.0.0.1:4000/webhooks/evolution/whatsapp || true`);
    if (!/"relayed":\s*false/.test(relay)) throw new Error(`Rota do relay não respondeu como esperado (${relay.trim().slice(0, 120)})`);
    console.log(`Evolution webhook relay: ${changes.map(change => change.remote).join(', ')}`);
    console.log(`Evolution webhook relay backup: ${backupDir}`);
  } catch (error) {
    await restore();
    throw error;
  }
}

module.exports = { deployEvolutionWebhookRelay, FILES };
