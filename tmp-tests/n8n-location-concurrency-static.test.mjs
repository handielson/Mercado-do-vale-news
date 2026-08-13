import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const patch = readFileSync('tmp-tests/n8n-fix-location-concurrency.cjs', 'utf8');
for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /messages\/is-current/, `${file} must expose current-inbound guard`);
  assert.match(source, /ORDER BY id DESC[\s\S]*LIMIT 1/, `${file} must compare against the latest inbound row`);
  assert.match(source, /waMessageId === latestWaMessageId/, `${file} must suppress stale executions by WhatsApp message id`);
}
assert.match(patch, /consultar_localizacao_loja/, 'workflow must restore explicit store-location action');
assert.match(patch, /Loja - Buscar Dados Empresa/, 'location action must use the existing deterministic company-data specialist');
assert.match(patch, /deterministicStoreLocationV129 \|\|/, 'store-location request must override a wrong AI classification');
assert.match(patch, /classifiedStoreLocationV244/, 'resolver must preserve the already classified store-location intent');
assert.match(patch, /Controle Bot - Verificar mensagem atual/, 'workflow must check for a newer inbound before output logging/sending');
assert.match(patch, /const suffix = shouldInviteName/, 'optional name invitation must come after the main answer');
assert.match(patch, /Contato - Preparar'\)\.first\(\)\.json/, 'contact saved response must use an upstream node that always executed');
assert.doesNotMatch(patch, /connections\['Dividir mensagens'\] = \{ main: \[\[\{ node: 'Controle Bot - Registrar Saida'/, 'old direct output path must be removed');

console.log('n8n location and concurrent-message static checks passed');
