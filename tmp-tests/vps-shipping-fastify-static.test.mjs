import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.post\('\/api\/shipping'/, `${file} must expose /api/shipping on Fastify`);
  assert.match(source, /async function\s+handleShippingApiVps\(/, `${file} must centralize shipping provider routing`);
  assert.match(source, /provider === 'frenet' && action === 'calculate'/, `${file} must support Frenet calculate`);
  assert.match(source, /https:\/\/api\.frenet\.com\.br\/shipping\/quote/, `${file} must call Frenet quote endpoint`);
  assert.match(source, /ShippingItemArray/, `${file} must preserve Frenet request contract`);
  assert.match(source, /provider === 'melhor-envio' && action === 'calculate'/, `${file} must support Melhor Envio calculate`);
  assert.match(source, /api\/v2\/me\/shipment\/calculate/, `${file} must call Melhor Envio calculate endpoint`);
  assert.match(source, /provider === 'melhor-envio' && action === 'label'/, `${file} must support Melhor Envio label`);
  assert.match(source, /api\/v2\/me\/cart/, `${file} must add labels to Melhor Envio cart first`);
  assert.match(source, /api\/v2\/me\/shipment\/checkout/, `${file} must checkout Melhor Envio label orders`);
  assert.match(source, /api\/v2\/me\/shipment\/generate/, `${file} must generate Melhor Envio labels`);
  assert.match(source, /User-Agent': 'MercadoDoVale\/1\.0/, `${file} must keep Melhor Envio User-Agent`);
  assert.match(source, /buildCopyableDebug\('shipping'/, `${file} must return copyable debug details on failures`);

  const shippingDebugPayloads = source.match(/buildCopyableDebug\('shipping',\s*\{[\s\S]*?\n\s*\}\)/g) || [];
  assert.ok(shippingDebugPayloads.length > 0, `${file} must include scoped shipping debug payloads`);
  for (const payload of shippingDebugPayloads) {
    assert.doesNotMatch(payload, /\btoken\b/i, `${file} must not include raw tokens in shipping debug payloads`);
  }
}

console.log('vps shipping Fastify static checks ok');
