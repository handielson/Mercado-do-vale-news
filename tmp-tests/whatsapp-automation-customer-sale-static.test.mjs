import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.cjs', 'utf8');
const deployedServer = readFileSync('vps_server.js', 'utf8');
const customers = readFileSync('services/customers.ts', 'utf8');
const sales = readFileSync('services/saleService.ts', 'utf8');

[
  'notifyCustomerRegisteredWhatsApp',
  'notifySaleCompletedWhatsApp',
  "fastify.post('/whatsapp/automation/customer-registered'",
  "fastify.post('/whatsapp/automation/sale-completed'",
  'customer_registered_site',
  'customer_registered_admin',
  'sale_completed',
  'maskAutomationCpf',
  'maskAutomationSerial',
  'sendBirthdayGreetingsForToday',
  "fastify.post('/whatsapp/automation/birthdays/today'",
].forEach((needle) => {
  assert.ok(server.includes(needle), `VPS server must include ${needle}`);
  assert.ok(deployedServer.includes(needle), `deployed VPS server must include ${needle}`);
});

assert.ok(
  server.includes("notifyCustomerRegisteredWhatsApp(customer.id, 'site'") ||
    server.includes("notifyCustomerRegisteredWhatsApp(customerId, 'site'"),
  'site registration must trigger customer_registered_site automation',
);
assert.ok(/sendBirthdayGreetingsForToday\([\s\S]*birthdaySummary/.test(server), 'cron dispatcher must trigger birthday greetings summary');
assert.ok(/birthday_greeting[\s\S]*DATE\(created_at\) = CURDATE\(\)/.test(server), 'birthday automation must prevent same-day duplicates');

[
  '/whatsapp/automation/customer-registered',
  "source: 'admin'",
].forEach((needle) => {
  assert.ok(customers.includes(needle), `customer service must include ${needle}`);
});

[
  '/whatsapp/automation/sale-completed',
  'sale_id: sale.id',
].forEach((needle) => {
  assert.ok(sales.includes(needle), `sale service must include ${needle}`);
});

console.log('whatsapp automation customer/sale static checks passed');
