import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../deploy-vps-server-only.cjs', import.meta.url), 'utf8');

for (const relativePath of [
  'services/smartphoneModelFamily.cjs',
  'services/physicalRamCore.cjs',
  'services/smartphonePhotoIntakeCore.cjs',
  'services/smartphonePhotoIntakeServer.cjs',
  'services/smartphoneBarcodeCrossCheck.cjs',
  'services/smartphoneBarcodeReader.cjs',
  'services/smartphonePriceGroupsCore.cjs',
  'services/smartphonePriceGroupsServer.cjs',
  'services/smartphoneMovingAverageCore.cjs',
  'services/smartphoneMovingAverageServer.cjs',
  'services/smartphoneModelSpecs.mjs',
  'services/modelBlingMapping.mjs',
]) {
  assert.ok(source.includes(relativePath), `o deploy da API deve enviar ${relativePath}`);
}
assert.match(source, /await uploadSmartphonePhotoIntakeFiles\(appDir\)/, 'o upload do módulo deve acontecer antes do restart');
assert.match(source, /--photo-intake-only[\s\S]*pm2 restart mdv-api[\s\S]*return;/, 'deploy seletivo deve terminar antes de enviar outros módulos');
assert.match(source, /--photo-intake-only[\s\S]*await assertSmartphoneMovingAverageSchema\(appDir\);[\s\S]*await uploadSmartphonePhotoIntakeFiles/, 'schema de custo e diario precisam estar instalados antes do upload');
assert.match(source, /await assertSmartphoneMovingAverageSchema\(appDir\);\s*console.log\(`Uploading server/, 'deploy completo tambem verifica o schema antes de enviar o servidor');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const zxingVersion = source.match(/const ZXING_WASM_VERSION = '([0-9.]+)'/)?.[1];
assert.ok(zxingVersion, 'o deploy deve fixar a versão do leitor de barras');
assert.equal(pkg.dependencies['zxing-wasm'], zxingVersion, 'package.json e deploy devem usar a mesma versão do zxing-wasm');
assert.match(source, /async function uploadSmartphonePhotoIntakeFiles[\s\S]*npm install zxing-wasm@\$\{ZXING_WASM_VERSION\}[\s\S]*require\('\.\/services\/smartphoneBarcodeReader\.cjs'\)/, 'o deploy deve instalar o zxing-wasm e testar o carregamento antes do restart');

console.log('smartphone photo intake deploy static test passed');
