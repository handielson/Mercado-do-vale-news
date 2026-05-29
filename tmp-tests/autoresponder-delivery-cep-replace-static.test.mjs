import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  assert(
    source.includes('async function handleAutoresponderDeliveryCepLookup'),
    `${fileName} must extract CEP lookup into a reusable handler`
  );
  assert(
    source.includes('normalizeAutoresponderCep(message)'),
    `${fileName} must normalize incoming CEP messages to digits only`
  );

  const confirmationIndex = source.indexOf("purchaseFlow.status === 'awaiting_delivery_cep_confirmation'");
  const directCepIndex = source.indexOf('const replacementCep = normalizeAutoresponderCep(message)', confirmationIndex);
  const directLookupIndex = source.indexOf('handleAutoresponderDeliveryCepLookup({', directCepIndex);
  const resetPromptIndex = source.indexOf("status: 'awaiting_delivery_address'", confirmationIndex);

  assert(confirmationIndex >= 0, `${fileName} must handle CEP confirmation state`);
  assert(
    directCepIndex > confirmationIndex &&
      directLookupIndex > directCepIndex &&
      (resetPromptIndex < 0 || directLookupIndex < resetPromptIndex),
    `${fileName} must look up a replacement CEP immediately before resetting the prompt`
  );
}

console.log('autoresponder delivery CEP replacement static checks passed');
