import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const files = ['vps_server.js', 'vps_server.cjs'];

for (const file of files) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /function isAutoresponderDeviceAvailabilityRequest\(message = '', query = ''\)/,
    `${file} must detect device availability requests such as "tem celular Samsung?"`,
  );

  assert.match(
    source,
    /function buildAutoresponderUnavailableDeviceReply\(\{ message = '', query = '', products = \[\] \} = \{\}\)/,
    `${file} must build a deterministic unavailable-device reply`,
  );

  assert.match(
    source,
    /No momento nao encontrei \$\{label\} disponivel em estoque/,
    `${file} unavailable-device reply must tell the customer the device is not in stock`,
  );

  assert.match(
    source,
    /Encontrei apenas acessorios relacionados/,
    `${file} unavailable-device reply must distinguish accessories from the requested device`,
  );

  assert.match(
    source,
    /source: 'unavailable_device'[\s\S]*deterministicReply: true/,
    `${file} catalog_search must return a deterministic response for unavailable devices`,
  );

  assert.match(
    source,
    /if \(catalogToolData\.deterministicReply\)[\s\S]*intent: 'ai_tool_unavailable_device'/,
    `${file} webhook must send deterministic unavailable-device replies without waiting for AI response text`,
  );
}

console.log('autoresponder unavailable device static checks passed');
