import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /resource === 'finance'/, `${file} must route Bling finance through Fastify`);
  assert.match(source, /Missing Authorization header/, `${file} must reject finance calls without Authorization`);
  assert.match(source, /resourceType must be "pagar" or "receber"/, `${file} must validate finance resourceType`);
  assert.match(source, /resourceType === 'pagar' \? 'contas\/pagar' : 'contas\/receber'/, `${file} must map finance resourceType to Bling endpoints`);
  assert.match(source, /action === 'list' && request\.method === 'GET'/, `${file} must support finance list`);
  assert.match(source, /dataVencimentoInicio[\s\S]*dataVencimentoInicial/, `${file} must forward native finance start due date filter`);
  assert.match(source, /dataVencimentoFim[\s\S]*dataVencimentoFinal/, `${file} must forward native finance end due date filter`);
  assert.match(source, /situacao === 'pago' \? 2 : situacao === 'cancelado' \? 5 : situacao === 'em_aberto' \? 1 : situacao/, `${file} must preserve finance situacao mapping`);
  assert.doesNotMatch(source, /dataInicial|dataFinal|situacoes\[\]/, `${file} must not use non-native finance filters`);
  assert.match(source, /action === 'get' && request\.method === 'GET' && id/, `${file} must support finance get`);
  assert.match(source, /action === 'get-bordero' && request\.method === 'GET' && id/, `${file} must support finance bordero reads`);
  assert.match(source, /\/borderos\/\$\{id\}/, `${file} must call the Bling borderos detail endpoint`);
  assert.match(source, /action === 'create' && request\.method === 'POST'/, `${file} must support finance create`);
  assert.match(source, /action === 'update' && request\.method === 'PUT' && id/, `${file} must support finance update`);
  assert.match(source, /action === 'baixar' && request\.method === 'POST' && id/, `${file} must support finance baixar`);
  assert.match(source, /\/baixar`/, `${file} must call the Bling baixar endpoint`);
  assert.match(source, /action === 'cancelar' && request\.method === 'DELETE' && id/, `${file} must support finance cancelar`);
  assert.match(source, /buildCopyableDebug\('bling-finance'/, `${file} must return copyable debug details for finance failures`);

  const debugPayloads = source.match(/buildCopyableDebug\('bling-finance',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped finance debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(authorization|access_token|refresh_token|client_secret|body)\b/i, `${file} must not expose secrets or raw bodies in finance debug payloads`);
  }
}

console.log('vps Bling finance Fastify static checks ok');
