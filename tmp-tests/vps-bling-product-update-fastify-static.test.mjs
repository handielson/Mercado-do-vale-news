import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /resource === 'product-update-fiscal'/, `${file} must route Bling product-update-fiscal through Fastify`);
  assert.match(source, /resource === 'product-update-dimensions'/, `${file} must route Bling product-update-dimensions through Fastify`);

  assert.match(source, /blingId required/, `${file} must validate fiscal update blingId`);
  assert.match(source, /At least one of ncm, cest or origem required/, `${file} must validate fiscal update payload`);
  assert.match(source, /tributacaoAtual[\s\S]*tributacaoNova[\s\S]*ncm[\s\S]*cest[\s\S]*origem/, `${file} must merge fiscal tributacao fields without dropping existing ones`);

  assert.match(source, /blingIds array and updateData required/, `${file} must validate dimension batch update payload`);
  assert.match(source, /for \(const blingId of blingIds\)/, `${file} must update dimensions for each requested Bling product`);
  assert.match(source, /pesoBruto[\s\S]*updateData\.pesoBruto[\s\S]*dimensoes[\s\S]*updateData\.dimensoes/, `${file} must merge dimension fields into current Bling product`);

  assert.match(source, /delete payload\.estoque/, `${file} must remove readonly estoque before sending Bling product updates`);
  assert.match(source, /method: 'PUT'[\s\S]*https:\/\/www\.bling\.com\.br\/Api\/v3\/produtos\/\$\{/, `${file} must PUT merged product payloads back to Bling`);
  assert.match(source, /getBlingProductDetailAuthHeaderVps\(request\)/, `${file} must support stored Bling token fallback for product updates`);
  assert.match(source, /buildCopyableDebug\('bling-product-update'/, `${file} must return copyable debug details for product update failures`);
  assert.match(source, /product-update-fiscal\|product-update-dimensions/, `${file} must list product update resources as migrated`);

  const debugPayloads = source.match(/buildCopyableDebug\('bling-product-update',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped product-update debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(authorization|access_token|refresh_token|client_secret|body)\b/i, `${file} must not expose secrets or raw request bodies in product-update debug payloads`);
  }
}

console.log('vps Bling product update Fastify static checks ok');
