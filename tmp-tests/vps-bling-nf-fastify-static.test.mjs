import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /resource === 'nf-detail'/, `${file} must route Bling nf-detail through Fastify`);
  assert.match(source, /resource === 'nfe' \|\| resource === 'nfce'/, `${file} must route Bling nfe and nfce through Fastify`);
  assert.match(source, /tipo must be nfe or nfce/, `${file} must validate nf-detail tipo`);
  assert.match(source, /id is required/, `${file} must validate nf-detail id`);
  assert.match(source, /https:\/\/www\.bling\.com\.br\/Api\/v3\/\$\{tipo\}\/\$\{id\}/, `${file} must fetch nf-detail by tipo and id`);
  assert.match(source, /const endpoint = resource === 'nfe' \? 'nfe' : 'nfce'/, `${file} must map nfe/nfce endpoints`);
  assert.match(source, /dataEmissaoInicio[\s\S]*dataEmissaoInicial/, `${file} must accept local and Bling native start emission filters`);
  assert.match(source, /dataEmissaoFim[\s\S]*dataEmissaoFinal/, `${file} must accept local and Bling native end emission filters`);
  assert.match(source, /dataEmissaoInicial=\$\{inicio\}/, `${file} must forward start emission filter`);
  assert.match(source, /dataEmissaoFinal=\$\{fim\}/, `${file} must forward end emission filter`);
  assert.match(source, /situacao=\$\{situacao\}/, `${file} must forward nota fiscal status filter`);
  assert.match(source, /getBlingProductDetailAuthHeaderVps\(request\)/, `${file} must support stored Bling token fallback`);
  assert.match(source, /buildCopyableDebug\('bling-nf'/, `${file} must return copyable debug details for NF failures`);

  const debugPayloads = source.match(/buildCopyableDebug\('bling-nf',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped NF debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(authorization|access_token|refresh_token|client_secret|apikey)\b/i, `${file} must not expose secrets in NF debug payloads`);
  }
}

console.log('vps Bling NF Fastify static checks ok');
