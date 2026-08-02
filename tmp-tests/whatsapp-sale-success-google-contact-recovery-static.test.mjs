import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');
  const formatterStart = source.indexOf('function formatAutomationDateTime(value)');
  const formatterEnd = source.indexOf('\n}\n', formatterStart);
  assert.ok(formatterStart >= 0 && formatterEnd > formatterStart, `${file} must define the sale date formatter`);
  const formatterSource = source.slice(formatterStart, formatterEnd + 3);
  const formatted = vm.runInNewContext(`${formatterSource}; formatAutomationDateTime('2026-08-01T15:47:55.000Z')`);
  assert.match(formatted, /01\/08\/2026/, `${file} must format the sale date in pt-BR`);
  assert.match(formatted, /12:47/, `${file} must convert the sale time to America/Recife`);

  assert.match(
    source,
    /notifySaleCompletedWhatsApp[\s\S]*syncCustomerGoogleContactRecord\(customer, 'sale-completed'\)[\s\S]*await sendWhatsAppAutomationMessageVps/,
    `${file} sale completion must retry Google Contacts before sending WhatsApp`,
  );
  assert.match(source, /google_contact_sync:[\s\S]*ok: googleContactSync\?\.ok === true/, `${file} must report the contact sync result`);
  assert.match(source, /googleContactsAccessTokenCache[\s\S]*expiresAt > Date\.now\(\) \+ 60_000/, `${file} must reuse a valid Google access token`);
  assert.match(source, /Number\(data\.expires_in\)[\s\S]*googleContactsAccessTokenCache = \{ token, expiresAt:/, `${file} must automatically honor Google token expiry`);
}

console.log('WhatsApp sale success and Google contact recovery static checks passed');
