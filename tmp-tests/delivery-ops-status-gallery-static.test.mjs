import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverFiles = ['vps_server.js', 'vps_server.cjs'];
const saleTypes = readFileSync('types/sale.ts', 'utf8');
const saleService = readFileSync('services/saleService.ts', 'utf8');
const salesPage = readFileSync('pages/admin/sales/SalesPage.tsx', 'utf8');
const modal = readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');
const deliveryService = readFileSync('services/customerDeliveryService.ts', 'utf8');
const deliveryPage = readFileSync('pages/delivery/DeliveryOperationPage.tsx', 'utf8');

for (const file of serverFiles) {
  const source = readFileSync(file, 'utf8');
  assert.match(
    source,
    /SELECT \* FROM customer_delivery_proofs WHERE job_id = \? ORDER BY created_at DESC LIMIT 20/,
    `${file} must return a proof gallery for delivery jobs`
  );
  assert.match(
    source,
    /return \{ job, proof: proofs\?\.\[0\] \|\| null, proofs: proofs \|\| \[] \}/,
    `${file} must expose proof and proofs[] on the delivery job endpoint`
  );
  assert.match(
    source,
    /function getCustomerDeliveryCompletionBlockers/,
    `${file} must centralize completion blockers before setting delivered status`
  );
  assert.match(
    source,
    /getCustomerDeliveryCompletionBlockers\(job, proof, \{ adminOverride: isAdminCompletion \}\)/,
    `${file} must let administrative completion skip proof/payment blockers while keeping structural blockers`
  );
  assert.match(
    source,
    /if \(!options\?\.adminOverride && job\?\.payment_status !== 'approved'/,
    `${file} must not require approved delivery Pix for administrative completion`
  );
  assert.match(
    source,
    /if \(!options\?\.adminOverride && !proof\?\.image_url\)/,
    `${file} must not require proof photo for administrative completion`
  );
  assert.match(
    source,
    /statusCode: 409/,
    `${file} must reject incomplete delivery jobs without marking them delivered`
  );
  assert.match(
    source,
    /Rota da entrega pendente/,
    `${file} must require a generated delivery route before completion`
  );
}

assert.match(saleTypes, /interface SaleDeliveryJobSummary/, 'sale types must define delivery job summary');
assert.match(saleTypes, /delivery_job\?: SaleDeliveryJobSummary \| null/, 'SaleWithItems must expose delivery_job');
assert.match(saleService, /loadTableRows<any>\('customer_delivery_jobs'\)/, 'getSales must load delivery job rows');
assert.match(saleService, /deliveryJobBySaleId/, 'getSales must map delivery jobs by sale id');
assert.match(salesPage, /Entrega/, 'Sales table must show an Entrega column');
assert.match(salesPage, /getDeliveryStatusLabel/, 'Sales page must format delivery status labels');
assert.match(salesPage, /sale\.delivery_job/, 'Sales page must render per-sale delivery job status');
assert.match(salesPage, /getSaleOperationalStatusLabel/, 'Sales page must format operational sale status with delivery state');
assert.match(salesPage, /Entrega pendente/, 'Sales page must not show completed status when delivery is incomplete');
assert.match(salesPage, /isSaleDeliveryComplete/, 'Sales page must check delivery completion before labeling a sale completed');

assert.match(deliveryService, /proofs\?: CustomerDeliveryProof\[]/, 'delivery service must type proofs array');
assert.match(modal, /deliveryProofs/, 'sale modal must load delivery proof gallery');
assert.match(modal, /deliveryLogs/, 'sale modal must load delivery logs');
assert.match(modal, /Baixar entrega/, 'sale modal must expose admin delivery completion');
assert.match(modal, /adminCompletionReason/, 'sale modal must require an admin completion reason');
assert.match(modal, /getDeliveryCompletionBlockers/, 'sale modal must list blockers before admin completion');
assert.match(modal, /getDeliveryCompletionBlockers\(deliveryJob, deliveryProofs, \{ adminOverride: true \}\)/, 'sale modal admin completion must ignore Pix/proof blockers while keeping structural blockers');
assert.match(modal, /if \(!options\?\.adminOverride && job\.payment_status !== 'approved'/, 'sale modal must not block administrative completion on pending delivery Pix');
assert.match(modal, /if \(!options\?\.adminOverride && !proofs\.some/, 'sale modal must not block administrative completion on missing proof photo');
assert.match(modal, /deliveryCompletionBlockers\.length === 0/, 'sale modal must only allow admin completion when no structural delivery data is missing');
assert.match(modal, /Pendencias para concluir/, 'sale modal must explain what still blocks delivery completion');

assert.match(deliveryPage, /const \[proofs, setProofs\]/, 'delivery page must keep proof gallery state');
assert.match(deliveryPage, /proofs\.map/, 'delivery page must render all uploaded proof photos');
assert.match(deliveryPage, /proofs\.length > 0/, 'delivery completion must allow any uploaded proof');

console.log('delivery ops status gallery static checks passed');
