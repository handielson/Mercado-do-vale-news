import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = ['vps_server.cjs', 'vps_server.js'];

const requiredSnippets = [
  'CREATE TABLE IF NOT EXISTS pdv_receipt_share_tokens',
  'receipt_share_token_hash',
  "fastify.post('/pdv/displays/:displayId/clear-visual'",
  "fastify.post('/pdv/pix-payments/:id/receipt/whatsapp'",
  "fastify.post('/pdv/pix-payments/:id/receipt/share-link'",
  "fastify.post('/pdv/display/pix-payments/:id/receipt/share-link'",
  "fastify.get('/pdv/receipt-share/:token'",
  'buildPdvPixReceiptData',
  'formatPdvPixReceiptWhatsAppMessage',
  'maskPdvReceiptPhone',
  'expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)',
];

const clearVisualRouteDeclaration = "fastify.post('/pdv/displays/:displayId/clear-visual'";
const destructiveClearVisualMutation =
  /(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+`?(?:sales|orders|products)`?\b/i;

function extractRouteBlock(source, routeDeclaration) {
  const start = source.indexOf(routeDeclaration);

  if (start === -1) {
    return '';
  }

  const nextRoute = source.slice(start + routeDeclaration.length).search(/\n\s*fastify\.(?:get|post|put|patch|delete|route)\s*\(/);
  const end = nextRoute === -1 ? source.length : start + routeDeclaration.length + nextRoute;

  return source.slice(start, end);
}

for (const file of files) {
  const source = readFileSync(resolve(root, file), 'utf8');

  for (const snippet of requiredSnippets) {
    assert.ok(source.includes(snippet), `${file} must include ${snippet}`);
  }

  const displayShareRouteBlock = extractRouteBlock(source, "fastify.post('/pdv/display/pix-payments/:id/receipt/share-link'");

  assert.ok(
    displayShareRouteBlock.includes('pdv_display_tokens'),
    `${file} display receipt share route must validate the paired display token`,
  );

  assert.ok(
    displayShareRouteBlock.includes('active_pix_payment_id = p.id'),
    `${file} display receipt share route must only allow the active Pix on that display`,
  );

  assert.doesNotMatch(
    displayShareRouteBlock,
    /preHandler:\s*requireSyncKey/,
    `${file} display receipt share route must not require the admin sync key`,
  );

  const clearVisualRouteBlock = extractRouteBlock(source, clearVisualRouteDeclaration);

  assert.ok(
    clearVisualRouteBlock.includes('active_pix_payment_id = NULL'),
    `${file} clear-visual route must clear the active Pix payment from the display`,
  );

  assert.doesNotMatch(
    clearVisualRouteBlock,
    destructiveClearVisualMutation,
    `${file} clear-visual route must not mutate sales, orders, or products`,
  );
}

console.log('pdv totem backend contract static checks passed');
