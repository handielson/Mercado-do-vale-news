import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const server = readFileSync('vps_server.js', 'utf8');
const serverCjs = readFileSync('vps_server.cjs', 'utf8');

function assertBackend(source, label) {
  for (const snippet of [
    "fastify.post('/pix/standalone'",
    "fastify.get('/pix/standalone'",
    "fastify.get('/pix/standalone/:id/status'",
    "fastify.post('/pix/standalone/:id/cancel'",
    "fastify.post('/pix/standalone/:id/share-whatsapp'",
    "fastify.get('/google-contacts/search'",
    'searchGoogleContacts',
    'people:searchContacts',
    'getGoogleContactsAccessToken',
    "error: 'google_contacts_token_invalid'",
    "fastify.get('/pix/public/:token'",
    "metadata: {",
    "flow: 'standalone_pix'",
    "external_reference: `standalone_pix:${id}`",
    'date_of_expiration',
    'STANDALONE_PIX_EXPIRATION_MINUTES = 10',
    'public_token',
    'cancel_reason',
    'unpaid_expired',
    'manual_cancelled',
    'shared_phone',
    'share_channel',
    'cash_closing_id',
    'Cancelado por falta de pagamento',
    'clearDisplayActivePixIfMatches',
    'refreshStandalonePixMercadoPagoStatus',
    'Pix aprovado nao pode ser cancelado',
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

  const standaloneProcessorStart = source.indexOf('async function processStandalonePixMercadoPagoPayment(payment)');
  const standaloneProcessorEnd = source.indexOf('async function processPdvPixMercadoPagoPayment(payment)', standaloneProcessorStart);
  const standaloneProcessorBlock = source.slice(standaloneProcessorStart, standaloneProcessorEnd);
  assert.doesNotMatch(
    standaloneProcessorBlock,
    /clearDisplayActivePixIfMatches/,
    `${label} must not clear standalone Pix display immediately after approval`
  );

  const publicRouteStart = source.indexOf("fastify.get('/pix/public/:token'");
  const publicRouteEnd = source.indexOf("fastify.post('/pdv/displays/:displayId/active-pix'", publicRouteStart);
  const publicRouteBlock = source.slice(publicRouteStart, publicRouteEnd);
  assert.match(
    publicRouteBlock,
    /refreshStandalonePixMercadoPagoStatus\(current\)/,
    `${label} public Pix route must refresh Mercado Pago status instead of depending only on webhook`
  );
}

assertBackend(server, 'vps_server.js');
assertBackend(serverCjs, 'vps_server.cjs');

console.log('standalone pix backend static checks passed');
