import fs from 'node:fs';
import assert from 'node:assert/strict';

const MSG = 'Aparelho não pode ficar no produto pai. Use a variação (cor/memória).';
for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  for (const route of ["fastify.post('/units',", "fastify.post('/units/batch',"]) {
    const start = src.indexOf(route);
    assert.ok(start > 0, `${file}: ${route} nao encontrado`);
    const next = src.indexOf('\nfastify.', start + 10);
    const body = src.slice(start, next > 0 ? next : start + 4000);
    const guard = body.indexOf('is_parent');
    const msg = body.indexOf(MSG);
    const conflict = body.indexOf('findUnitSerializedIdentifierConflict');
    assert.ok(guard > 0, `${file} ${route}: sem checagem is_parent`);
    assert.ok(msg > 0, `${file} ${route}: sem mensagem 409`);
    assert.ok(guard < conflict && msg < conflict, `${file} ${route}: guarda deve vir antes do conflito de identificador`);
  }
}
const deploy = fs.readFileSync(new URL('../deploy-vps-server-only.cjs', import.meta.url), 'utf8');
assert.ok(deploy.includes('--catalog-entry-only'), 'deploy sem --catalog-entry-only');
for (const f of ['services/catalogEntryCore.cjs', 'services/catalogEntryServer.cjs', 'services/smartphoneModelFamily.cjs', 'services/smartphonePhotoIntakeServer.cjs', 'services/smartphonePhotoIntakeCore.cjs']) {
  assert.ok(deploy.includes(f), `deploy sem ${f}`);
}
console.log('ok');
