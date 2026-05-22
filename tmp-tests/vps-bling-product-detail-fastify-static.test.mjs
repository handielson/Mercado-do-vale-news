import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /resource === 'product-detail'/, `${file} must route Bling product-detail through Fastify`);
  assert.match(source, /Product ID required/, `${file} must validate product-detail id`);
  assert.match(source, /select=id,bling_access_token,bling_refresh_token,bling_token_expires_at,bling_client_id,bling_client_secret/, `${file} must load stored Bling tokens for product-detail fallback auth`);
  assert.match(source, /refreshBlingStoredAccessTokenVps\(/, `${file} must refresh expired stored Bling tokens`);
  assert.match(source, /https:\/\/www\.bling\.com\.br\/Api\/v3\/produtos\/\$\{id\}/, `${file} must fetch Bling product detail by id`);
  assert.match(source, /https:\/\/www\.bling\.com\.br\/Api\/v3\/estoques\/saldos\?pagina=1&limite=100&idsProdutos\[\]=\$\{id\}/, `${file} must fetch Bling stock balance for product detail`);
  assert.match(source, /https:\/\/www\.bling\.com\.br\/Api\/v3\/produtos\/variacoes\/\$\{id\}/, `${file} must support product variation detail`);
  assert.match(source, /stock_quantity:\s*Number\(stockQuantity\)/, `${file} must return normalized stock_quantity`);
  assert.match(source, /saldoFisicoTotal[\s\S]*saldoFisico[\s\S]*saldoVirtualTotal[\s\S]*saldoVirtual/, `${file} must preserve Bling stock field fallback order`);
  assert.match(source, /buildCopyableDebug\('bling-product-detail'/, `${file} must return copyable debug details for product-detail failures`);

  const debugPayloads = source.match(/buildCopyableDebug\('bling-product-detail',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped product-detail debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(authorization|bling_access_token|bling_refresh_token|client_secret)\b/i, `${file} must not expose Bling secrets in product-detail debug payloads`);
  }
}

console.log('vps Bling product-detail Fastify static checks ok');
