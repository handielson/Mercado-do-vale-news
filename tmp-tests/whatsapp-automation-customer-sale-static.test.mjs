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
  'sendBirthdayWhatsappAudio',
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
assert.ok(/hour === '08'[\s\S]*sendBirthdayGreetingsForToday/.test(server), 'cron dispatcher must trigger birthday greetings at 08h Brasilia');
assert.ok(/birthday_greeting[\s\S]*DATE\(created_at\) = CURDATE\(\)/.test(server), 'birthday automation must prevent same-day duplicates');
assert.ok(server.includes('recordBirthdayGreetingN8nContext'), 'birthday greeting must be recorded in the bot conversation context');
assert.ok(server.includes('birthdayGreetingActive'), 'birthday context must be available to n8n');
assert.ok(server.includes('messagesWithBirthdayContext'), 'a birthday message already sent must remain in the conversation history');
assert.ok(server.includes("sourceNode: 'automation-birthday-greeting'"), 'birthday context must retain its automation source');
assert.ok(server.includes("'/message/sendMedia'"), 'birthday audio must use the standard Evolution media endpoint');
assert.ok(server.includes("fileName: 'parabens_xuxa.ogg'"), 'birthday audio must identify the prepared Xuxa file');
assert.ok(server.includes('birthday_audio_sent') && server.includes('birthday_audio_failed'), 'birthday audio outcome must be auditable');
assert.ok(
  server.indexOf("'/message/sendMedia'") < server.indexOf("'/message/sendWhatsAppAudio'"),
  'standard media send must run before the legacy audio fallback',
);

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
