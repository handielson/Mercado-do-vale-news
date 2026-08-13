import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../deploy-vps-server-only.cjs', import.meta.url), 'utf8');

for (const relativePath of [
  'services/physicalRamCore.cjs',
  'services/smartphonePhotoIntakeCore.cjs',
  'services/smartphonePhotoIntakeServer.cjs',
]) {
  assert.ok(source.includes(relativePath), `o deploy da API deve enviar ${relativePath}`);
}
assert.match(source, /await uploadSmartphonePhotoIntakeFiles\(appDir\)/, 'o upload do módulo deve acontecer antes do restart');

console.log('smartphone photo intake deploy static test passed');
