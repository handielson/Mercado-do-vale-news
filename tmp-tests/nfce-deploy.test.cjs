const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('deploy NFC-e confere módulos CJS com extensão reconhecida e limita ambiente a homologação', () => {
  const source = fs.readFileSync(path.join(__dirname,'../scripts/deploy-nfce-homologation.cjs'),'utf8');
  const entry = fs.readFileSync(path.join(__dirname,'../deploy-vps-server-only.cjs'),'utf8');
  assert.match(source,/\.next\.cjs/);
  assert.match(source,/node --check \$\{staged\}/);
  assert.match(source,/MDV_NFCE_HOMOLOGATION_PREPARE_ENABLED/);
  assert.match(source,/MDV_NFCE_HOMOLOGATION_TRANSMIT_ENABLED/);
  assert.doesNotMatch(source,/MDV_NFCE_PRODUCTION/);
  assert.match(entry,/--nfce-homologation-only/);
  assert.match(entry,/--nfce-homologation-check/);
});
