import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.cjs', 'utf8');
const deployedServer = readFileSync('vps_server.js', 'utf8');
const deliveryService = readFileSync('services/customerDeliveryService.ts', 'utf8');
const deliveryPage = readFileSync('pages/delivery/DeliveryOperationPage.tsx', 'utf8');

[
  'WHATSAPP_AUTOMATION_TEMPLATE_DEFAULTS_VPS',
  'whatsapp_automation_logs',
  'getWhatsAppAutomationTemplateVps',
  'renderWhatsAppAutomationTemplateVps',
  'sendWhatsAppAutomationMessageVps',
  'notifyCustomerDeliveryOutForDelivery',
  "fastify.post('/delivery/jobs/:token/start-route'",
  "delivery_status = 'in_route'",
  'route_whatsapp_sent_at',
  'delivery_out_for_delivery',
  'automation_whatsapp_sent',
  'automation_whatsapp_skipped',
  'automation_whatsapp_failed',
].forEach((needle) => {
  assert.ok(server.includes(needle), `VPS server must include ${needle}`);
  assert.ok(deployedServer.includes(needle), `deployed VPS server must include ${needle}`);
});

[
  'startDeliveryRoute',
  "/delivery/jobs/${encodeURIComponent(token)}/start-route",
].forEach((needle) => {
  assert.ok(deliveryService.includes(needle), `delivery service must include ${needle}`);
});

[
  'handleStartRoute',
  'Saindo para entrega',
  'Pedido saiu para entrega',
  'startDeliveryRoute',
].forEach((needle) => {
  assert.ok(deliveryPage.includes(needle), `delivery page must include ${needle}`);
});

console.log('whatsapp automation send static checks passed');
