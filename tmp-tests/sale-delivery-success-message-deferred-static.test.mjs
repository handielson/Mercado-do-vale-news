import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const saleService = readFileSync('services/saleService.ts', 'utf8');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const server = readFileSync(file, 'utf8');

  assert.match(
    server,
    /requiresDeliveryConfirmation[\s\S]*customer_delivery_jobs[\s\S]*delivery_status[^]*!== 'delivered'[\s\S]*status: 'deferred'[\s\S]*reason: 'awaiting_delivery_confirmation'/,
    `${file} must defer the successful-purchase message until delivery is confirmed`,
  );
  assert.match(
    server,
    /fastify\.post\('\/delivery\/jobs\/:token\/complete'[\s\S]*await connection\.commit\(\);[\s\S]*notifySaleCompletedWhatsApp\(updated\.sale_id\)/,
    `${file} must send the deferred successful-purchase message after normal delivery confirmation`,
  );
  assert.match(
    server,
    /fastify\.post\('\/delivery\/jobs\/:token\/admin-complete'[\s\S]*await connection\.commit\(\);[\s\S]*notifySaleCompletedWhatsApp\(updated\.sale_id\)/,
    `${file} must send the deferred successful-purchase message after store confirmation`,
  );
  assert.match(
    server,
    /template_key = 'sale_completed'[\s\S]*entity_type = 'sale'[\s\S]*entity_id = \?[\s\S]*status = 'sent'/,
    `${file} must not resend the successful-purchase message`,
  );
}

assert.match(
  saleService,
  /\['sent', 'deferred', 'already_sent'\]\.includes\(notification\?\.status\)/,
  'a deliberately deferred delivery message must not be reported as a sale-finalization warning',
);

console.log('sale delivery success message is deferred until confirmation');
