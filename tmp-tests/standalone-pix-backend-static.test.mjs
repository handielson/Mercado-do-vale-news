import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const server = readFileSync('vps_server.js', 'utf8');
const serverCjs = readFileSync('vps_server.cjs', 'utf8');

function assertBackend(source, label) {
  for (const snippet of [
    "fastify.post('/pix/standalone'",
    "fastify.get('/pix/standalone'",
    "fastify.get('/pix/standalone/:id/status'",
    "fastify.post('/pix/standalone/:id/share-whatsapp'",
    "fastify.get('/google-contacts/search'",
    'searchGoogleContacts',
    'people:searchContacts',
    'getGoogleContactsAccessToken',
    "fastify.get('/pix/public/:token'",
    "metadata: {",
    "flow: 'standalone_pix'",
    "external_reference: `standalone_pix:${id}`",
    'date_of_expiration',
    'STANDALONE_PIX_EXPIRATION_MINUTES = 10',
    'public_token',
    'cancel_reason',
    'unpaid_expired',
    'shared_phone',
    'share_channel',
    'cash_closing_id',
    'Cancelado por falta de pagamento',
    'clearDisplayActivePixIfMatches',
  ]) {
    assert.ok(source.includes(snippet), `${label} must include ${snippet}`);
  }

  assert.match(
    source,
    /addColumnIfMissing\('pdv_pix_payments', 'source', "VARCHAR\(40\) NOT NULL DEFAULT 'pdv_sale'"\)/,
    `${label} must add source column with pdv_sale default`
  );
  assert.match(
    source,
    /addColumnIfMissing\('pdv_pix_payments', 'expires_at', 'DATETIME NULL'\)/,
    `${label} must add expires_at column`
  );
  assert.match(
    source,
    /normalizeStandalonePixStatusLabel[\s\S]*Cancelado por falta de pagamento/,
    `${label} must expose unpaid expiration label`
  );
  assert.match(
    source,
    /fastify\.get\('\/google-contacts\/search', \{ preHandler: requireSyncKey \}/,
    `${label} must protect Google Contacts search with sync key`
  );
}

assertBackend(server, 'vps_server.js');
assertBackend(serverCjs, 'vps_server.cjs');

console.log('standalone pix backend static checks passed');
