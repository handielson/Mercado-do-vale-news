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
    // stock-entry-lock-v1: so a manutencao passa; as guardas de pai e IMEI continuam valendo para ela.
    const lock = body.indexOf('if (!isStockMaintenanceRequest(req, ');
    assert.ok(lock > 0, `${file} ${route}: sem trava da Entrada`);
    assert.ok(body.slice(lock).includes('reply.code(409).send(stockEntryLockPayload())'), `${file} ${route}: trava sem 409`);
    assert.ok(lock < guard && lock < conflict, `${file} ${route}: trava deve vir antes das guardas`);
  }
  assert.ok(src.includes("const STOCK_ENTRY_LOCK_MESSAGE = 'Entrada de estoque é feita pela tela Entrada (Admin → Entrada).';"), `${file}: sem mensagem da trava`);
  assert.match(src, /item\.origin === 'maintenance'/, `${file}: excecao de manutencao exige origin`);
  assert.match(src, /request\.headers\?\.\['x-sync-key'\]/, `${file}: excecao de manutencao exige x-sync-key`);
  assert.match(src, /request\.headers\?\.\['x-stock-maintenance'\]/, `${file}: excecao de manutencao exige x-stock-maintenance`);
}
const rebuild = fs.readFileSync(new URL('../scripts/rebuild-smartphone-serialized-units.cjs', import.meta.url), 'utf8');
assert.match(rebuild, /origin: 'maintenance'/, 'script de manutencao sem origin');
assert.match(rebuild, /'x-stock-maintenance': '1'/, 'script de manutencao sem cabecalho');
const deploy = fs.readFileSync(new URL('../deploy-vps-server-only.cjs', import.meta.url), 'utf8');
assert.ok(deploy.includes('--catalog-entry-only'), 'deploy sem --catalog-entry-only');
for (const f of ['services/catalogEntryCore.cjs', 'services/catalogEntryServer.cjs', 'services/smartphoneModelFamily.cjs', 'services/smartphonePhotoIntakeServer.cjs', 'services/smartphonePhotoIntakeCore.cjs']) {
  assert.ok(deploy.includes(f), `deploy sem ${f}`);
}
console.log('ok');
