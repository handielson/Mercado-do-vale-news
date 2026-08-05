import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /resource === 'categories'/, `${file} must route Bling categories through Fastify`);
  assert.match(source, /resource === 'products'/, `${file} must route Bling product list/search through Fastify`);
  assert.match(source, /https:\/\/www\.bling\.com\.br\/Api\/v3\/categorias\/produtos\?pagina=\$\{page\}&limite=100/, `${file} must preserve the Bling categories endpoint`);
  assert.match(source, /https:\/\/www\.bling\.com\.br\/Api\/v3\/produtos\?pagina=\$\{page\}&limite=100&criterio=5/, `${file} must preserve the Bling products endpoint`);
  assert.match(source, /Missing Authorization header/, `${file} must reject Bling proxy calls without Authorization`);
  assert.match(source, /fetchLooseBlingProductSearchVps\(/, `${file} must keep loose fallback search for products`);
  assert.match(source, /nome=\$\{encodeURIComponent\(search\)\}/, `${file} must query Bling products by name`);
  assert.match(source, /codigo=\$\{encodeURIComponent\(search\)\}/, `${file} must query Bling products by SKU`);
  assert.match(source, /searchMode: 'direct'/, `${file} must label direct search responses`);
  assert.match(source, /searchMode: 'loose'/, `${file} must label loose fallback responses`);
  assert.match(source, /normalizeBlingSearchTextVps\(item\.codigo\) === normalizeBlingSearchTextVps\(search\)/, `${file} must stop fallback pagination as soon as the exact SKU is found`);
  assert.match(source, /buildCopyableDebug\('bling-products'/, `${file} must return copyable product debug details`);

  const debugPayloads = source.match(/buildCopyableDebug\('bling-products',\s*(?:\{[\s\S]*?\n\s*\}|responseDebug|debug)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped Bling product debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\bauthorization\b/i, `${file} must not include Authorization headers in product debug payloads`);
  }
}

console.log('vps Bling products Fastify static checks ok');
