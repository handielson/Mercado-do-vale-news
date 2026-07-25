import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../vps_server.js', import.meta.url), 'utf8');
const mirrors = fs.readFileSync(new URL('../vps_server.cjs', import.meta.url), 'utf8');
const activity = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/MainActivity.kt', import.meta.url),
  'utf8',
);
const apiClient = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/data/VpsApiClient.kt', import.meta.url),
  'utf8',
);
const manifest = fs.readFileSync(
  new URL('../android/admin-estoque/app/src/main/AndroidManifest.xml', import.meta.url),
  'utf8',
);

assert.equal(source, mirrors, 'vps_server.js e vps_server.cjs devem permanecer identicos');

for (const route of [
  '/stock-locations/deposits',
  '/stock-locations/locations',
  '/stock-locations/products/:productId/distribution',
  '/stock-locations/locations/:locationId/contents',
]) {
  assert.match(source, new RegExp(`fastify\\.get\\('${route.replace(/[/:]/g, '\\$&')}', \\{ preHandler: requireSyncKeyOrAdmin \\}`));
}

assert.match(source, /fastify\.post\('\/stock-locations\/transfers', \{ preHandler: requireSyncKeyOrAdmin \}/);
assert.match(source, /const LABEL_TEMPLATES_PREFERENCE_KEY = 'label\.templates';/);
assert.match(source, /fastify\.get\('\/admin\/label-templates', \{ preHandler: requireSyncKeyOrAdmin \}/);
assert.match(source, /fastify\.patch\('\/admin\/label-templates', \{ preHandler: requireSyncKeyOrAdmin \}/);

assert.match(apiClient, /customerType\.equals\("ADMIN", ignoreCase = true\)/, 'o app deve rejeitar login que nao seja administrativo');
assert.match(activity, /\/products\?search=\$encoded&compact=true&limit=10/, 'a busca Android deve usar a resposta compacta e limitada');
assert.match(activity, /val products = JSONArray\(body\)/, 'a busca Android deve interpretar o array retornado por GET /products');
assert.match(activity, /O envio permanece bloqueado at/, 'o app nao deve afirmar que imprimiu antes da validacao fisica da P50');
assert.match(manifest, /android\.permission\.BLUETOOTH"[\s\S]*android:maxSdkVersion="30"/, 'Android 8-11 precisa da permissao Bluetooth legada');
assert.match(manifest, /android\.permission\.BLUETOOTH_CONNECT/, 'Android 12+ precisa de BLUETOOTH_CONNECT para dispositivo pareado');
assert.doesNotMatch(manifest, /android\.permission\.BLUETOOTH_SCAN/, 'o app nao deve pedir permissao de scan sem executar descoberta');

console.log('android admin VPS contract: OK');
