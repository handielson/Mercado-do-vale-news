import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /resource === 'stock'/, `${file} must route Bling stock through Fastify`);
  assert.match(source, /resource === 'stock-sync'/, `${file} must route Bling stock-sync through Fastify`);
  assert.match(source, /Missing Authorization header/, `${file} must reject stock reads without Authorization`);
  assert.match(source, /reqIdsProdutos|idsProdutos/, `${file} must forward idsProdutos filters to Bling stock`);
  assert.match(source, /https:\/\/api\.bling\.com\.br\/Api\/v3\/estoques\/saldos\?pagina=\$\{page\}&limite=100/, `${file} must preserve the official Bling stock balance endpoint`);
  assert.match(source, /if\s*\(stockResponse\.status === 400\)[\s\S]*\{ data: \[\] \}/, `${file} must normalize Bling stock 400 responses to an empty data array`);
  assert.match(source, /blingId and quantity required/, `${file} must validate stock-sync payload`);
  assert.match(source, /https:\/\/api\.bling\.com\.br\/Api\/v3\/depositos\?pagina=1&limite=1/, `${file} must fetch a Bling deposit before stock-sync`);
  assert.match(source, /https:\/\/api\.bling\.com\.br\/Api\/v3\/estoques['"`]/, `${file} must post stock movements to Bling`);
  assert.match(source, /const normalizedOperation = String\(operation \|\| 'S'\)/, `${file} must preserve outgoing stock as the default operation`);
  assert.match(source, /operacao:\s*normalizedOperation/, `${file} must support outgoing and incoming stock movements`);
  assert.match(source, /normalizedOperation === 'E' \? 'Devolucao Mercado do Vale' : 'Venda PDV Mercado do Vale'/, `${file} must preserve direction-specific default notes`);
  assert.match(source, /buildCopyableDebug\('bling-stock'/, `${file} must return copyable debug details for stock failures`);
  assert.match(source, /buildCopyableDebug\('bling-stock-sync'/, `${file} must return copyable debug details for stock-sync failures`);

  const debugPayloads = source.match(/buildCopyableDebug\('bling-stock(?:-sync)?',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped stock debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(authorization|bling_access_token|bling_refresh_token|client_secret)\b/i, `${file} must not expose Bling secrets in stock debug payloads`);
  }
}

console.log('vps Bling stock Fastify static checks ok');
