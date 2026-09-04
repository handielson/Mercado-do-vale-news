import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../deploy-vps-server-only.cjs', import.meta.url), 'utf8');

for (const relativePath of [
  'services/physicalRamCore.cjs',
  'services/smartphonePhotoIntakeCore.cjs',
  'services/smartphonePhotoIntakeServer.cjs',
  'services/smartphonePriceGroupsCore.cjs',
  'services/smartphonePriceGroupsServer.cjs',
  'services/modelBlingMapping.mjs',
]) {
  assert.ok(source.includes(relativePath), `o deploy da API deve enviar ${relativePath}`);
}
assert.match(source, /await uploadSmartphonePhotoIntakeFiles\(appDir\)/, 'o upload do módulo deve acontecer antes do restart');
assert.match(source, /--photo-intake-only[\s\S]*pm2 restart mdv-api[\s\S]*return;/, 'deploy seletivo deve terminar antes de enviar outros módulos');

console.log('smartphone photo intake deploy static test passed');
