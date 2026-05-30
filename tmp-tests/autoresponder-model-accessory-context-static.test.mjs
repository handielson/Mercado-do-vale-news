import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverFiles = ['vps_server.cjs', 'vps_server.js'];

for (const fileName of serverFiles) {
  const source = readFileSync(fileName, 'utf8');

  assert.ok(source.includes('detectAutoresponderDeviceFamilyFromSearch'), `${fileName} must detect smartphone, tablet, and receiver model searches`);
  assert.ok(source.includes('isAutoresponderAccessoryProduct'), `${fileName} must classify accessory products before formatting model replies`);
  assert.ok(source.includes('buildAutoresponderModelAccessorySearchTitle'), `${fileName} must centralize model/accessory intro text`);
  assert.ok(source.includes('Encontramos alguns acessorios para esse smartphone:'), `${fileName} must explain accessory matches for smartphone models`);
  assert.ok(source.includes('Encontramos alguns acessorios para esse tablet:'), `${fileName} must explain accessory matches for tablet models`);
  assert.ok(source.includes('Encontramos alguns acessorios para esse receptor:'), `${fileName} must explain accessory matches for receiver models`);
  assert.ok(
    source.includes('buildAutoresponderModelAccessorySearchTitle(chunk, keyword, total)'),
    `${fileName} must use the contextual intro inside product search replies`
  );
}

const checklist = readFileSync('Bot_Whatsapp.md', 'utf8');
assert.ok(checklist.includes('Busca de modelo com acessorios relacionados'), 'Bot_Whatsapp.md must document model accessory context progress');
assert.ok(checklist.includes('tmp-tests/autoresponder-model-accessory-context-static.test.mjs'), 'Bot_Whatsapp.md must mention the model accessory context test');

console.log('autoresponder model accessory context static checks passed');
