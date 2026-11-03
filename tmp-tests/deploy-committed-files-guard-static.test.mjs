import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const deploy = readFileSync('deploy-vps-server-only.cjs', 'utf8');
const block = deploy.slice(deploy.indexOf("if (process.argv.includes('--sales-marketplaces-only')) {"));
// 03/11/2026: o deploy levou trabalho nao commitado de outro agente em mercadoLivreServer.cjs.
assert.match(block, /deploy-committed-files-guard-v1/);
assert.match(block, /spawnSync\('git', \['status', '--porcelain', '--', \.\.\.guardFiles\]/, 'confere o git antes de enviar');
assert.ok(block.indexOf('deploy-committed-files-guard-v1') < block.indexOf('await upload('), 'confere antes do primeiro upload');
for (const name of ["'vps_server.js'", 'mercadoLivreServicePath', 'mercadoLivrePublicationPath', 'marketplaceSalesStorePath']) {
  assert.ok(block.slice(0, block.indexOf('await upload(')).includes(name), `guarda cobre ${name}`);
}
console.log('deploy committed files guard ok');
