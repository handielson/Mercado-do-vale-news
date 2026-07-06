import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = ['vps_server.js', 'vps_server.cjs'];

for (const file of files) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /async function processPdvPixMercadoPagoPayment\(payment\)/,
    `${file} must process approved PDV Pix payments from Mercado Pago webhooks`,
  );

  assert.match(
    source,
    /payment\?\.metadata\?\.flow === 'pdv_pix'/,
    `${file} webhook must route metadata.flow=pdv_pix to the PDV Pix processor`,
  );

  assert.match(
    source,
    /metadata\?\.pdv_pix_payment_id/,
    `${file} PDV Pix processor must find the local payment id from Mercado Pago metadata`,
  );

  assert.match(
    source,
    /approved_at = COALESCE\(approved_at, CURRENT_TIMESTAMP\)/,
    `${file} PDV Pix approval must store approved_at for receipt display timing`,
  );

  const processorStart = source.indexOf('async function processPdvPixMercadoPagoPayment(payment)');
  const processorEnd = source.indexOf('async function handleMercadoPagoWebhookVps', processorStart);
  const processorBlock = source.slice(processorStart, processorEnd);

  assert.doesNotMatch(
    processorBlock,
    /clearDisplayActivePixIfMatches/,
    `${file} PDV Pix approval must not clear the active display before receipt sharing`,
  );

  assert.match(
    processorBlock,
    /message: 'pdv pix approved'/,
    `${file} PDV Pix processor should report a clear approval result`,
  );
}

console.log('pdv pix webhook approval static checks passed');
