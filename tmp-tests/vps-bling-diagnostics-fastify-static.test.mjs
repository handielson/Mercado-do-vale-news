import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /resource === 'image-proxy'/, `${file} must route Bling image-proxy through Fastify`);
  assert.match(source, /Missing url parameter/, `${file} must validate image-proxy url`);
  assert.match(source, /Only https URLs are supported/, `${file} must reject non-https image URLs`);
  assert.match(source, /Unsupported image host/, `${file} must reject unsupported image hosts`);
  assert.match(source, /orgbling\.s3\.amazonaws\.com/, `${file} must allow Bling S3 image host`);
  assert.match(source, /xiaomipetrolina\.com\.br[\s\S]*mercadodovale\.com\.br[\s\S]*supabase\.co/, `${file} must preserve allowed image host suffixes`);
  assert.match(source, /Cache-Control'[\s\S]*max-age=31536000[\s\S]*immutable/, `${file} must cache proxied images immutably`);

  assert.match(source, /resource === 'debug-product'/, `${file} must route Bling debug-product through Fastify`);
  assert.match(source, /blingId is required/, `${file} must validate debug blingId`);
  assert.match(source, /https:\/\/www\.bling\.com\.br\/Api\/v3\/produtos\/\$\{debugBlingId\}/, `${file} must fetch Bling product debug details`);

  assert.match(source, /resource === 'debug-diagnostic'/, `${file} must route Bling debug-diagnostic through Fastify`);
  assert.match(source, /estoques\/saldos\?idsProdutos\[\]=\$\{debugBlingId\}/, `${file} must fetch stock diagnostic details`);
  assert.match(source, /stock: stockBody\.json[\s\S]*product: productBody\.json/, `${file} must return stock and product diagnostics`);
  assert.match(source, /getBlingProductDetailAuthHeaderVps\(request\)/, `${file} must support stored token fallback for diagnostics`);
  assert.match(source, /buildCopyableDebug\('bling-diagnostics'/, `${file} must return copyable debug details for diagnostics`);
  assert.match(source, /image-proxy\|debug-product\|debug-diagnostic/, `${file} must list diagnostics as migrated`);

  const debugPayloads = source.match(/buildCopyableDebug\('bling-diagnostics',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped diagnostics debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(authorization|access_token|refresh_token|client_secret|apikey)\b/i, `${file} must not expose secrets in diagnostics debug payloads`);
  }
}

console.log('vps Bling diagnostics Fastify static checks ok');
