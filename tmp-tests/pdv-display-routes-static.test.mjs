import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const server = readFileSync(resolve(root, 'vps_server.js'), 'utf8');
const serverCjs = readFileSync(resolve(root, 'vps_server.cjs'), 'utf8');

function assertIncludes(source, expected, label) {
  assert.ok(source.includes(expected), `${label} deve conter: ${expected}`);
}

function assertServerHasDisplayBackend(source, label) {
  for (const table of [
    'CREATE TABLE IF NOT EXISTS pdv_displays',
    'CREATE TABLE IF NOT EXISTS pdv_display_pairing_codes',
    'CREATE TABLE IF NOT EXISTS pdv_display_tokens',
    'CREATE TABLE IF NOT EXISTS pdv_pix_payments',
  ]) {
    assertIncludes(source, table, label);
  }

  for (const route of [
    "fastify.get('/pdv/displays'",
    "fastify.post('/pdv/displays'",
    "fastify.patch('/pdv/displays/:id'",
    "fastify.delete('/pdv/displays/:id'",
    "fastify.post('/pdv/displays/:id/pairing-code'",
    "fastify.post('/pdv/displays/pair'",
    "fastify.post('/pdv/displays/:displayId/revoke-token'",
    "fastify.post('/pdv/displays/trash/cleanup'",
    "fastify.post('/pdv/pix-payments'",
    "fastify.get('/pdv/pix-payments/:id/status'",
    "fastify.post('/pdv/displays/:displayId/active-pix'",
    "fastify.delete('/pdv/displays/:displayId/active-pix'",
    "fastify.get('/pdv/display-state'",
  ]) {
    assertIncludes(source, route, label);
  }

  assertIncludes(source, "payment_integrations WHERE gateway_name = 'mercado_pago'", label);
  assertIncludes(source, 'Authorization: `Bearer ${accessToken}`', label);
  assertIncludes(source, 'hashPdvDisplaySecret', label);
}

assertServerHasDisplayBackend(server, 'vps_server.js');
assertServerHasDisplayBackend(serverCjs, 'vps_server.cjs');

console.log('pdv display backend static checks passed');
